export type DocumentCategory = "kyc" | "income" | "property" | "business" | "banking";

export type DocumentCatalogItem = {
  slug: string;
  label: string;
  category: DocumentCategory;
  legacyDocType?: string;
};

export const DOCUMENT_STATUSES = [
  "pending",
  "requested",
  "received",
  "uploaded",
  "under_review",
  "verified",
  "rejected",
  "expired",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_CATALOG: DocumentCatalogItem[] = [
  { slug: "pan_card", label: "PAN Card", category: "kyc", legacyDocType: "pan" },
  { slug: "aadhaar_front", label: "Aadhaar Front", category: "kyc", legacyDocType: "aadhaar" },
  { slug: "aadhaar_back", label: "Aadhaar Back", category: "kyc", legacyDocType: "aadhaar" },
  { slug: "passport", label: "Passport", category: "kyc", legacyDocType: "other" },
  { slug: "voter_id", label: "Voter ID", category: "kyc", legacyDocType: "other" },
  { slug: "driving_license", label: "Driving License", category: "kyc", legacyDocType: "other" },
  { slug: "salary_slip", label: "Salary Slip", category: "income", legacyDocType: "salary_slip" },
  { slug: "bank_statement", label: "Bank Statement", category: "income", legacyDocType: "bank_statement" },
  { slug: "itr", label: "ITR", category: "income", legacyDocType: "itr" },
  { slug: "form_16", label: "Form 16", category: "income", legacyDocType: "other" },
  { slug: "gst_return", label: "GST Return", category: "income", legacyDocType: "other" },
  { slug: "pnl", label: "P&L", category: "income", legacyDocType: "other" },
  { slug: "balance_sheet", label: "Balance Sheet", category: "income", legacyDocType: "other" },
  { slug: "registry", label: "Registry", category: "property", legacyDocType: "other" },
  { slug: "agreement", label: "Agreement", category: "property", legacyDocType: "agreement" },
  { slug: "sale_deed", label: "Sale Deed", category: "property", legacyDocType: "other" },
  { slug: "chain_documents", label: "Chain Documents", category: "property", legacyDocType: "other" },
  { slug: "noc", label: "NOC", category: "property", legacyDocType: "other" },
  { slug: "gst_certificate", label: "GST Certificate", category: "business", legacyDocType: "other" },
  { slug: "shop_act", label: "Shop Act", category: "business", legacyDocType: "other" },
  { slug: "udyam", label: "Udyam", category: "business", legacyDocType: "other" },
  { slug: "partnership_deed", label: "Partnership Deed", category: "business", legacyDocType: "other" },
  { slug: "moa_aoa", label: "MOA/AOA", category: "business", legacyDocType: "other" },
  { slug: "cancelled_cheque", label: "Cancelled Cheque", category: "banking", legacyDocType: "other" },
  { slug: "passbook", label: "Passbook", category: "banking", legacyDocType: "other" },
  { slug: "account_statement", label: "Account Statement", category: "banking", legacyDocType: "bank_statement" },
];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  kyc: "KYC Documents",
  income: "Income Documents",
  property: "Property Documents",
  business: "Business Documents",
  banking: "Banking Documents",
};

export const BANK_LOGIN_STATUSES = [
  "draft",
  "logged_in",
  "under_review",
  "approved",
  "rejected",
  "sanctioned",
  "disbursed",
  "closed",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
