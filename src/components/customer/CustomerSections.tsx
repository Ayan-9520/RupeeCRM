import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "./shared/SectionShell";
import { CrmFormGrid } from "./shared/CrmFormGrid";
import { EmptyBlock } from "./shared/EmptyBlock";
import { PERSONAL_FIELDS, employmentFields } from "@/lib/customer-crm/field-config";
import { ACCOUNT_TYPES, LOAN_TYPES, PRODUCT_TYPES } from "@/lib/customer-crm/constants";
import type { BankAccount, CoApplicant, CustomerProfile, LoanRequirement, Obligation } from "@/lib/customer-crm/types";
import { User, Briefcase, Landmark, Scale, Users, FileStack, FolderOpen, Building2 } from "lucide-react";
import type { CrmFieldConfig } from "./shared/CrmFormGrid";

type FieldChange = (key: string, value: unknown) => void;

export function PersonalSection({
  profile,
  onFieldChange,
  completion,
}: {
  profile: CustomerProfile;
  onFieldChange: FieldChange;
  completion: number;
}) {
  return (
    <SectionShell title="Personal Details" icon={User} completion={completion}>
      <CrmFormGrid fields={PERSONAL_FIELDS} values={profile as unknown as Record<string, unknown>} onChange={onFieldChange} />
    </SectionShell>
  );
}

export function EmploymentSection({
  profile,
  onFieldChange,
  completion,
}: {
  profile: CustomerProfile;
  onFieldChange: FieldChange;
  completion: number;
}) {
  return (
    <SectionShell title="Employment Details" icon={Briefcase} completion={completion}>
      <CrmFormGrid
        fields={employmentFields(profile.employment_type)}
        values={profile as unknown as Record<string, unknown>}
        onChange={onFieldChange}
      />
    </SectionShell>
  );
}

