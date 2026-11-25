import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Percent, Loader2, ArrowRight, Receipt } from "lucide-react";
import { listMyLeads, type CrmPurchase } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/commissions")({
  head: () => ({ meta: [{ title: "Commissions — RupeeOne" }] }),
  component: CommissionsPage,
});

function inr(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ");
}

function CommissionsPage() {
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listMyLeads();
        setRows((data.items ?? []).filter((p) => p.converted));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const spent = rows.reduce((sum, row) => sum + Number(row.price_paid || 0), 0);
  const booked = rows.reduce((sum, row) => sum + Number(row.deal_value || 0), 0);
  const openDeals = rows.filter((row) => row.deal_value == null || Number(row.deal_value) <= 0).length;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-[#390A5D]">
            <Percent className="size-6 text-[#10662A]" /> Lead purchases
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            What you paid to take each converted lead, and the deal size saved on that lead. Your lender share stays on Invoices.
          </p>
        </div>
        <Link
          to="/dashboard/earnings"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 text-xs font-semibold text-[#390A5D]"
        >
          <Receipt className="size-3.5" /> Invoices
        </Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white py-14 text-center text-sm text-[#5c4d72]">
          <p>No converted leads yet.</p>
          <Link to="/dashboard/my-leads" className="mt-3 inline-flex items-center gap-1 font-semibold text-[#10662A] hover:underline">
            My Leads <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Converted" value={String(rows.length)} hint="Disbursed or sanctioned leads" />
            <Stat label="Lead spend" value={inr(spent)} hint="Price paid to take these leads" />
            <Stat label="Deal book" value={inr(booked)} hint="Deal size saved on the lead" />
            <Stat label="Deal missing" value={String(openDeals)} hint="Lead has no deal size yet" />
          </div>

          <section className="overflow-hidden rounded-2xl border border-[#d8ecdd] bg-white">
            <div className="flex items-center justify-between border-b border-[#d8ecdd] px-4 py-3">
              <p className="text-sm font-semibold text-[#390A5D]">Converted leads</p>
              <p className="text-xs text-[#5c4d72]">{rows.length} leads</p>
            </div>
            <ul>
              {rows.map((row) => {
                const deal = row.deal_value != null && Number(row.deal_value) > 0 ? inr(Number(row.deal_value)) : "Not saved";
                const product = row.lead?.product_category?.replaceAll("_", " ");
                const place = [row.lead?.city, row.lead?.state].filter(Boolean).join(", ");
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#d8ecdd] px-4 py-4 first:border-t-0">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#390A5D]">{row.lead?.applicant_name ?? "Lead"}</p>
                      <p className="mt-0.5 text-xs capitalize text-[#5c4d72]">
                        {[product, place].filter(Boolean).join(" · ") || "Lead file"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <Amount label="Lead price" value={inr(Number(row.price_paid || 0))} />
                      <Amount label="Deal size" value={deal} muted={deal === "Not saved"} />
                      <span className="rounded-full bg-[#E8F7EC] px-2.5 py-1 text-[11px] font-semibold capitalize text-[#0D4F20]">
                        {stageLabel(row.pipeline_stage)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[#d8ecdd] bg-white px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
      <p className="mt-1 font-display text-lg font-bold text-[#10662A]">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
    </div>
  );
}

function Amount({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
      <p className={muted ? "font-medium text-slate-400" : "font-semibold text-[#390A5D]"}>{value}</p>
    </div>
  );
}
