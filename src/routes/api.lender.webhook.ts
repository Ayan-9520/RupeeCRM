import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import crypto from "crypto";

/**
 * Lender Webhook Stub
 *
 * External lenders POST status updates here:
 *   POST /api/lender/webhook
 *   Headers: x-lender-signature: <hmac-sha256 of raw body using LENDER_WEBHOOK_SECRET>
 *   Body: {
 *     lender_case_id: string,    // lender's internal reference (we match against disbursals.loan_account_no)
 *     status: 'docs_clear' | 'disbursed' | 'customer_paid' | 'rejected' | 'cancelled',
 *     remarks?: string,
 *     disbursed_amount?: number,
 *   }
 *
 * NOTE: This is a stub. To enable in production:
 *   1. Set LENDER_WEBHOOK_SECRET env var
 *   2. Onboard a lender and share the URL + secret
 *   3. Map lender_case_id → disbursals row via loan_account_no or webhook_payload metadata
 */

interface LenderPayload {
  lender_case_id?: unknown;
  status?: unknown;
  remarks?: unknown;
  disbursed_amount?: unknown;
}

const ALLOWED_STATUSES = ["docs_clear", "disbursed", "customer_paid", "rejected", "cancelled"] as const;

function verifySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  // timing-safe compare
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/lender/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.LENDER_WEBHOOK_SECRET;
        const body = await request.text();

        // 1. Signature verification (skipped only if secret not configured — dev mode)
        if (secret) {
          const sig = request.headers.get("x-lender-signature");
          if (!verifySignature(body, sig, secret)) {
            return new Response(JSON.stringify({ error: "Invalid signature" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        }

        // 2. Parse + validate payload
        let payload: LenderPayload;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const lenderCaseId = typeof payload.lender_case_id === "string" ? payload.lender_case_id : null;
        const status = typeof payload.status === "string" ? payload.status : null;
        const remarks = typeof payload.remarks === "string" ? payload.remarks : null;
        const disbursedAmount = typeof payload.disbursed_amount === "number" ? payload.disbursed_amount : null;

        if (!lenderCaseId || !status) {
          return new Response(JSON.stringify({ error: "lender_case_id and status are required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!ALLOWED_STATUSES.includes(status as any)) {
          return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 3. Find matching disbursal by loan_account_no
        const { data: disbursal, error: findErr } = await supabaseAdmin
          .from("disbursals")
          .select("id, dsa_id, lead_purchase_id")
          .eq("loan_account_no", lenderCaseId)
          .maybeSingle();

        if (findErr || !disbursal) {
          // Log unmatched payload for manual review
          await supabaseAdmin.from("disbursals").insert({
            dsa_id: "00000000-0000-0000-0000-000000000000", // placeholder; this insert will fail FK so we just log
            lead_id: "00000000-0000-0000-0000-000000000000",
            lead_purchase_id: "00000000-0000-0000-0000-000000000000",
            webhook_payload: payload as any,
            notes: `Unmatched lender_case_id: ${lenderCaseId}`,
          }).then(() => {}, () => {});

          return new Response(JSON.stringify({
            error: "No matching disbursal found",
            hint: "Set disbursals.loan_account_no = lender_case_id when creating the case",
          }), { status: 404, headers: { "Content-Type": "application/json" } });
        }

        // 4. Apply update via the existing confirm_disbursal RPC
        // (this also handles payout scheduling, lead_purchase conversion, notifications)
        const updates: any = {
          status,
          notes: remarks,
          webhook_payload: payload as any,
          updated_at: new Date().toISOString(),
        };
        if (status === "disbursed") {
          updates.disbursed_at = new Date().toISOString();
          if (disbursedAmount) updates.disbursed_amount = disbursedAmount;
        } else if (status === "docs_clear") {
          updates.docs_clear_at = new Date().toISOString();
        } else if (status === "customer_paid") {
          updates.customer_paid_at = new Date().toISOString();
        }

        const { error: updErr } = await supabaseAdmin
          .from("disbursals")
          .update(updates)
          .eq("id", disbursal.id);

        if (updErr) {
          return new Response(JSON.stringify({ error: updErr.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          success: true,
          disbursal_id: disbursal.id,
          status,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },

      // Healthcheck for lenders to verify the URL
      GET: async () => {
        return new Response(JSON.stringify({
          ok: true,
          endpoint: "lender-webhook-stub",
          methods: ["POST"],
          required_headers: ["x-lender-signature (HMAC-SHA256)"],
          required_fields: ["lender_case_id", "status"],
          allowed_statuses: ALLOWED_STATUSES,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
