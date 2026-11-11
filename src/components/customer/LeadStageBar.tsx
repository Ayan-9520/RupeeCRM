import { useEffect, useRef, useState } from "react";
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

const STATUSES = [
  ["callback", "Callback"],
  ["docs_pending", "Documents pending"],
  ["login_sent", "Login sent to bank"],
  ["not_reachable", "Not reachable"],
  ["interested", "Interested"],
  ["not_interested", "Not interested"],
] as const;

const NEEDS_DATE = new Set(["callback", "docs_pending", "not_reachable"]);
const RECALL_DAYS: [number, string][] = [[2, "2 days"], [7, "1 week"], [30, "1 month"], [60, "2 months"]];

const LABEL: Record<string, string> = Object.fromEntries([...FORWARD, ["rejected", "Rejected"]]);

function fromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T10:00`;
}

/** The My Leads pipeline. Case Files, Submissions and Invoices all follow this stage. */
export function LeadStageBar({ purchase }: { purchase: PurchaseContext }) {
  const [stage, setStage] = useState(purchase.pipeline_stage);
  const [dealValue, setDealValue] = useState(purchase.deal_value != null ? String(purchase.deal_value) : "");
  const [status, setStatus] = useState("callback");
  const [when, setWhen] = useState("");
  const [followup, setFollowup] = useState(purchase.next_followup_at);
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

  const save = async (key: string, body: Parameters<typeof patchMyLead>[1], message: string) => {
    setBusy(key);
    try {
      const updated = await patchMyLead(purchase.id, body);
      setStage(updated.pipeline_stage);
      setDealValue(updated.deal_value != null ? String(updated.deal_value) : "");
      setFollowup(updated.next_followup_at);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the lead");
    } finally {
      setBusy(null);
    }
  };

  const move = (key: string) => {
    if (key === stage || busy) return;
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
                    disabled={busy !== null}
                    onClick={() => move(key)}
                    title={active ? `Current stage: ${label}` : `Move to ${label}`}
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
          <label className="flex h-8 items-center gap-1 rounded-md border border-[#d8ecdd] bg-white px-2 text-[11px] font-semibold text-[#5c4d72]">
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-7 bg-transparent text-[11px] font-semibold text-[#390A5D] outline-none"
            >
              {STATUSES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="h-8 rounded-md border border-[#d8ecdd] bg-white px-2 text-[11px] text-[#390A5D]"
          />
          {RECALL_DAYS.map(([days, label]) => (
            <button key={days} type="button" onClick={() => setWhen(fromNow(days))} className="h-8 rounded-full bg-white px-2.5 text-[11px] font-semibold text-[#0D4F20] ring-1 ring-[#d8ecdd] hover:bg-[#0D4F20] hover:text-white">
              {label}
            </button>
          ))}
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (NEEDS_DATE.has(status) && !when) {
                toast.error("Pick the date to call again");
                return;
              }
              void save("status", {
                disposition: status,
                next_followup_at: when ? new Date(when).toISOString() : null,
              }, "Status saved");
            }}
            className="h-8 rounded-md bg-[#10662A] px-3 text-[11px] font-semibold text-white hover:bg-[#0D4F20] disabled:opacity-50"
          >
            {busy === "status" ? "Saving…" : "Save status"}
          </button>
          {followup ? <span className="text-[11px] font-semibold text-[#390A5D]">Recall {new Date(followup).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span> : null}
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
            disabled={busy !== null || !next}
            onClick={() => next && move(next[0])}
            title={rejected ? "Click a stage to reopen this lead" : next ? `Move to ${next[1]}` : "Lead is disbursed"}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[#390A5D] px-3 text-[11px] font-semibold text-white hover:bg-[#2d0848] disabled:opacity-40"
          >
            {next ? `Next: ${next[1]}` : rejected ? "Rejected" : "Disbursed"}
            {next ? <ArrowRight className="size-3.5" /> : null}
          </button>
          {!rejected ? (
            <button
              type="button"
              disabled={busy !== null}
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
