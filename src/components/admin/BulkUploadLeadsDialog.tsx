import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, X, CheckCircle2, AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";
import type { ProductCategory, ProductType } from "@/lib/products";

type ParsedRow = {
  applicant_name: string;
  full_phone: string;
  city: string;
  product_type_code: string;
  loan_amount: number;
  email?: string;
  monthly_income?: number;
  state?: string;
  source?: string;
  price?: number;
  score?: "cold" | "warm" | "hot";
  _error?: string;
};

const TEMPLATE_HEADER = [
  "applicant_name",
  "full_phone",
  "city",
  "product_type_code",
  "loan_amount",
  "email",
  "monthly_income",
  "state",
  "source",
  "price",
  "score",
];

const SAMPLE = [
  "Rahul Sharma,9876543210,Mumbai,personal_loan,500000,rahul@email.com,75000,Maharashtra,Bulk import,99,warm",
  "Priya Verma,9123456789,Pune,home_loan,3500000,priya@email.com,120000,Maharashtra,Bulk import,149,hot",
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    // simple CSV split (no embedded commas)
    rows.push(line.split(",").map((c) => c.trim()));
  }
  return rows;
}

function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

export function BulkUploadLeadsDialog({
  open,
  onClose,
  onImported,
  productTypes,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  productTypes: ProductType[];
}) {
  const [csvText, setCsvText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const codeMap = useMemo(() => Object.fromEntries(productTypes.map((p) => [p.code, p])) as Record<string, ProductType>, [productTypes]);

  if (!open) return null;

  const reset = () => {
    setCsvText("");
    setParsed(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADER.join(","), ...SAMPLE].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leadmines-leads-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (f: File) => {
    const text = await f.text();
    setCsvText(text);
    parse(text);
  };

  const parse = (text: string) => {
    setParsing(true);
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast.error("CSV needs a header row plus at least 1 data row");
      setParsing(false);
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const out: ParsedRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (k: string) => {
        const j = idx(k);
        return j >= 0 && r[j] ? r[j] : "";
      };
      const row: ParsedRow = {
        applicant_name: get("applicant_name"),
        full_phone: get("full_phone").replace(/\D/g, ""),
        city: get("city"),
        product_type_code: get("product_type_code"),
        loan_amount: Number(get("loan_amount")) || 0,
        email: get("email") || undefined,
        monthly_income: Number(get("monthly_income")) || undefined,
        state: get("state") || undefined,
        source: get("source") || "Bulk import",
        price: Number(get("price")) || undefined,
        score: (get("score") || "").toLowerCase() as "cold" | "warm" | "hot" | undefined,
      };
      const errs: string[] = [];
      if (!row.applicant_name) errs.push("name missing");
      if (!row.full_phone || row.full_phone.length < 10) errs.push("invalid phone");
      if (!row.city) errs.push("city missing");
      if (!row.product_type_code || !codeMap[row.product_type_code]) errs.push(`unknown product code '${row.product_type_code}'`);
      if (!row.loan_amount) errs.push("loan_amount missing");
      if (row.score && !["cold", "warm", "hot"].includes(row.score)) errs.push("invalid score");
      if (errs.length) row._error = errs.join(", ");
      out.push(row);
    }
    setParsed(out);
    setParsing(false);
  };

  const importValid = async () => {
    if (!parsed) return;
    const valid = parsed.filter((r) => !r._error);
    if (valid.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setImporting(true);
    const errors: string[] = [];
    let success = 0;
    let failed = 0;
    for (const r of valid) {
      const pt = codeMap[r.product_type_code];
      const cat = pt.category as ProductCategory;
      const loanType =
        cat === "loan" ? (pt.code.includes("home") ? "home" : pt.code.includes("business") ? "business" : "personal")
        : cat === "credit_card" ? "credit_card"
        : cat === "insurance" ? "insurance"
        : "mutual_fund";
      const productDetails: Record<string, unknown> = {};
      if (r.monthly_income) productDetails.monthly_income = r.monthly_income;
      const insertRow = {
        applicant_name: r.applicant_name,
        full_phone: r.full_phone,
        masked_phone: maskPhone(r.full_phone),
        city: r.city,
        state: r.state ?? null,
        email: r.email ?? null,
        product_category: cat,
        product_type_id: pt.id,
        product_subtype: pt.name,
        product_details: productDetails as Json,
        loan_type: loanType as "personal" | "home" | "business" | "credit_card" | "insurance" | "mutual_fund",
        loan_amount: r.loan_amount,
        monthly_income: r.monthly_income ?? null,
        source: r.source ?? "Bulk import",
        score: r.score ?? "warm",
        price: r.price ?? pt.default_lead_price ?? 99,
        sale_available: true,
        status: "available" as const,
        is_marketplace: true,
      };
      const { error } = await supabase.from("leads").insert([insertRow]);
      if (error) {
        failed++;
        if (errors.length < 5) errors.push(`${r.applicant_name}: ${error.message}`);
      } else {
        success++;
      }
    }
    setImporting(false);
    setResult({ success, failed, errors });
    if (success > 0) {
      toast.success(`Imported ${success} lead${success > 1 ? "s" : ""}`);
      onImported();
    }
  };

  const validCount = parsed?.filter((r) => !r._error).length ?? 0;
  const errorCount = parsed?.filter((r) => r._error).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={handleClose}>
      <div
        className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-card border border-border shadow-elevated flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-accent/15 text-accent grid place-items-center">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <h3 className="font-display font-bold">Bulk import leads</h3>
              <p className="text-xs text-muted-foreground">Upload a CSV to add many marketplace leads at once</p>
            </div>
          </div>
          <button onClick={handleClose} className="size-8 rounded-full grid place-items-center hover:bg-secondary">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!parsed && !result && (
            <>
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-semibold">Need a starting point?</div>
                    <div className="text-xs text-muted-foreground">Download our CSV template with sample rows.</div>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-3 h-9 rounded-lg border border-border hover:bg-secondary text-sm font-semibold"
                  >
                    <Download className="size-3.5" /> Download template
                  </button>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground">
                  <strong>Required columns:</strong> applicant_name, full_phone, city, product_type_code, loan_amount.
                  <br />
                  <strong>Optional:</strong> email, monthly_income, state, source, price, score (cold/warm/hot).
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  <strong>Valid product codes:</strong>{" "}
                  <span className="font-mono">{productTypes.map((p) => p.code).join(", ")}</span>
                </div>
              </div>

              <label className="block rounded-xl border-2 border-dashed border-border hover:border-accent/60 hover:bg-accent/5 p-8 text-center cursor-pointer transition-smooth">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
                <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                <div className="text-sm font-semibold">Click to upload CSV</div>
                <div className="text-xs text-muted-foreground mt-1">or paste below</div>
              </label>

              <div>
                <label className="text-xs font-bold uppercase text-muted-foreground mb-1.5 block">Paste CSV</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  rows={6}
                  placeholder={`${TEMPLATE_HEADER.join(",")}\n${SAMPLE[0]}`}
                  className="input-base w-full resize-none font-mono text-xs"
                />
                <button
                  onClick={() => parse(csvText)}
                  disabled={!csvText.trim() || parsing}
                  className="mt-2 inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold disabled:opacity-50"
                >
                  {parsing && <Loader2 className="size-4 animate-spin" />}
                  Parse & preview
                </button>
              </div>
            </>
          )}

          {parsed && !result && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold">
                    <CheckCircle2 className="size-4" /> Valid
                  </div>
                  <div className="font-display text-2xl font-bold mt-1">{validCount}</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
                  <div className="flex items-center gap-2 text-xs uppercase font-bold">
                    <AlertTriangle className="size-4" /> With errors
                  </div>
                  <div className="font-display text-2xl font-bold mt-1">{errorCount}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/40 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Phone</th>
                        <th className="text-left px-3 py-2">City</th>
                        <th className="text-left px-3 py-2">Product</th>
                        <th className="text-left px-3 py-2">Amount</th>
                        <th className="text-left px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((r, i) => (
                        <tr key={i} className={`border-t border-border ${r._error ? "bg-amber-500/5" : ""}`}>
                          <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-3 py-2 font-semibold truncate max-w-[140px]">{r.applicant_name || "—"}</td>
                          <td className="px-3 py-2 font-mono">{r.full_phone || "—"}</td>
                          <td className="px-3 py-2">{r.city || "—"}</td>
                          <td className="px-3 py-2">{r.product_type_code || "—"}</td>
                          <td className="px-3 py-2">₹{r.loan_amount.toLocaleString("en-IN")}</td>
                          <td className="px-3 py-2">
                            {r._error ? (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-300" title={r._error}>
                                {r._error.length > 30 ? r._error.slice(0, 28) + "…" : r._error}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300">OK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => { setParsed(null); setCsvText(""); }}
                  className="px-4 h-10 rounded-xl border border-border hover:bg-secondary text-sm font-semibold"
                >
                  ← Back
                </button>
                <button
                  onClick={importValid}
                  disabled={importing || validCount === 0}
                  className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold shadow-card hover:opacity-90 disabled:opacity-50"
                >
                  {importing && <Loader2 className="size-4 animate-spin" />}
                  Import {validCount} valid lead{validCount === 1 ? "" : "s"}
                </button>
              </div>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="size-5" /> Import complete
                </div>
                <div className="text-sm mt-1">
                  {result.success} lead{result.success === 1 ? "" : "s"} imported
                  {result.failed > 0 && ` · ${result.failed} failed`}
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300 text-xs">
                  <div className="font-bold mb-1">Sample errors:</div>
                  <ul className="space-y-0.5 list-disc pl-4">
                    {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-5 h-10 rounded-xl bg-accent text-accent-foreground text-sm font-bold hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
