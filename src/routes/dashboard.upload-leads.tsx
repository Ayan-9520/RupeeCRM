import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";
import { uploadCrmLeads } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/upload-leads")({
  head: () => ({ meta: [{ title: "Upload leads — RupeeOne" }] }),
  component: UploadLeadsPage,
});

const SAMPLE = `name,phone,city,product,loan_amount,monthly_income,employment,email
Aarav Sharma,9810012345,New Delhi,personal-loan,500000,45000,salaried,
Meera Iyer,9820012345,Mumbai,home-loan,2500000,80000,salaried,
Pooja Reddy,9830012345,Bengaluru,credit-card,0,60000,salaried,
Rahul Mehta,9840012345,Indore,insurance,0,40000,salaried,
`;

function downloadSample() {
  const blob = new Blob([SAMPLE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "rupeeone-lead-upload.csv";
  link.click();
  URL.revokeObjectURL(url);
}

const MANUAL_PRODUCTS = [
  ["personal-loan", "Personal loan"],
  ["home-loan", "Home loan"],
  ["lap-loan", "LAP"],
  ["auto-loan", "Auto loan"],
  ["business-loan", "Business loan"],
  ["credit-card", "Credit card"],
  ["insurance", "Insurance"],
] as const;

function UploadLeadsPage() {
  const { role } = useAuth();
  const admin = isPlatformAdmin(role);
  const [file, setFile] = useState<File | null>(null);
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: { row: number; reason: string }[]; published: boolean; campaign: string } | null>(null);
  const [manual, setManual] = useState({ name: "", phone: "", city: "", product: "personal-loan", amount: "", income: "" });

  const addOne = async () => {
    const phone = manual.phone.replace(/\D/g, "").slice(-10);
    if (!manual.name.trim() || phone.length !== 10 || !manual.city.trim()) {
      toast.error("Name, a 10-digit phone, and city are required");
      return;
    }
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const line = [manual.name.trim(), phone, manual.city.trim(), manual.product, manual.amount || "0", manual.income || "0", "", ""].map(cell).join(",");
    const file = new File([`name,phone,city,product,loan_amount,monthly_income,employment,email\n${line}\n`], "one-lead.csv", { type: "text/csv" });
    setBusy(true);
    try {
      const data = await uploadCrmLeads(file, "manual", admin);
      setResult(data);
      if (data.added) {
        setManual({ name: "", phone: "", city: "", product: "personal-loan", amount: "", income: "" });
        toast.success(data.published ? "Lead added to the leadboard" : "Lead added to My Leads");
      } else {
        toast.error(data.skipped[0]?.reason || "This lead was not added");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add the lead");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!file) {
      toast.error("Choose a CSV file");
      return;
    }
    setBusy(true);
    try {
      const data = await uploadCrmLeads(file, campaign.trim(), admin);
      setResult(data);
      toast.success(data.added ? `${data.added} lead${data.added === 1 ? "" : "s"} added` : "No new leads were added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Upload leads</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          {admin
            ? "An admin upload goes on the Leadboard for every partner. It is not kept in your private My Leads."
            : "These rows are marked upload, not a campaign form. A campaign name only groups the sheet. They open in your My Leads, and the wallet is not charged."}
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <h2 className="font-semibold text-[#390A5D]">Add one lead</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} placeholder="Customer name" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <input value={manual.phone} onChange={(event) => setManual({ ...manual, phone: event.target.value })} placeholder="10-digit phone" inputMode="numeric" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <input value={manual.city} onChange={(event) => setManual({ ...manual, city: event.target.value })} placeholder="City" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <select value={manual.product} onChange={(event) => setManual({ ...manual, product: event.target.value })} className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm text-[#14281c]">
            {MANUAL_PRODUCTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input value={manual.amount} onChange={(event) => setManual({ ...manual, amount: event.target.value.replace(/[^\d]/g, "") })} placeholder="Loan amount" inputMode="numeric" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
          <input value={manual.income} onChange={(event) => setManual({ ...manual, income: event.target.value.replace(/[^\d]/g, "") })} placeholder="Monthly income" inputMode="numeric" className="h-10 rounded-xl border border-[#d8ecdd] px-3 text-sm" />
        </div>
        <button type="button" disabled={busy} onClick={() => void addOne()} className="rounded-xl bg-[#0D4F20] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Add to My Leads"}
        </button>
      </section>

      <section className="space-y-4 rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[#390A5D]">Sheet</h2>
          <button type="button" onClick={downloadSample} className="text-sm font-semibold text-[#10662A] underline">
            Download sample CSV
          </button>
        </div>
        <p className="text-xs text-[#5c4d72]">
          Excel (.xlsx) or CSV. Columns: name, phone, city, product, loan_amount, monthly_income, employment, email. Products: personal-loan, home-loan, lap-loan, auto-loan, msme-loan, mudra-loan, education-loan, machinery-loan, business-loan, bnpl, credit-card, insurance, investment. Up to 200 rows. A caller or partner file lands in My Leads. The wallet is not charged.
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
          }}
          className="block w-full text-sm text-[#14281c] file:mr-3 file:rounded-xl file:border-0 file:bg-[#E8F7EC] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#0e4d28]"
        />
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Campaign name</span>
          <span className="ml-1 text-[#5c4d72]">optional</span>
          <input
            value={campaign}
            onChange={(event) => setCampaign(event.target.value)}
            placeholder="diwali-facebook"
            maxLength={120}
            className="mt-1 h-10 w-full rounded-xl border border-[#d8ecdd] px-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {busy ? "Uploading…" : "Upload"}
        </button>
      </section>

      {result ? (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
          <p className="font-semibold text-[#390A5D]">
            {result.added} added{result.campaign ? ` · ${result.campaign}` : ""} · {result.published ? "on the leadboard" : "in My Leads"}
          </p>
          {result.skipped.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-[#5c4d72]">
              {result.skipped.map((item) => (
                <li key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#5c4d72]">Every row was accepted.</p>
          )}
          {!result.published && result.added > 0 ? (
            <Link to="/dashboard/my-leads" className="mt-3 inline-block text-sm font-semibold text-[#10662A] underline">
              Open My Leads
            </Link>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
