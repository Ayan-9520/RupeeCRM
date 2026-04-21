import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Loader2, RefreshCw, X, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

export type RefundReason =
  | "invalid_phone"
  | "wrong_number"
  | "do_not_call"
  | "duplicate"
  | "fake_data"
  | "no_intent"
  | "other";

const REASONS: { code: RefundReason; label: string; hint: string }[] = [
  { code: "invalid_phone", label: "Invalid phone", hint: "Number doesn't connect or is disconnected" },
  { code: "wrong_number", label: "Wrong number", hint: "Person on call is not the applicant" },
  { code: "do_not_call", label: "Do-not-call", hint: "Customer asked to never be contacted" },
  { code: "duplicate", label: "Duplicate lead", hint: "Same lead already in your CRM" },
  { code: "fake_data", label: "Fake / fabricated data", hint: "Identity, income or city is fake" },
  { code: "no_intent", label: "No loan intent", hint: "Customer never asked for this product" },
  { code: "other", label: "Other", hint: "Describe in notes below" },
];

type ExistingRefund = {
  id: string;
  status: "pending" | "approved" | "rejected" | "auto_approved";
  reason: RefundReason;
  amount: number;
  description: string | null;
  admin_notes: string | null;
  created_at: string;
  decided_at: string | null;
};

export function RefundRequestDialog({
  open,
  onClose,
  leadPurchaseId,
  leadId,
  applicantName,
  pricePaid,
}: {
  open: boolean;
  onClose: () => void;
  leadPurchaseId: string;
  leadId: string;
  applicantName: string;
  pricePaid: number;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState<RefundReason>("invalid_phone");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState<ExistingRefund | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("lead_refunds")
      .select("id,status,reason,amount,description,admin_notes,created_at,decided_at")
      .eq("lead_purchase_id", leadPurchaseId)
      .eq("dsa_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setExisting(data as ExistingRefund | null);
        setLoading(false);
      });
  }, [open, user, leadPurchaseId]);

  if (!open) return null;

  const submit = async () => {
    if (!user) return;
    if (reason === "other" && description.trim().length < 10) {
      toast.error("Please describe the issue (min 10 chars) when selecting 'Other'.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("lead_refunds").insert({
      lead_purchase_id: leadPurchaseId,
      lead_id: leadId,
      dsa_id: user.id,
      amount: pricePaid,
      reason,
      description: description.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Refund request submitted. Admin will review within 24h.");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-card border border-border shadow-elevated overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-amber-500/15 text-amber-600 grid place-items-center">
              <RefreshCw className="size-4" />
            </div>
            <div>
              <h3 className="font-display font-bold">Request refund</h3>
              <p className="text-xs text-muted-foreground">{applicantName} · ₹{pricePaid}</p>
            </div>
          </div>
          <button onClick={onClose} className="size-8 rounded-full grid place-items-center hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : existing ? (
          <ExistingRefundView refund={existing} onClose={onClose} />
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>Refunds are reviewed manually. False or repeated bad-faith requests may impact your buyer reputation.</span>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-2 block">Reason</label>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label
                    key={r.code}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-smooth ${
                      reason === r.code ? "border-accent bg-accent/5" : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="refund-reason"
                      checked={reason === r.code}
                      onChange={() => setReason(r.code)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">{r.hint}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">
                Notes {reason === "other" && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add any extra context for the reviewer (optional unless 'Other')…"
                className="input-base w-full resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 h-10 rounded-xl border border-border hover:bg-secondary text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-card hover:opacity-90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Submit refund request
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExistingRefundView({ refund, onClose }: { refund: ExistingRefund; onClose: () => void }) {
  const tone = refund.status === "approved" || refund.status === "auto_approved"
    ? { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", icon: CheckCircle2, label: "Approved" }
    : refund.status === "rejected"
      ? { bg: "bg-red-500/15", text: "text-red-700 dark:text-red-300", icon: XCircle, label: "Rejected" }
      : { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", icon: Clock, label: "Pending review" };
  const Icon = tone.icon;
  const reasonLabel = REASONS.find((r) => r.code === refund.reason)?.label ?? refund.reason;
  return (
    <div className="p-5 space-y-3">
      <div className={`rounded-xl ${tone.bg} ${tone.text} p-3 flex items-start gap-2`}>
        <Icon className="size-4 mt-0.5" />
        <div className="text-sm">
          <div className="font-bold">{tone.label}</div>
          <div className="text-xs opacity-80">
            Requested {new Date(refund.created_at).toLocaleString("en-IN")}
            {refund.decided_at && ` · Decided ${new Date(refund.decided_at).toLocaleString("en-IN")}`}
          </div>
        </div>
      </div>
      <div className="text-sm space-y-1.5">
        <div><span className="text-muted-foreground">Reason:</span> <span className="font-semibold">{reasonLabel}</span></div>
        <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold">₹{refund.amount}</span></div>
        {refund.description && (
          <div>
            <div className="text-muted-foreground">Your notes:</div>
            <div className="text-xs mt-0.5 p-2 rounded-lg bg-secondary/40">{refund.description}</div>
          </div>
        )}
        {refund.admin_notes && (
          <div>
            <div className="text-muted-foreground">Admin notes:</div>
            <div className="text-xs mt-0.5 p-2 rounded-lg bg-secondary/40">{refund.admin_notes}</div>
          </div>
        )}
      </div>
      <div className="pt-2 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
