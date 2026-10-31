const ORDER = ["rm1", "rm2", "manager", "business_head", "accounts", "paid"] as const;

const LABELS: Record<string, string> = {
  rm1: "RM 1",
  rm2: "RM 2",
  manager: "Manager",
  business_head: "Business Head",
  accounts: "Accounts",
  paid: "Paid",
};

export const STAGE_FILTERS: [string, string][] = [
  ["all", "All stages"],
  ["rm1", "RM 1 check"],
  ["rm2", "RM 2 check"],
  ["manager", "Manager approval"],
  ["business_head", "Business Head approval"],
  ["accounts", "Accounts payment"],
  ["query", "Query"],
  ["rejected", "Rejected"],
  ["paid", "Paid"],
];

const ACTIONS: Record<string, string> = {
  submitted: "Submitted",
  approved: "Approved",
  processing: "Sent ahead",
  query: "Query",
  rejected: "Rejected",
  resubmitted: "Resubmitted",
  paid: "Paid",
};

export function actionLabel(action: string) {
  return ACTIONS[action] || action;
}

export function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function InvoiceSteps({ stage, queriedStage }: { stage: string; queriedStage?: string | null }) {
  const marker = stage === "query" || stage === "rejected" ? queriedStage || "rm1" : stage;
  const index = ORDER.indexOf(marker as (typeof ORDER)[number]);
  return (
    <ol className="flex flex-wrap gap-1.5">
      {ORDER.map((id, i) => {
        const done = stage === "paid" || (index >= 0 && i < index);
        const here = id === marker && stage !== "paid";
        return (
          <li
            key={id}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              done ? "bg-[#10662A] text-white" : here ? "bg-[#E8F7EC] text-[#10662A] ring-1 ring-[#10662A]" : "bg-[#f3f7f4] text-[#5c4d72]"
            }`}
          >
            {LABELS[id]}
          </li>
        );
      })}
    </ol>
  );
}
