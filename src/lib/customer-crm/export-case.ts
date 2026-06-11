import { jsPDF } from "jspdf";
import type { CustomerWorkspaceData } from "./types";
import type { CaseFinanceSummary } from "./phase5-api";
import type { LenderCase } from "./phase4-api";
import type { CustomerRiskScore } from "./risk-scoring";
import { fmtInr } from "./finance-calculators";

export function exportCasePdf(opts: {
  ws: CustomerWorkspaceData;
  finance: CaseFinanceSummary;
  lenders: LenderCase[];
  risk: CustomerRiskScore;
  pipelineStage: string;
}) {
  const { ws, finance, lenders, risk, pipelineStage } = opts;
  const doc = new jsPDF();
  let y = 14;
  const line = (text: string, size = 10, bold = false) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 14, y);
    y += size * 0.5 + 4;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  };

  line("LeadMines — Case Summary", 14, true);
  line(ws.profile.full_name ?? "Customer", 12, true);
  line(`Stage: ${pipelineStage.replace(/_/g, " ")}`, 10);
  line(`Mobile: ${ws.profile.mobile ?? "—"}`, 10);
  y += 4;
  line("Financial Summary", 11, true);
  line(`Sanction: ${fmtInr(finance.totalSanction)}`, 10);
  line(`Disbursed: ${fmtInr(finance.totalDisbursed)}`, 10);
  line(`Net disbursal: ${fmtInr(finance.totalNetDisbursal)}`, 10);
  line(`Payout pending: ${fmtInr(finance.totalPayoutPending)}`, 10);
  y += 4;
  line(`Risk: ${risk.level.toUpperCase()} (${risk.score}/100)`, 10);
  y += 4;
  line("Lender Comparison", 11, true);
  for (const l of lenders) {
    line(
      `${l.lender_name ?? "—"} | ROI ${l.roi ?? "—"}% | Sanction ${fmtInr(l.sanctioned_amount)} | ${l.login_status}`,
      9,
    );
  }
  doc.save(`case-${ws.profile.lead_purchase_id.slice(0, 8)}.pdf`);
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
