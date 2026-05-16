import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "./shared/SectionShell";
import { CrmFormGrid } from "./shared/CrmFormGrid";
import { RepeatableBlock } from "./shared/RepeatableBlock";
import { EmptyBlock } from "./shared/EmptyBlock";
import { PERSONAL_FIELDS, employmentFields, productExtraFields } from "@/lib/customer-crm/field-config";
import { ACCOUNT_TYPES, LOAN_TYPES, PRODUCT_TYPES, amountLabel } from "@/lib/customer-crm/constants";
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
      description="Add all active bank accounts"
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
        <div className="space-y-4">
          {accounts.map((row, i) => (
            <RepeatableBlock key={row.id} title="Bank Account" index={i} onRemove={() => onRemove(row.id)}>
              <CrmFormGrid fields={BANK_FIELDS} values={row as unknown as Record<string, unknown>} onChange={(k, v) => onChange(row, k, v)} />
            </RepeatableBlock>
          ))}
        </div>
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
        <div className="space-y-4">
          {rows.map((row, i) => (
            <RepeatableBlock key={row.id} title="Existing Loan" index={i} onRemove={() => onRemove(row.id)}>
              <CrmFormGrid fields={OBLIGATION_FIELDS} values={row as unknown as Record<string, unknown>} onChange={(k, v) => onChange(row, k, v)} />
            </RepeatableBlock>
          ))}
        </div>
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
        <div className="space-y-4">
          {rows.map((row, i) => (
            <RepeatableBlock key={row.id} title="Co-Applicant" index={i} onRemove={() => onRemove(row.id)}>
              <CrmFormGrid fields={CO_APP_FIELDS} values={row as unknown as Record<string, unknown>} onChange={(k, v) => onChange(row, k, v)} />
            </RepeatableBlock>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function loanRowValues(row: LoanRequirement): Record<string, unknown> {
  const extra = row.extra_fields ?? {};
  return {
    ...row,
    extra_builder: extra.builder ?? "",
    extra_occupancy: extra.occupancy ?? "",
  };
}

function patchLoanRow(row: LoanRequirement, key: string, value: unknown): Partial<LoanRequirement> {
  if (key.startsWith("extra_")) {
    const field = key.replace("extra_", "");
    return { extra_fields: { ...(row.extra_fields ?? {}), [field]: value } };
  }
  if (key === "loan_amount" || key === "property_value" || key === "tenure_months" || key === "roi_percent") {
    const n = value === "" || value == null ? null : Number(String(value).replace(/,/g, ""));
    return { [key]: Number.isFinite(n) ? n : null } as Partial<LoanRequirement>;
  }
  return { [key]: value } as Partial<LoanRequirement>;
}

export function LoanRequirementsSection({
  rows,
  onChange,
  onAdd,
  onRemove,
  completion,
}: {
  rows: LoanRequirement[];
  onChange: (row: LoanRequirement, patch: Partial<LoanRequirement>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  completion: number;
}) {
  return (
    <SectionShell
      title="Loan Requirements"
      description="Product-wise requirements — use Requested Amount / Loan Amount"
      icon={FileStack}
      completion={completion}
      action={
        <Button type="button" size="sm" onClick={onAdd}>
          <Plus className="size-4 mr-1" /> Add Product Requirement
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyBlock message="No product requirements" hint="Add each product the customer needs" />
      ) : (
        <div className="space-y-6">
          {rows.map((row, i) => {
            const amtLabel = amountLabel(row.product_type);
            const baseFields: CrmFieldConfig[] = [
              { key: "product_type", label: "Product Type", type: "select", options: [...PRODUCT_TYPES] },
              { key: "loan_amount", label: amtLabel, type: "number" },
              { key: "tenure_months", label: "Tenure (months)", type: "number" },
              { key: "roi_percent", label: "ROI (%)", type: "number" },
              { key: "purpose", label: "Purpose", colSpan: 2 },
              { key: "has_existing_loan", label: "Existing Loan?", type: "switch" },
              { key: "balance_transfer", label: "Balance Transfer?", type: "switch" },
              { key: "top_up_required", label: "Top-up Required?", type: "switch" },
            ];
            const extras = productExtraFields(row.product_type).map((f) =>
              f.key.startsWith("extra_") ? f : { ...f, key: f.key === "property_value" ? "property_value" : f.key },
            );
            return (
              <RepeatableBlock key={row.id} title="Product" index={i} onRemove={() => onRemove(row.id)}>
                <CrmFormGrid
                  fields={[...baseFields, ...extras]}
                  values={loanRowValues(row)}
                  onChange={(k, v) => onChange(row, patchLoanRow(row, k, v))}
                />
              </RepeatableBlock>
            );
          })}
        </div>
      )}
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
