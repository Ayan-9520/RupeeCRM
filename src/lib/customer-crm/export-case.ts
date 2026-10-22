import { jsPDF } from "jspdf";
import type { CustomerWorkspaceData } from "./types";
import type { EligibilityEngineResult } from "./eligibility-types";
import { loadDisbursals, loadPayouts, summarizeFinance, type CaseFinanceSummary, type CustomerDisbursal } from "./phase5-api";
import { loadLenderCases, type LenderCase } from "./phase4-api";
import { loadCustomerDocuments, type CustomerDocument } from "./phase3-api";
import { computeCustomerRisk, type CustomerRiskScore } from "./risk-scoring";

type Rgb = [number, number, number];
const GREEN: Rgb = [16, 102, 42];
const PURPLE: Rgb = [57, 10, 93];
const MINT: Rgb = [232, 247, 236];
const ROW_ALT: Rgb = [247, 253, 248];
const BORDER: Rgb = [216, 236, 221];
const MUTED: Rgb = [92, 77, 114];
const INK: Rgb = [30, 27, 46];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 18;

type Cell = string | number | null | undefined;

/** Built-in PDF fonts are Latin-1 only; anything else would print as garbage. */
function clean(value: Cell): string {
  if (value == null) return "";
  return String(value)
    .replace(/₹/g, "Rs ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "")
    .trim();
}

function show(value: Cell): string {
  const text = clean(value);
  return text === "" ? "-" : text;
}

function rs(value: Cell): string {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return "-";
  return `Rs ${Math.round(n).toLocaleString("en-IN")}`;
}

function pct(value: number | null | undefined, digits = 0): string {
  return value == null || !Number.isFinite(value) ? "-" : `${value.toFixed(digits)}%`;
}

function yesNo(value: boolean | null | undefined): string {
  return value ? "Yes" : "No";
}

const ACRONYMS = new Set(["kyc", "itr", "gst", "pan", "emi", "lap", "msme", "od", "cc", "nri", "huf", "llp"]);

function title(value: Cell): string {
  return show(value)
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.replace(/^\w/, (c) => c.toUpperCase())))
    .join(" ");
}

function productLabel(value: Cell): string {
  const raw = clean(value).toLowerCase();
  if (raw.startsWith("loan_")) return title(`${raw.slice(5)} loan`);
  return title(raw);
}

function maskAadhaar(value: Cell): string {
  const digits = clean(value).replace(/\D/g, "");
  return digits.length >= 4 ? `XXXX XXXX ${digits.slice(-4)}` : "-";
}

