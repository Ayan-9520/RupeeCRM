export type BizFieldType = "text" | "number" | "money" | "select" | "multi" | "textarea";

export type BizField = {
  key: string;
  label: string;
  type: BizFieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
};

const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

export const STAGES: { key: string; label: string }[] = [
  { key: "quick_check", label: "Quick Check" },
  { key: "business_data", label: "Business & Data" },
  { key: "documents", label: "Documents" },
  { key: "assessment", label: "Assessment" },
  { key: "loan_options", label: "Loan Options" },
  { key: "lenders", label: "Lenders" },
  { key: "applied", label: "Apply" },
];

export const FACILITY_OPTIONS = opts([
  ["cash_credit", "Cash Credit"],
  ["overdraft", "Overdraft"],
  ["dropline_od", "Drop-line OD"],
  ["term_loan", "Term Loan"],
  ["machinery_loan", "Machinery Loan"],
  ["equipment_finance", "Equipment Finance"],
  ["commercial_vehicle", "Commercial Vehicle Loan"],
  ["project_finance", "Project Finance"],
  ["invoice_discounting", "Invoice Discounting"],
  ["bill_discounting", "Bill Discounting"],
  ["purchase_finance", "Purchase / Vendor Finance"],
  ["bank_guarantee", "Bank Guarantee"],
  ["letter_of_credit", "Letter of Credit"],
  ["secured_business_loan", "Secured Business Loan (LAP)"],
  ["unsecured_business_loan", "Unsecured Business Loan"],
]);

export const BANKS = [
  "SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Bank of Baroda", "PNB", "Canara Bank",
  "Union Bank of India", "Indian Bank", "Bank of India", "Kotak Mahindra Bank", "SIDBI",
];

const STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
  "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Punjab",
  "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other",
];

export const QUICK_FIELDS: BizField[] = [
  { key: "contact_name", label: "Contact person", type: "text" },
  { key: "mobile", label: "Mobile", type: "text", required: true },
  { key: "email", label: "Email", type: "text" },
  { key: "company_name", label: "Business / company name", type: "text", required: true },
  {
    key: "constitution", label: "Constitution", type: "select",
    options: opts([["proprietorship", "Proprietorship"], ["partnership", "Partnership"], ["llp", "LLP"], ["private_limited", "Private Limited"], ["public_limited", "Public Limited"]]),
  },
  { key: "pan", label: "PAN", type: "text" },
  { key: "gstin", label: "GSTIN", type: "text" },
  { key: "cin", label: "CIN / LLPIN", type: "text" },
  { key: "udyam_number", label: "Udyam number", type: "text" },
  { key: "vintage_years", label: "Business vintage (years)", type: "number", required: true },
  { key: "annual_turnover", label: "Annual turnover (₹)", type: "money", required: true },
  {
    key: "sector", label: "Sector", type: "select",
    options: opts([["manufacturing", "Manufacturing"], ["trading", "Trading"], ["services", "Services"], ["construction", "Construction & Real Estate"], ["agriculture", "Agriculture & allied"]]),
  },
  { key: "industry", label: "Industry", type: "text" },
  { key: "business_nature", label: "What the business makes / sells", type: "text" },
  { key: "enterprise_size", label: "Enterprise size", type: "select", options: opts([["micro", "Micro"], ["small", "Small"], ["medium", "Medium"]]) },
  {
    key: "company_stage", label: "Company stage", type: "select",
    options: opts([["established", "Established"], ["growth", "Growth"], ["new", "New"], ["greenfield", "Greenfield"], ["turnaround", "Turnaround"]]),
  },
  {
    key: "promoter_category", label: "Promoter category", type: "select",
    options: opts([["general", "General"], ["women", "Women"], ["sc", "SC"], ["st", "ST"], ["obc", "OBC"], ["minority", "Minority"], ["ex_serviceman", "Ex-Serviceman"], ["differently_abled", "Differently-abled"]]),
  },
  { key: "facility", label: "Requested facility", type: "select", options: FACILITY_OPTIONS, required: true },
  { key: "required_amount", label: "Required loan (₹)", type: "money", required: true },
  { key: "collateral", label: "Collateral available", type: "select", options: opts([["yes", "Yes"], ["no", "No"], ["partial", "Partial"], ["tbd", "To be assessed"]]) },
  { key: "udyam_registered", label: "Udyam registered", type: "select", options: opts([["yes", "Yes"], ["no", "No"], ["pending", "Pending"]]) },
  { key: "gst_regularity", label: "GST return regularity", type: "select", options: opts([["regular", "Filed regularly"], ["delays", "Some delays"], ["not_filed", "Not filed / not registered"]]) },
  { key: "state", label: "State", type: "select", options: STATES.map((s) => ({ value: s, label: s })) },
  { key: "city", label: "City", type: "text" },
  { key: "export_share", label: "Export share (%)", type: "number" },
  { key: "top_customer_share", label: "Largest customer share of sales (%)", type: "number" },
  { key: "existing_emi", label: "Existing EMIs per month (₹)", type: "money" },
  { key: "preferred_banks", label: "Preferred banks", type: "multi", options: BANKS.map((b) => ({ value: b, label: b })) },
];