function OneAtATime<T extends { id: string }>({
  rows,
  summary,
  fields,
  onChange,
  onRemove,
}: {
  rows: T[];
  summary: (row: T, index: number) => string;
  fields: CrmFieldConfig[];
  onChange: (row: T, key: string, value: unknown) => void;
  onRemove: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {rows.map((row, index) => {
        const open = openId === row.id;
        return (
          <div key={row.id} className={`rounded-xl border bg-white ${open ? "border-[#10662A]" : "border-[#d8ecdd]"}`}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center justify-between text-left"
                onClick={() => setOpenId(open ? null : row.id)}
              >
                <span className="truncate text-sm font-semibold text-[#390A5D]">{summary(row, index)}</span>
                <span className="ml-3 text-[11px] font-bold uppercase text-[#10662A]">{open ? "Close" : "Select"}</span>
              </button>
              <button type="button" onClick={() => onRemove(row.id)} className="text-xs font-semibold text-red-700">
                Remove
              </button>
            </div>
            {open && (
              <div className="border-t border-[#d8ecdd] p-3">
                <CrmFormGrid fields={fields} values={row as unknown as Record<string, unknown>} onChange={(key, value) => onChange(row, key, value)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const BANK_FIELDS: CrmFieldConfig[] = [
  { key: "bank_name", label: "Bank Name" },
  { key: "account_type", label: "Account Type", type: "select", options: [...ACCOUNT_TYPES] },
  { key: "account_vintage", label: "Account Vintage" },
  { key: "average_balance", label: "Avg Balance (₹)", type: "number" },
  { key: "is_salary_account", label: "Salary Credit Bank", type: "switch" },
  { key: "emi_bounce_history", label: "EMI Bounce History" },
  { key: "statement_available", label: "Statement Available", type: "switch" },
  { key: "is_primary", label: "Primary Account", type: "switch" },
];

export function BankingSection({
  accounts,
  onChange,
  onAdd,
  onRemove,
  completion,
}: {
  accounts: BankAccount[];
  onChange: (row: BankAccount, key: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  completion: number;
}) {
  return (
    <SectionShell
      title="Banking Details"
      description="Leave account number and average balance empty until the statement is on the file"
      icon={Landmark}
      completion={completion}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Bank Account
        </Button>
      }
    >
      {accounts.length === 0 ? (
        <EmptyBlock message="No bank accounts added" hint="Click Add Bank Account to start" />
      ) : (
        <OneAtATime
          rows={accounts}
          fields={BANK_FIELDS}
          summary={(row, index) => row.bank_name || `Bank account ${index + 1}`}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    </SectionShell>
  );
}

const OBLIGATION_FIELDS: CrmFieldConfig[] = [
  { key: "loan_type", label: "Loan Type", type: "select", options: [...LOAN_TYPES] },
  { key: "bank_name", label: "Bank / NBFC" },
  { key: "emi", label: "EMI (₹)", type: "number" },
  { key: "outstanding_amount", label: "Outstanding (₹)", type: "number" },
  { key: "sanction_amount", label: "Sanction Amount (₹)", type: "number" },
  { key: "remaining_tenure", label: "Remaining Tenure (months)", type: "number" },
  { key: "start_date", label: "Start Date", type: "date" },
  { key: "overdue_status", label: "Overdue Status", type: "select", options: ["None", "1-30 days", "30-90 days", "90+ days"] },
];

export function ObligationsSection({
  rows,
  onChange,
  onAdd,
  onRemove,
  completion,
  summary,
}: {
  rows: Obligation[];
  onChange: (row: Obligation, key: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  completion: number;
  summary: { totalEmi: number; totalOutstanding: number; foir: number | null; dbr: number | null };
}) {
  return (
    <SectionShell
      title="Existing Obligations"
      icon={Scale}
      completion={completion}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Existing Loan
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <SummaryCard label="Total EMI" value={`₹${summary.totalEmi.toLocaleString("en-IN")}`} />
        <SummaryCard label="Total Outstanding" value={`₹${summary.totalOutstanding.toLocaleString("en-IN")}`} />
        <SummaryCard label="FOIR (est.)" value={summary.foir != null ? `${summary.foir.toFixed(1)}%` : "—"} />
        <SummaryCard label="DBR (est.)" value={summary.dbr != null ? `${summary.dbr.toFixed(1)}%` : "—"} />
      </div>
      {rows.length === 0 ? (
        <EmptyBlock message="No existing loans recorded" hint="Add running EMIs for accurate eligibility" />
      ) : (
        <OneAtATime
          rows={rows}
          fields={OBLIGATION_FIELDS}
          summary={(row, index) => [row.loan_type, row.bank_name].filter(Boolean).join(" · ") || `Existing loan ${index + 1}`}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    </SectionShell>
  );
}

const CO_APP_FIELDS: CrmFieldConfig[] = [
  { key: "relation", label: "Relation", type: "select", options: ["Spouse", "Father", "Mother", "Sibling", "Business partner", "Other"] },
  { key: "full_name", label: "Full Name" },
  { key: "mobile", label: "Mobile", type: "tel" },
  { key: "pan", label: "PAN" },
  { key: "aadhaar", label: "Aadhaar" },
  { key: "employment_type", label: "Employment Type", type: "select", options: ["Salaried", "Self-employed", "Business", "Other"] },
  { key: "income", label: "Monthly Income (₹)", type: "number" },
  { key: "obligations_summary", label: "Obligations", type: "textarea", colSpan: 2 },
  { key: "cibil_score", label: "CIBIL (placeholder)", type: "number" },
];

export function CoApplicantsSection({
  rows,
  onChange,
  onAdd,
  onRemove,
  completion,
}: {
  rows: CoApplicant[];
  onChange: (row: CoApplicant, key: string, value: unknown) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  completion: number;
}) {
  return (
    <SectionShell
      title="Co-Applicants"
      icon={Users}
      completion={completion}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Co-Applicant
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyBlock message="No co-applicants" hint="Add co-applicant for joint applications" />
      ) : (
        <OneAtATime
          rows={rows}
          fields={CO_APP_FIELDS}
          summary={(row, index) => row.full_name || `Co-applicant ${index + 1}`}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    </SectionShell>
  );
}

function listedProduct(value: string | null | undefined) {
  const raw = (value || "").toLowerCase();
  const exact = PRODUCT_TYPES.find((item) => item.toLowerCase() === raw);
  if (exact) return exact;
  if (raw.includes("personal")) return "Personal Loan";
  if (raw.includes("home")) return "Home Loan";
  if (raw.includes("business") || raw.includes("msme")) return "Business Loan";
  if (raw.includes("lap") || raw.includes("property")) return "LAP";
  if (raw.includes("auto") || raw.includes("car")) return "Auto Loan";
  if (raw.includes("insurance")) return "Insurance";
  if (raw.includes("card")) return "Credit Card";
  if (raw === "od" || raw.includes("overdraft")) return "OD";
  if (raw === "cc" || raw.includes("cash credit")) return "CC";
  return "";
}

export function LoanRequirementsSection({
  rows,
  onChange,
  onAdd,
  completion,
}: {
  rows: LoanRequirement[];
  onChange: (row: LoanRequirement, patch: Partial<LoanRequirement>) => void;
  onAdd: (product?: string) => void;
  completion: number;
}) {
  const selected = listedProduct(rows[0]?.product_type);
  const pick = (product: string) => {
    const row = rows[0];
    if (row) onChange(row, { product_type: product });
    else onAdd(product);
  };

  return (
    <SectionShell
      title="Product"
      description="Select one. It is saved on this case."
      icon={FileStack}
      completion={completion}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {PRODUCT_TYPES.map((product) => {
          const on = selected === product;
          return (
            <button
              key={product}
              type="button"
              onClick={() => pick(product)}
              className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                on
                  ? "border-[#10662A] bg-[#E8F7EC] text-[#0D4F20]"
                  : "border-[#d8ecdd] bg-white text-[#390A5D] hover:bg-[#F4FBF6]"
              }`}
            >
              {product}
              <span className={`text-[11px] font-bold uppercase ${on ? "text-[#10662A]" : "text-[#8a7aa0]"}`}>
                {on ? "Selected" : "Select"}
              </span>
            </button>
          );
        })}
      </div>
    </SectionShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-lg font-bold mt-1">{value}</div>
    </div>
  );
}

export function DocumentsSection({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SectionShell title="Documents" description="KYC and income proofs" icon={FolderOpen}>
      {children}
    </SectionShell>
  );
}

export function ProcessingSection({
  values,
  onChange,
}: {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const fields: CrmFieldConfig[] = [
    { key: "processing_status", label: "Processing Status", type: "select", options: ["Not started", "Logged in", "Under review", "Sanctioned", "Disbursed", "Rejected"] },
    { key: "lender_name", label: "Lender / Bank" },
    { key: "login_id", label: "Login / File ID" },
    { key: "login_date", label: "Login Date", type: "date" },
    { key: "sanction_amount", label: "Sanction Amount (₹)", type: "number" },
    { key: "sanctioned_roi", label: "Sanctioned ROI (%)", type: "number" },
    { key: "loan_account_no", label: "Loan Account No." },
    { key: "rm_name", label: "RM / Banker" },
    { key: "rejection_reason", label: "Rejection Reason", type: "textarea", colSpan: 2 },
  ];
  return (
    <SectionShell title="Bank Processing" icon={Building2}>
      <CrmFormGrid fields={fields} values={values} onChange={onChange} />
    </SectionShell>
  );
}

