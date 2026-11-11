import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Phone, Copy, CheckCircle2 } from "lucide-react";
import { EMPLOYMENT_TYPES, PRODUCT_TYPES } from "@/lib/customer-crm/constants";
import { insertLoanRequirement, insertObligation, updateLoanRequirement, updateObligation } from "@/lib/customer-crm/api";
import type { CustomerDocument } from "@/lib/customer-crm/phase3-api";
import type { CustomerProfile, LoanRequirement, Obligation, PurchaseContext } from "@/lib/customer-crm/types";

const CIBIL_BANDS = [
  { id: "unknown", label: "Does not know" },
  { id: "750+", label: "Above 750" },
  { id: "700", label: "700 to 750" },
  { id: "low", label: "Below 700" },
] as const;

const CALL_EMI = "Call total";

type Props = {
  purchase: PurchaseContext;
  profile: CustomerProfile;
  loans: LoanRequirement[];
  obligations: Obligation[];
  documents: CustomerDocument[];
  userId: string;
  saveProfile: (patch: Partial<CustomerProfile>) => Promise<boolean>;
  reload: () => Promise<void> | void;
};

function hasFile(documents: CustomerDocument[], slug: string) {
  return documents.some((doc) => doc.doc_slug === slug && (doc.file_name || doc.file_url || doc.storage_path));
}

function docList(employment: string, product: string) {
  const home = product.toLowerCase().includes("home");
  const salaried = employment === "Salaried";
  const rows = ["PAN card", "Aadhaar", salaried ? "6 month bank statement" : "12 month bank statement"];
  if (salaried) rows.push("Last 3 salary slips");
  else rows.push("Last ITR");
  if (home) rows.push("Property city and rough property value");
  return rows;
}

