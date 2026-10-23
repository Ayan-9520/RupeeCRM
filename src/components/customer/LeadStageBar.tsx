import { useState } from "react";
import { ArrowRight, Check, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { patchMyLead } from "@/lib/python-api";
import type { PurchaseContext } from "@/lib/customer-crm/types";

const FORWARD = [
  ["new", "New"],
  ["contacted", "Contacted"],
  ["docs_collected", "Docs collected"],
  ["bank_submitted", "Bank submitted"],
  ["sanctioned", "Sanctioned"],
  ["disbursed", "Disbursed"],
] as const;

const LABEL: Record<string, string> = Object.fromEntries([...FORWARD, ["rejected", "Rejected"]]);

/** The My Leads pipeline. Case Files, Submissions and Invoices all follow this stage. */
export function LeadStageBar({ purchase }: { purchase: PurchaseContext }) {
  const [stage, setStage] = useState(purchase.pipeline_stage);
  const [dealValue, setDealValue] = useState(purchase.deal_value != null ? String(purchase.deal_value) : "");
  const [busy, setBusy] = useState<string | null>(null);

  const current = FORWARD.findIndex(([key]) => key === stage);
  const rejected = stage === "rejected";
  const next = !rejected && current >= 0 && current < FORWARD.length - 1 ? FORWARD[current + 1] : null;

  const save = async (key: string, body: Parameters<typeof patchMyLead>[1], message: string) => {
    setBusy(key);
    try {
      const updated = await patchMyLead(purchase.id, body);
      setStage(updated.pipeline_stage);
      setDealValue(updated.deal_value != null ? String(updated.deal_value) : "");
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the lead");
    } finally {
      setBusy(null);
    }
  };

  const move = (key: string) => {
    if (key === stage) return;
    void save(key, { pipeline_stage: key }, `Lead moved to ${LABEL[key] ?? key}`);
  };

  const saveDeal = () => {
    const value = dealValue.trim() === "" ? null : Number(dealValue);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      toast.error("Enter a valid deal value");
      return;
    }
    void save("deal", { deal_value: value }, "Deal value saved");
  };

  return (
    <section className="border-b border-border bg-[#f7fdf8] px-4 lg:px-6 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wide text-[#5c4d72] shrink-0">Lead stage</div>
        <ol className="flex flex-1 min-w-[280px] items-center gap-1 overflow-x-auto">
          {FORWARD.map(([key, label], index) => {
            const done = !rejected && current >= 0 && index < current;
            const active = !rejected && index === current;
            return (
              <li key={key} className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => move(key)}
                  title={`Move to ${label}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? "bg-[#10662A] text-white"
                      : done
                        ? "bg-[#E8F7EC] text-[#10662A]"
                        : "border border-[#d8ecdd] bg-white text-[#5c4d72] hover:border-[#10662A]/40"
                  }`}
                >
                  {busy === key ? <Loader2 className="size-3 animate-spin" /> : done ? <Check className="size-3" /> : null}
                  {label}
                </button>
                {index < FORWARD.length - 1 ? <span className="h-px w-3 bg-[#d8ecdd]" /> : null}
              </li>
            );
          })}
          {rejected ? (
            <li className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 shrink-0">
              <XCircle className="size-3" /> Rejected
            </li>
          ) : null}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-[#5c4d72]">
            Deal ₹
            <input
              type="number"
              min={0}
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              className="h-7 w-28 rounded-md border border-[#d8ecdd] bg-white px-2 text-xs text-[#390A5D]"
              placeholder="Deal value"
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={saveDeal}
            className="h-7 rounded-md border border-[#d8ecdd] bg-white px-2.5 text-[11px] font-semibold text-[#390A5D] hover:bg-[#E8F7EC] disabled:opacity-50"
          >
            {busy === "deal" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !next}
            onClick={() => next && move(next[0])}
            title={rejected ? "Pick a stage above to reopen a rejected lead" : next ? `Move to ${next[1]}` : "Already disbursed"}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-[#390A5D] px-2.5 text-[11px] font-semibold text-white hover:bg-[#2d0848] disabled:opacity-40"
          >
            {next ? `Next: ${next[1]}` : "Next stage"} <ArrowRight className="size-3" />
          </button>
          {!rejected ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => {
                if (confirm("Mark this lead as rejected? Its case file will be cancelled.")) move("rejected");
              }}
              className="h-7 rounded-md border border-red-200 bg-white px-2.5 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Mark rejected
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