export const DATA_FIELDS: BizField[] = [
  { key: "designation", label: "Contact designation", type: "text" },
  { key: "alt_mobile", label: "Alternate mobile", type: "text" },
  { key: "address", label: "Registered address", type: "textarea" },
  { key: "pincode", label: "Pincode", type: "text" },
  { key: "incorporation_date", label: "Date of incorporation", type: "text", hint: "DD/MM/YYYY" },
  { key: "employees", label: "Number of employees", type: "number" },
  { key: "premises", label: "Business premises", type: "select", options: opts([["owned", "Owned"], ["rented", "Rented"], ["leased", "Leased"]]) },
  { key: "key_customers", label: "Key customers", type: "text" },
  { key: "key_suppliers", label: "Key suppliers", type: "text" },
  { key: "existing_lenders", label: "Existing lenders & facilities", type: "textarea", hint: "e.g. SBI CC ₹40L, HDFC TL ₹15L (EMI ₹35k)" },
  { key: "existing_outstanding", label: "Total loan outstanding (₹)", type: "money" },
  { key: "loan_purpose", label: "Purpose of loan", type: "textarea" },
  { key: "promoter_details", label: "Promoters / directors (name, PAN, share %)", type: "textarea" },
];

export const FINANCIAL_FIELDS: BizField[] = [
  { key: "net_profit", label: "Net profit — last FY (₹)", type: "money", hint: "From ITR / P&L. Leave blank to use sector estimate." },
  { key: "depreciation", label: "Depreciation — last FY (₹)", type: "money" },
  { key: "net_worth", label: "Net worth (₹)", type: "money" },
  { key: "debtors", label: "Debtors / receivables (₹)", type: "money" },
  { key: "avg_bank_balance", label: "Average bank balance — 6m (₹)", type: "money" },
  { key: "cheque_bounces", label: "Cheque / EMI bounces — 6m", type: "number" },
  { key: "cibil_score", label: "CIBIL (promoter / CMR)", type: "number" },
  { key: "collateral_type", label: "Collateral type", type: "select", options: opts([["residential", "Residential property"], ["commercial", "Commercial property"], ["industrial", "Industrial property"], ["fd", "FD / liquid"], ["none", "None"]]) },
  { key: "collateral_value", label: "Collateral market value (₹)", type: "money" },
];

export const APPLY_STATUSES = ["draft", "submitted", "query", "sanctioned", "rejected", "disbursed"];

export function formatINR(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
}

export function shortINR(n: number | null | undefined): string {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1)} L`;
  return formatINR(v);
}

export function optionLabel(field: BizField | undefined, value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  const match = field?.options?.find((o) => o.value === value);
  return match ? match.label : String(value);
}
