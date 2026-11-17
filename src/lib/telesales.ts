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
  { id: "home", group: "Retail", title: "Home Loan", match: ["home"], lines: ["Namaste, main RupeeDial se bol raha hoon. Aapne home loan requirement share ki thi.", "City, property type, aur salaried ya self-employed confirm karo. Amount sirf requirement ke liye.", "Interested hon to partner papers lega. Sanction ka promise mat karo."] },
  { id: "personal", group: "Retail", title: "Personal Loan", match: ["personal", "pl_"], lines: ["Namaste, main RupeeDial se bol raha hoon. Aapne personal loan requirement share ki thi.", "City, employment aur monthly income confirm karo. Amount sirf requirement confirm karne ke liye.", "Interested hon to next step partner ke documents hain. Callback time lock karo."] },
  { id: "auto", group: "Retail", title: "Auto Loan", match: ["auto", "vehicle", "car loan", "car_"], lines: ["Namaste, RupeeDial se auto loan follow-up.", "City, new ya used vehicle, aur employment confirm karo.", "Interested hon to document step batao aur time fix karo. Rate promise mat karo."] },
  { id: "education", group: "Retail", title: "Education Loan", match: ["education", "edu"], lines: ["Namaste, RupeeDial se education loan follow-up.", "Course, India ya abroad, aur student ya parent confirm karo. City bhi lo.", "Interested hon to admission proof baad mein partner lega. Approval mat bolo."] },
  { id: "card", group: "Retail", title: "Credit Cards", match: ["card"], lines: ["Namaste, RupeeDial se credit card enquiry follow-up.", "City aur salaried ya self-employed confirm karo. Existing card haan ya na.", "Interested hon to checklist partner share karega. Card approval ka promise mat karo."] },
  { id: "lap", group: "Retail", title: "Loan Against Property", match: ["lap", "property", "mortgage"], lines: ["Namaste, RupeeDial se loan against property ke liye call.", "Property city, residential ya commercial, aur requirement confirm karo.", "Ownership papers partner lega. Valuation ya sanction yahin se mat do."] },
  { id: "insurance", group: "Retail", title: "Insurance", match: ["insurance", "mediclaim", "policy"], lines: ["Namaste, RupeeDial se insurance enquiry follow-up.", "Health, life ya motor, city, aur existing policy haan ya na confirm karo.", "Interested hon to partner plan options dikhayega. Cover promise mat karo."] },
  { id: "msme", group: "MSME", title: "MSME Loan", match: ["msme"], lines: ["Namaste, RupeeDial se MSME loan follow-up.", "Business type, city, turnover band, aur GST haan ya na confirm karo.", "Interested hon to file partner ke paas jayegi. Lender decision mat do."] },
  { id: "mudra", group: "MSME", title: "Mudra Loan", match: ["mudra"], lines: ["Namaste, RupeeDial se Mudra loan follow-up.", "Business type, city, aur naya unit ya chal raha business confirm karo.", "Shishu, Kishor ya Tarun ka promise mat karo. Interested hon to partner aage badhayega."] },
  { id: "machinery", group: "MSME", title: "Machinery Loan", match: ["machinery", "machine"], lines: ["Namaste, RupeeDial se machinery loan follow-up.", "Machine kya hai, new ya used, business type aur city confirm karo.", "Quotation baad mein partner lega. Sanction mat bolo."] },
  { id: "working", group: "MSME", title: "Working Capital Loan", match: ["working"], lines: ["Namaste, RupeeDial se working capital follow-up.", "Business type, city, turnover band, aur GST haan ya na confirm karo.", "Interested hon to partner statements lega. Limit promise mat karo."] },
  { id: "startup", group: "MSME", title: "Startup Business Loan", match: ["startup"], lines: ["Namaste, RupeeDial se startup finance follow-up.", "Idea ya running business, city, aur kitne mahine se hai, ye confirm karo.", "Interested hon to partner documents lega. Funding promise mat karo."] },
  { id: "business", group: "MSME", title: "Business Loan", match: ["business", "gst"], lines: ["Namaste, RupeeDial se business loan follow-up.", "Business type, turnover band aur city confirm karo. GST ya ITR haan ya na.", "Interested hon to file partner ke paas jayegi. Lender decision yahin se mat do."] },
  { id: "cgtmse", group: "Government MSME", title: "CGTMSE Loan", match: ["cgtmse"], lines: ["Namaste, RupeeDial se CGTMSE enquiry follow-up.", "Business type, city, aur GST haan ya na confirm karo.", "Collateral-free approval ka promise mat karo. Interested hon to partner file banayega."] },
  { id: "pmegp", group: "Government MSME", title: "PMEGP Loan", match: ["pmegp"], lines: ["Namaste, RupeeDial se PMEGP follow-up.", "Naya unit ya existing, business idea, aur city confirm karo.", "Subsidy promise mat karo. Interested hon to partner project note lega."] },
  { id: "standup", group: "Government MSME", title: "Stand-Up India", match: ["stand"], lines: ["Namaste, RupeeDial se Stand-Up India follow-up.", "Business idea, city, aur naya unit ya chal raha hai, ye confirm karo.", "Scheme fit partner check karega. Approval ya category assume mat karo."] },
  { id: "subsidy", group: "Government MSME", title: "Subsidy Linked MSME", match: ["subsidy"], lines: ["Namaste, RupeeDial se subsidy-linked MSME follow-up.", "Business type, city, aur GST haan ya na confirm karo.", "Subsidy amount promise mat karo. Interested hon to partner scheme match karega."] },
  { id: "export", group: "Trade Finance", title: "Export Finance", match: ["export"], lines: ["Namaste, RupeeDial se export finance follow-up.", "Kya export hota hai, kaun sa country, aur city confirm karo.", "Order copy baad mein partner lega. Limit promise mat karo."] },
  { id: "import", group: "Trade Finance", title: "Import Finance", match: ["import"], lines: ["Namaste, RupeeDial se import finance follow-up.", "Kaun sa goods, city, aur GST haan ya na confirm karo.", "Interested hon to partner supplier details lega. Bank decision mat do."] },
  { id: "lc", group: "Trade Finance", title: "LC / BG", match: ["lc", "bg", "guarantee"], lines: ["Namaste, RupeeDial se LC ya bank guarantee follow-up.", "Buyer ya seller kaun hai, city, aur requirement band confirm karo.", "Bank issue karna promise mat karo. Interested hon to partner file lega."] },
  { id: "invoice", group: "Trade Finance", title: "Invoice Financing", match: ["invoice"], lines: ["Namaste, RupeeDial se invoice financing follow-up.", "Invoices ready hain ya nahi, buyer ka type, aur city confirm karo.", "Discount rate promise mat karo. Interested hon to partner invoices dekhega."] },
  { id: "cash", group: "Trade Finance", title: "Cash Credit (CC)", match: ["cash"], lines: ["Namaste, RupeeDial se cash credit follow-up.", "Business type, city, aur existing bank account haan ya na confirm karo.", "Limit promise mat karo. Interested hon to partner statements lega."] },
  { id: "od", group: "Trade Finance", title: "Overdraft (OD)", match: ["overdraft", "od loan", "od_"], lines: ["Namaste, RupeeDial se overdraft follow-up.", "Business type, city, aur current account haan ya na confirm karo.", "Limit promise mat karo. Interested hon to partner aage badhayega."] },
] as const;

export function scriptFor(subtype: string | null | undefined) {
  const key = (subtype || "").toLowerCase();
  const hit = CALL_SCRIPTS.find((script) => script.match.some((part) => key.includes(part)));
  return hit ?? CALL_SCRIPTS.find((script) => script.id === "personal") ?? CALL_SCRIPTS[0];
}
