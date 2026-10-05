import type { CrmPurchase } from "@/lib/python-api";
import { gradeCode, gradeFromPipeline, gradeText } from "@/lib/lead-grades";

export const TELE_SECTIONS = [
  { id: "queue", label: "Call Queue" },
  { id: "followups", label: "Today's Follow-ups" },
  { id: "scripts", label: "Scripts" },
  { id: "profile", label: "Customer Profile" },
  { id: "disposition", label: "Disposition" },
  { id: "callback", label: "Callback" },
  { id: "eligibility", label: "Eligibility" },
  { id: "conversion", label: "Lead Conversion" },
  { id: "performance", label: "Performance" },
] as const;

export type TeleSection = (typeof TELE_SECTIONS)[number]["id"];

export const DISPOSITIONS = [
  { code: "connected", label: "Connected" },
  { code: "not_reachable", label: "Not reachable" },
  { code: "interested", label: "Interested" },
  { code: "not_interested", label: "Not interested" },
  { code: "wrong_number", label: "Wrong number" },
  { code: "eligible", label: "Eligible" },
  { code: "converted", label: "Convert to case" },
] as const;

export function isTeleSection(value: string): value is TeleSection {
  return TELE_SECTIONS.some((item) => item.id === value);
}

export function isToday(iso: string | null | undefined, now = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export function isOpenCall(row: CrmPurchase) {
  return row.pipeline_stage === "new" || row.pipeline_stage === "contacted";
}

export function isFollowupDue(row: CrmPurchase, now = new Date()) {
  if (!row.next_followup_at) return false;
  if (row.pipeline_stage === "rejected" || row.pipeline_stage === "disbursed") return false;
  return new Date(row.next_followup_at).getTime() <= now.getTime() || isToday(row.next_followup_at, now);
}

export function lastDisposition(row: CrmPurchase) {
  const notes = [...(row.notes ?? [])].reverse();
  return notes.find((note) => note.kind === "disposition") ?? null;
}

export function gradeOf(row: CrmPurchase) {
  const fromStage = gradeFromPipeline(row.pipeline_stage);
  if (fromStage) return fromStage;
  const lead = row.lead;
  return gradeCode({
    pipeline_stage: row.pipeline_stage,
    lead_grade: lead?.lead_grade,
    phone_verified: lead?.phone_verified,
    monthly_income: lead?.monthly_income,
    loan_amount: lead?.loan_amount,
    employment_type: lead?.employment_type,
    score: lead?.score,
    full_phone: lead?.full_phone,
    product_details: lead?.product_details,
  });
}

export function gradeLabel(row: CrmPurchase) {
  return gradeText(gradeOf(row));
}

export function telesalesStats(rows: CrmPurchase[], now = new Date()) {
  const dispositions = rows.flatMap((row) =>
    (row.notes ?? [])
      .filter((note) => note.kind === "disposition" && isToday(note.at, now))
      .map((note) => note.code || ""),
  );
  const count = (code: string) => dispositions.filter((item) => item === code).length;
  const queue = rows.filter(isOpenCall).length;
  const followups = rows.filter((row) => isFollowupDue(row, now)).length;
  const converted = rows.filter((row) =>
    ["docs_collected", "bank_submitted", "sanctioned", "disbursed"].includes(row.pipeline_stage),
  ).length;
  return {
    queue,
    followups,
    callsToday: dispositions.length,
    connected: count("connected"),
    interested: count("interested"),
    callbacks: count("callback"),
    convertedToday: count("converted"),
    converted,
    connectRate: dispositions.length ? Math.round((count("connected") / dispositions.length) * 100) : 0,
  };
}

export const CALL_SCRIPTS = [
  {
    id: "personal",
    title: "Personal loan",
    match: ["personal", "pl_", "salaried"],
    lines: [
      "Namaste, main RupeeDial se bol raha hoon. Aapne loan requirement share ki thi.",
      "Confirm city, employment and monthly income. Amount sirf requirement confirm karne ke liye poochho.",
      "Agar interested hon to documents (PAN, income proof) ka next step batao aur callback time lock karo.",
    ],
  },
  {
    id: "business",
    title: "Business loan",
    match: ["business", "msme", "gst", "od"],
    lines: [
      "Namaste, RupeeDial se business finance follow-up.",
      "Business type, turnover band and city confirm karo. GST ya ITR available hai ya nahi, sirf haan/na.",
      "Interested hon to case documents ke liye convert karo. Lender decision yahin se mat do.",
    ],
  },
  {
    id: "home",
    title: "Home and property",
    match: ["home", "lap", "property", "mortgage"],
    lines: [
      "Namaste, RupeeDial se home / property finance ke liye call.",
      "City, property type and rough requirement confirm karo. Ownership docs baad mein case team legi.",
      "Interested hon to callback ya document collection schedule karo.",
    ],
  },
  {
    id: "auto",
    title: "Auto loan",
    match: ["auto", "car", "vehicle", "twowheeler", "two"],
    lines: [
      "Namaste, RupeeDial se auto finance follow-up.",
      "City, new ya used vehicle, aur employment confirm karo.",
      "Interested hon to next document step batao aur time fix karo.",
    ],
  },
  {
    id: "card",
    title: "Credit card",
    match: ["card", "cc_"],
    lines: [
      "Namaste, RupeeDial se credit card enquiry follow-up.",
      "City aur salaried ya self-employed confirm karo. Existing card haan/na.",
      "Interested hon to application-ready checklist share karo. Approval ka promise mat karo.",
    ],
  },
] as const;

export function scriptFor(subtype: string | null | undefined) {
  const key = (subtype || "").toLowerCase();
  return (
    CALL_SCRIPTS.find((script) => script.match.some((part) => key.includes(part))) ?? CALL_SCRIPTS[0]
  );
}