export function FirstCallSheet({ purchase, profile, loans, obligations, documents, userId, saveProfile, reload }: Props) {
  const lead = purchase.lead;
  const loan = loans[0];
  const callEmi = obligations.find((row) => row.loan_type === CALL_EMI);
  const [product, setProduct] = useState(loan?.product_type || lead?.product_subtype || "Personal Loan");
  const [amount, setAmount] = useState(String(loan?.loan_amount || lead?.loan_amount || ""));
  const [employment, setEmployment] = useState(profile.employment_type || lead?.employment_type || "Salaried");
  const [income, setIncome] = useState(String(profile.monthly_income || profile.net_salary || lead?.monthly_income || ""));
  const [salaryMode, setSalaryMode] = useState(profile.salary_mode || "Bank transfer");
  const [emi, setEmi] = useState(String(callEmi?.emi ?? obligations.reduce((sum, row) => sum + (Number(row.emi) || 0), 0) || ""));
  const [cibil, setCibil] = useState(String((loan?.extra_fields as { cibil_band?: string } | undefined)?.cibil_band || "unknown"));
  const [propertyValue, setPropertyValue] = useState(String(loan?.property_value || ""));
  const [saving, setSaving] = useState(false);

  const incomeNum = Number(income) || 0;
  const emiNum = Number(emi) || 0;
  const foir = incomeNum > 0 ? Math.round((emiNum / incomeNum) * 100) : null;
  const room = incomeNum > 0 ? Math.max(0, Math.round(incomeNum * 0.55 - emiNum)) : null;
  const saved = Boolean(profile.employment_type && (profile.monthly_income || profile.net_salary));
  const panOnFile = hasFile(documents, "pan_card");
  const statementOnFile = hasFile(documents, "bank_statement");
  const ready = saved && panOnFile && statementOnFile;
  const docs = useMemo(() => docList(employment, product), [employment, product]);
  const phone = (lead?.full_phone || profile.mobile || "").replace(/\D/g, "").slice(-10);

  const askText = [
    `Hi ${lead?.applicant_name || profile.full_name || ""}, please send these on WhatsApp for the ${product} file:`,
    ...docs.map((item, index) => `${index + 1}. ${item}`),
    "Account number and IFSC will be read from the statement. No need to type them.",
  ].join("\n");

  const save = async () => {
    if (!product || !incomeNum) {
      toast.error("Product and monthly income are required on the call");
      return;
    }
    setSaving(true);
    try {
      const profileOk = await saveProfile({
        employment_type: employment,
        monthly_income: incomeNum,
        net_salary: employment === "Salaried" ? incomeNum : profile.net_salary,
        salary_mode: salaryMode,
      });
      if (!profileOk) return;

      const loanPatch = {
        product_type: product,
        loan_amount: Number(amount) || null,
        property_value: product.toLowerCase().includes("home") ? Number(propertyValue) || null : loan?.property_value ?? null,
        extra_fields: { ...(loan?.extra_fields || {}), cibil_band: cibil },
      };
      if (loan) {
        const updated = await updateLoanRequirement(loan.id, loanPatch);
        if (updated.error) throw new Error(updated.error.message);
      } else {
        const created = await insertLoanRequirement({
          customer_profile_id: profile.id,
          lead_purchase_id: purchase.id,
          dsa_id: userId,
          tenure_months: null,
          purpose: null,
          has_existing_loan: emiNum > 0,
          balance_transfer: false,
          top_up_required: false,
          insurance_type: null,
          sort_order: 0,
          ...loanPatch,
        });
        if (created.error) throw new Error(created.error.message);
      }

      if (callEmi) {
        const updated = await updateObligation(callEmi.id, { emi: emiNum, loan_type: CALL_EMI, bank_name: "Total told on the call" });
        if (updated.error) throw new Error(updated.error.message);
      } else if (emiNum > 0) {
        const created = await insertObligation({
          customer_profile_id: profile.id,
          lead_purchase_id: purchase.id,
          dsa_id: userId,
          loan_type: CALL_EMI,
          bank_name: "Total told on the call",
          emi: emiNum,
          outstanding_amount: null,
          sanction_amount: null,
          remaining_tenure: null,
          start_date: null,
          overdue_status: null,
          sort_order: obligations.length,
        });
        if (created.error) throw new Error(created.error.message);
      }
      await reload();
      toast.success("Call facts saved. Ask for documents next.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the call");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_24px_rgba(16,102,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#10662A]">First call</p>
          <h2 className="mt-1 font-display text-xl font-bold text-[#390A5D]">Only what the customer can say now</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
            Do not ask PAN, Aadhaar, account number or IFSC on this call. Those come from the documents.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ready ? "bg-[#E8F7EC] text-[#0D4F20]" : "bg-[#F4F0FA] text-[#390A5D]"}`}>
          {ready ? "Ready for the backend team" : saved ? "Waiting for PAN and statement" : "Call not saved"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-xs font-semibold text-[#5c4d72]">
          Loan
          <select className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm text-[#14281c]" value={product} onChange={(e) => setProduct(e.target.value)}>
            {PRODUCT_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Amount needed (₹)
          <input className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Work
          <select className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm text-[#14281c]" value={employment} onChange={(e) => setEmployment(e.target.value)}>
            {EMPLOYMENT_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Monthly income (₹)
          <input className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Income reaches
          <select className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm text-[#14281c]" value={salaryMode} onChange={(e) => setSalaryMode(e.target.value)}>
            <option>Bank transfer</option>
            <option>Cash</option>
            <option>Cheque</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          Total EMI already running (₹)
          <input className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm" inputMode="numeric" value={emi} onChange={(e) => setEmi(e.target.value.replace(/[^\d]/g, ""))} placeholder="0 if none" />
        </label>
        <label className="text-xs font-semibold text-[#5c4d72]">
          CIBIL, if they know it
          <select className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm text-[#14281c]" value={cibil} onChange={(e) => setCibil(e.target.value)}>
            {CIBIL_BANDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {product.toLowerCase().includes("home") && (
          <label className="text-xs font-semibold text-[#5c4d72]">
            Rough property value (₹)
            <input className="mt-1 h-10 w-full rounded-lg border border-[#d8ecdd] px-2 text-sm" inputMode="numeric" value={propertyValue} onChange={(e) => setPropertyValue(e.target.value.replace(/[^\d]/g, ""))} />
          </label>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save call facts"}
        </button>
        {foir != null && (
          <p className="text-sm text-[#14281c]">
            Existing EMI is <strong>{foir}%</strong> of income.
            {room != null && room > 0 ? ` About ₹${room.toLocaleString("en-IN")} a month is still free for a new EMI.` : " This income is already tight."}
            {cibil === "low" ? " A score under 700 needs a careful lender." : ""}
          </p>
        )}
      </div>

      {saved && (
        <div className="mt-4 rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0D4F20]">
            <Phone className="size-4" /> Send this list. Do not ask it on the call.
          </div>
          <ul className="mt-2 space-y-1 text-sm text-[#14281c]">
            {docs.map((item) => <li key={item}>{item}</li>)}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] bg-white px-3 py-1.5 text-xs font-semibold text-[#390A5D]"
              onClick={() => {
                void navigator.clipboard.writeText(askText);
                toast.success("Document list copied");
              }}
            >
              <Copy className="size-3.5" /> Copy WhatsApp text
            </button>
            {phone.length === 10 && (
              <a className="inline-flex items-center gap-1.5 rounded-lg bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white" href={`https://wa.me/91${phone}?text=${encodeURIComponent(askText)}`} target="_blank" rel="noreferrer">
                Open WhatsApp
              </a>
            )}
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-[#5c4d72]">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#10662A]" />
            Upload PAN and the statement in Documents. Account number, IFSC and average balance stay blank until the statement is read. Forward to the backend team only after both files are on this case.
          </p>
        </div>
      )}
    </section>
  );
}
