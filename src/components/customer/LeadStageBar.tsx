import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { patchMyLead } from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
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
  const { role } = useAuth();
  const partner = role === "dsa" || role === "affiliate";
  const [stage, setStage] = useState(purchase.pipeline_stage);
  const [dealValue, setDealValue] = useState(purchase.deal_value != null ? String(purchase.deal_value) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const railRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const rail = railRef.current;
    const step = rail?.querySelector<HTMLElement>('[aria-current="step"]')?.closest("li");
    if (!rail || !step || rail.scrollWidth <= rail.clientWidth) return;
    rail.scrollLeft = step.offsetLeft - rail.clientWidth / 2 + step.clientWidth / 2;
  }, [stage]);

  const current = FORWARD.findIndex(([key]) => key === stage);
  const rejected = stage === "rejected";
  const next = !rejected && current >= 0 && current < FORWARD.length - 1 ? FORWARD[current + 1] : null;
  const bankHeld = stage === "bank_submitted" || stage === "sanctioned" || stage === "disbursed";
  const bankStep = (key: string) => partner && (key === "sanctioned" || key === "disbursed" || (key === "rejected" && bankHeld));
  const nextLocked = Boolean(next && bankStep(next[0]));

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
    if (key === stage || busy || bankStep(key)) return;
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
    <div className="w-full min-w-0 max-w-full border-t border-[#e3f1e7] bg-[#EEF8F1]">
      <div className="flex min-w-0 flex-col gap-2.5 px-4 py-2.5 lg:px-6 xl:flex-row xl:items-center xl:gap-4">
        <div className="flex w-full min-w-0 flex-1 items-center gap-3">
          <span className="hidden shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#5c4d72] sm:block">Lead stage</span>
          <ol
            ref={railRef}
            className="relative flex w-0 min-w-0 flex-1 snap-x items-center overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {FORWARD.map(([key, label], index) => {
              const done = !rejected && current >= 0 && index < current;
              const active = !rejected && index === current;
              return (
                <li key={key} className="flex shrink-0 snap-start items-center sm:flex-1 sm:last:flex-none">
                  <button
                    type="button"
                    disabled={busy !== null || bankStep(key)}
                    onClick={() => move(key)}
                    title={bankStep(key) ? "The bank desk records this" : active ? `Current stage: ${label}` : `Move to ${label}`}
                    aria-current={active ? "step" : undefined}
                    className="group flex items-center gap-1.5 rounded-full py-0.5 pr-1 disabled:cursor-wait"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold transition-colors ${
                        active
                          ? "bg-[#10662A] text-white ring-2 ring-[#10662A]/25 ring-offset-1"
                          : done
                            ? "bg-[#10662A] text-white"
                            : "border border-[#cfe3d5] bg-white text-[#5c4d72] group-hover:border-[#10662A]/50"
                      }`}
                    >
                      {busy === key ? <Loader2 className="size-3 animate-spin" /> : done ? <Check className="size-3" /> : index + 1}
                    </span>
                    <span
                      className={`whitespace-nowrap text-[11px] font-semibold ${
                        active ? "text-[#10662A]" : done ? "text-[#390A5D]" : "text-[#5c4d72] group-hover:text-[#10662A]"
                      }`}
                    >
                      {label}
                    </span>
                  </button>
                  {index < FORWARD.length - 1 ? (
                    <span
                      aria-hidden
                      className={`mx-1.5 h-0.5 w-5 shrink-0 rounded-full sm:mx-2 sm:w-auto sm:min-w-4 sm:flex-1 ${done ? "bg-[#10662A]" : "bg-[#d8ecdd]"}`}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          {rejected ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
              <XCircle className="size-3.5" /> Rejected
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:shrink-0">
          <div className="flex h-8 items-center overflow-hidden rounded-md border border-[#d8ecdd] bg-white">
            <span className="px-2 text-[11px] font-semibold text-[#5c4d72]">Deal ₹</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={dealValue}
              onChange={(e) => setDealValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveDeal();
              }}
              className="h-full w-24 border-l border-[#d8ecdd] px-2 text-xs text-[#390A5D] outline-none sm:w-28"
              placeholder="0"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={saveDeal}
              className="h-full border-l border-[#d8ecdd] px-2.5 text-[11px] font-semibold text-[#10662A] hover:bg-[#E8F7EC] disabled:opacity-50"
            >
              {busy === "deal" ? "Saving…" : "Save"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy !== null || !next || nextLocked}
            onClick={() => next && !nextLocked && move(next[0])}
            title={nextLocked ? "Narender records sanction and disbursement after the bank decides" : rejected ? "Click a stage to reopen this lead" : next ? `Move to ${next[1]}` : "Lead is disbursed"}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[#390A5D] px-3 text-[11px] font-semibold text-white hover:bg-[#2d0848] disabled:opacity-40"
          >
            {nextLocked ? "Waiting for bank desk" : next ? `Next: ${next[1]}` : rejected ? "Rejected" : "Disbursed"}
            {next ? <ArrowRight className="size-3.5" /> : null}
          </button>
          {!rejected ? (
            <button
              type="button"
              disabled={busy !== null || (partner && bankHeld)}
              onClick={() => {
                if (confirm("Mark this lead as rejected? Its case file will be cancelled.")) move("rejected");
              }}
              className="h-8 rounded-md border border-red-200 bg-white px-3 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Mark rejected
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