function fileSafe(name: string): string {
  return clean(name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Customer";
}

class CasePdf {
  doc = new jsPDF({ unit: "mm", format: "a4" });
  y = 0;

  constructor(private generatedAt: string, private reference: string) {
    this.header();
  }

  private header() {
    const d = this.doc;
    d.setFillColor(...GREEN);
    d.rect(0, 0, PAGE_W, 26, "F");
    d.setFillColor(...PURPLE);
    d.rect(0, 26, PAGE_W, 1.4, "F");

    d.setFillColor(255, 255, 255);
    d.roundedRect(M, 7, 12, 12, 2.5, 2.5, "F");
    d.setTextColor(...GREEN);
    d.setFont("helvetica", "bold");
    d.setFontSize(13);
    d.text("R", M + 6, 15.4, { align: "center" });

    d.setTextColor(255, 255, 255);
    d.setFontSize(16);
    d.text("RupeeDial", M + 16, 13.2);
    d.setFont("helvetica", "normal");
    d.setFontSize(8.5);
    d.text("One  |  Customer Case File", M + 16, 18.6);

    d.setFontSize(7.5);
    d.text(`Generated ${this.generatedAt}`, PAGE_W - M, 12.5, { align: "right" });
    d.text(`Ref ${this.reference}`, PAGE_W - M, 17.5, { align: "right" });
    this.y = 34;
  }

  private ensure(space: number) {
    if (this.y + space > BOTTOM) {
      this.doc.addPage();
      this.header();
    }
  }

  customerCard(name: string, lines: string[], chips: [string, string][]) {
    const d = this.doc;
    d.setTextColor(...PURPLE);
    d.setFont("helvetica", "bold");
    d.setFontSize(18);
    d.text(clean(name) || "Customer", M, this.y + 4);
    this.y += 10;
    d.setFont("helvetica", "normal");
    d.setFontSize(9);
    d.setTextColor(...MUTED);
    const info = lines.map(clean).filter(Boolean).join("   |   ");
    if (info) {
      const wrapped = d.splitTextToSize(info, CONTENT_W);
      d.text(wrapped, M, this.y);
      this.y += wrapped.length * 4.2 + 2;
    }
    let x = M;
    d.setFontSize(7.5);
    for (const [label, value] of chips) {
      const text = `${label.toUpperCase()}  ${clean(value) || "-"}`;
      const w = d.getTextWidth(text) + 6;
      if (x + w > PAGE_W - M) {
        x = M;
        this.y += 8;
      }
      d.setFillColor(...MINT);
      d.setDrawColor(...BORDER);
      d.roundedRect(x, this.y, w, 6, 1.5, 1.5, "FD");
      d.setTextColor(...GREEN);
      d.setFont("helvetica", "bold");
      d.text(text, x + 3, this.y + 4.1);
      x += w + 2.5;
    }
    this.y += 11;
  }

  section(name: string) {
    this.ensure(18);
    const d = this.doc;
    d.setFillColor(...MINT);
    d.rect(M, this.y, CONTENT_W, 8, "F");
    d.setFillColor(...GREEN);
    d.rect(M, this.y, 1.6, 8, "F");
    d.setTextColor(...GREEN);
    d.setFont("helvetica", "bold");
    d.setFontSize(10.5);
    d.text(name, M + 5, this.y + 5.5);
    this.y += 11;
  }

  fields(pairs: [string, Cell][], columns = 3) {
    const d = this.doc;
    const colW = CONTENT_W / columns;
    for (let i = 0; i < pairs.length; i += columns) {
      const rowPairs = pairs.slice(i, i + columns);
      const wrapped = rowPairs.map(([, v]) => d.splitTextToSize(show(v), colW - 4) as string[]);
      const lines = Math.max(...wrapped.map((w) => w.length));
      const h = 4 + lines * 4.2 + 2;
      this.ensure(h);
      rowPairs.forEach(([label], j) => {
        const x = M + j * colW;
        d.setFont("helvetica", "bold");
        d.setFontSize(6.8);
        d.setTextColor(...MUTED);
        d.text(label.toUpperCase(), x, this.y + 2.5);
        d.setFont("helvetica", "normal");
        d.setFontSize(9);
        d.setTextColor(...INK);
        d.text(wrapped[j], x, this.y + 6.6);
      });
      this.y += h;
    }
    this.y += 2;
  }

  table(headers: string[], rows: Cell[][], widths: number[]) {
    const d = this.doc;
    const total = widths.reduce((a, b) => a + b, 0);
    const cols = widths.map((w) => (w / total) * CONTENT_W);
    const drawHead = () => {
      d.setFillColor(...PURPLE);
      d.rect(M, this.y, CONTENT_W, 7, "F");
      d.setFont("helvetica", "bold");
      d.setFontSize(7.3);
      d.setTextColor(255, 255, 255);
      let x = M;
      headers.forEach((h, i) => {
        d.text(h.toUpperCase(), x + 2, this.y + 4.7);
        x += cols[i];
      });
      this.y += 7;
    };
    if (!rows.length) {
      this.empty("No records yet.");
      return;
    }
    this.ensure(16);
    drawHead();
    rows.forEach((row, r) => {
      d.setFont("helvetica", "normal");
      d.setFontSize(8.2);
      const wrapped = row.map((cell, i) => d.splitTextToSize(show(cell), cols[i] - 4) as string[]);
      const h = Math.max(...wrapped.map((w) => w.length)) * 3.8 + 3.2;
      if (this.y + h > BOTTOM) {
        d.addPage();
        this.header();
        drawHead();
      }
      if (r % 2 === 1) {
        d.setFillColor(...ROW_ALT);
        d.rect(M, this.y, CONTENT_W, h, "F");
      }
      d.setDrawColor(...BORDER);
      d.line(M, this.y + h, M + CONTENT_W, this.y + h);
      d.setTextColor(...INK);
      d.setFont("helvetica", "normal");
      d.setFontSize(8.2);
      let x = M;
      wrapped.forEach((lines, i) => {
        d.text(lines, x + 2, this.y + 4.2);
        x += cols[i];
      });
      this.y += h;
    });
    this.y += 5;
  }

  empty(text: string) {
    this.ensure(8);
    this.doc.setFont("helvetica", "italic");
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...MUTED);
    this.doc.text(text, M, this.y + 2);
    this.y += 8;
  }

  finish(filename: string) {
    const d = this.doc;
    const pages = d.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      d.setPage(i);
      d.setDrawColor(...GREEN);
      d.setLineWidth(0.4);
      d.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
      d.setFont("helvetica", "normal");
      d.setFontSize(7.2);
      d.setTextColor(...MUTED);
      d.text("RupeeDial One  |  crm.rupeedial.com  |  Confidential - for loan processing only", M, PAGE_H - 7.5);
      d.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - 7.5, { align: "right" });
    }
    d.save(filename);
  }
}

export function buildCaseFilePdf(opts: {
  ws: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
  finance: CaseFinanceSummary;
  lenders: LenderCase[];
  disbursals: CustomerDisbursal[];
  documents: CustomerDocument[];
  risk: CustomerRiskScore;
}): string {
  const { ws, eligibility, pipelineStage, finance, lenders, disbursals, documents, risk } = opts;
  const p = ws.profile;
  const lead = ws.purchase.lead;
  const name = p.full_name || lead?.applicant_name || "Customer";
  const generatedAt = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const pdf = new CasePdf(generatedAt, `RD-${ws.purchase.id.slice(0, 8).toUpperCase()}`);

  pdf.customerCard(
    name,
    [p.mobile || lead?.full_phone || "", p.email || lead?.email || "", [p.city || lead?.city, p.state || lead?.state].filter(Boolean).join(", ")],
    [
      ["Stage", title(pipelineStage)],
      ["Risk", `${title(risk.level)} (${risk.score}/100)`],
      ["Profile", `${p.profile_completion ?? 0}% complete`],
      ["Product", productLabel(lead?.product_subtype || lead?.product_category || ws.loanRequirements[0]?.product_type)],
      ["Next follow-up", ws.purchase.next_followup_at ? new Date(ws.purchase.next_followup_at).toLocaleDateString("en-IN") : "-"],
    ],
  );

  pdf.section("Personal Details");
  pdf.fields([
    ["Full name", p.full_name],
    ["Mobile", p.mobile],
    ["Alternate mobile", p.alternate_mobile],
    ["Email", p.email],
    ["Date of birth", p.dob],
    ["Gender", title(p.gender)],
    ["Marital status", title(p.marital_status)],
    ["Father's name", p.father_name],
    ["Mother's name", p.mother_name],
    ["PAN", p.pan],
    ["Aadhaar", maskAadhaar(p.aadhaar)],
    ["Education", title(p.education)],
    ["Residence type", title(p.residence_type)],
    ["Family members", p.family_members],
    ["Pincode", p.pincode],
    ["Current address", p.current_address],
    ["Permanent address", p.permanent_address],
    ["City / State", [p.city, p.state].filter(Boolean).join(", ")],
  ]);

  pdf.section("Employment & Income");
  pdf.fields([
    ["Employment type", title(p.employment_type)],
    ["Company", p.company_name],
    ["Business name", p.business_name],
    ["Designation", p.designation],
    ["Industry", title(p.industry_type)],
    ["Salary mode", title(p.salary_mode)],
    ["Monthly income", rs(p.monthly_income)],
    ["Net salary", rs(p.net_salary)],
    ["Annual turnover", rs(p.annual_turnover)],
    ["Work experience", p.work_experience],
    ["Business vintage", p.business_vintage],
    ["ITR filed", title(p.itr_filed)],
    ["GST number", p.gst_number],
    ["Office address", p.office_address],
  ]);

  pdf.section("Loan Requirement");
  pdf.table(
    ["Product", "Amount", "Tenure", "ROI", "Purpose", "Property value", "BT / Top-up"],
    ws.loanRequirements.map((l) => [
      title(l.product_type),
      rs(l.loan_amount),
      l.tenure_months ? `${l.tenure_months} months` : "-",
      l.roi_percent != null ? `${l.roi_percent}%` : "-",
      l.purpose,
      rs(l.property_value),
      `${yesNo(l.balance_transfer)} / ${yesNo(l.top_up_required)}`,
    ]),
    [16, 14, 12, 8, 22, 15, 13],
  );

  pdf.section("Banking");
  pdf.table(
    ["Bank", "Type", "Vintage", "Avg balance", "Salary a/c", "EMI bounces", "Statement"],
    ws.bankAccounts.map((b) => [
      b.bank_name,
      title(b.account_type),
      b.account_vintage,
      rs(b.average_balance),
      yesNo(b.is_salary_account),
      b.emi_bounce_history,
      yesNo(b.statement_available),
    ]),
    [20, 13, 12, 15, 11, 13, 12],
  );

  pdf.section("Existing Obligations");
  pdf.table(
    ["Loan type", "Bank", "EMI", "Outstanding", "Sanction", "Tenure left", "Overdue"],
    ws.obligations.map((o) => [
      title(o.loan_type),
      o.bank_name,
      rs(o.emi),
      rs(o.outstanding_amount),
      rs(o.sanction_amount),
      o.remaining_tenure ? `${o.remaining_tenure} months` : "-",
      title(o.overdue_status),
    ]),
    [15, 17, 12, 15, 14, 13, 11],
  );

  pdf.section("Co-applicants");
  pdf.table(
    ["Name", "Relation", "Mobile", "Employment", "Income", "CIBIL"],
    ws.coApplicants.map((c) => [c.full_name, title(c.relation), c.mobile, title(c.employment_type), rs(c.income), c.cibil_score]),
    [22, 14, 16, 16, 15, 9],
  );

  pdf.section("Eligibility & Risk");
  if (eligibility) {
    const m = eligibility.metrics;
    pdf.fields([
      ["Approval chance", pct(m.approvalProbability)],
      ["Eligible amount", rs(m.eligibleAmount)],
      ["Eligible EMI", rs(m.eligibleEmi)],
      ["FOIR", pct(m.foirPercent, 1)],
      ["Estimated ROI", m.estimatedRoi != null ? `${m.estimatedRoi}%` : "-"],
      ["Recommended tenure", m.recommendedTenure ? `${m.recommendedTenure} months` : "-"],
      ["CIBIL", eligibility.risk.cibilScore ?? lead?.cibil_score],
      ["Eligibility", title(eligibility.risk.eligibilityStatus)],
      ["Risk", `${title(risk.level)} (${risk.score}/100)`],
      ["Net monthly income", rs(eligibility.financial.netIncome)],
      ["Total EMI", rs(eligibility.financial.totalEmi)],
      ["Household income", rs(eligibility.financial.householdIncome)],
    ]);
    if (eligibility.lenders.length) {
      pdf.table(
        ["Suggested lender", "Product", "Chance", "Why"],
        eligibility.lenders.slice(0, 5).map((l) => [l.lenderName, title(l.product), `${Math.round(l.approvalChance)}%`, l.reason]),
        [20, 15, 9, 46],
      );
    }
  } else {
    pdf.fields([
      ["Risk", `${title(risk.level)} (${risk.score}/100)`],
      ["CIBIL", lead?.cibil_score],
    ]);
  }

  pdf.section("Lender Cases");
  pdf.table(
    ["Lender", "Branch", "Status", "Login date", "Sanction", "ROI", "Tenure", "Disbursed"],
    lenders.map((l) => [
      l.lender_name,
      l.branch,
      title(l.login_status),
      l.login_date,
      rs(l.sanctioned_amount),
      l.roi != null ? `${l.roi}%` : "-",
      l.tenure ? `${l.tenure} m` : "-",
      rs(l.disbursed_amount),
    ]),
    [17, 13, 13, 12, 14, 8, 9, 14],
  );

  pdf.section("Disbursal & Payout");
  pdf.fields([
    ["Total sanction", rs(finance.totalSanction)],
    ["Total disbursed", rs(finance.totalDisbursed)],
    ["Net disbursal", rs(finance.totalNetDisbursal)],
    ["Payout expected", rs(finance.totalPayoutExpected)],
    ["Payout received", rs(finance.totalPayoutReceived)],
    ["Payout pending", rs(finance.totalPayoutPending)],
  ]);
  if (disbursals.length) {
    pdf.table(
      ["Status", "Sanctioned", "Disbursed", "Net", "EMI", "ROI", "Date", "Credited bank"],
      disbursals.map((r) => [
        title(r.disbursal_status),
        rs(r.sanctioned_amount),
        rs(r.disbursed_amount),
        rs(r.net_disbursal),
        rs(r.emi),
        r.roi != null ? `${r.roi}%` : "-",
        r.disbursal_date,
        r.credited_bank_name,
      ]),
      [15, 14, 14, 13, 11, 9, 12, 14],
    );
  }

  pdf.section("Documents");
  const uploaded = documents.filter((doc) => doc.status !== "pending").length;
  const verified = documents.filter((doc) => doc.status === "verified").length;
  pdf.fields(
    [
      ["Uploaded", `${uploaded} of ${documents.length}`],
      ["Verified", verified],
      ["Pending", documents.length - uploaded],
    ],
    3,
  );
  pdf.table(
    ["Document", "Category", "Status", "File"],
    documents
      .filter((doc) => doc.status !== "pending")
      .map((doc) => [doc.doc_label, title(doc.category), title(doc.status), doc.file_name]),
    [30, 18, 12, 30],
  );

  const filename = `RupeeDial-${fileSafe(name)}.pdf`;
  pdf.finish(filename);
  return filename;
}

/** Loads everything the case file shows, then downloads RupeeDial-<Customer>.pdf. */
export async function downloadCaseFilePdf(opts: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
}): Promise<string> {
  const purchaseId = opts.workspace.profile.lead_purchase_id;
  const [d, p, l, docs] = await Promise.all([
    loadDisbursals(purchaseId),
    loadPayouts(purchaseId),
    loadLenderCases(purchaseId),
    loadCustomerDocuments(purchaseId),
  ]);
  const failed = [d.error, p.error, l.error, docs.error].filter(Boolean);
  if (failed.length) throw new Error(`Could not build the PDF: ${failed[0]}`);
  return buildCaseFilePdf({
    ws: opts.workspace,
    eligibility: opts.eligibility,
    pipelineStage: opts.pipelineStage,
    finance: summarizeFinance(d.rows, p.rows),
    lenders: l.rows,
    disbursals: d.rows,
    documents: docs.docs,
    risk: computeCustomerRisk(opts.workspace, opts.eligibility),
  });
}

export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printCaseSummary() {
  window.print();
}
