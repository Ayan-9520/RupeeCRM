import { jsPDF } from "jspdf";
import type { InvoiceCase, PayoutRequest } from "@/lib/python-api";

type Line = {
  description: string;
  disbursed: number;
  commission: number;
};

export type InvoicePdfInput = {
  number: string;
  createdAt?: string | null;
  partnerName: string;
  partnerEmail?: string | null;
  statusLabel?: string | null;
  amount: number;
  gstAmount?: number | null;
  tdsAmount?: number | null;
  netPayable?: number | null;
  utr?: string | null;
  paymentMode?: string | null;
  bank: Record<string, unknown>;
  lines: Line[];
};

const BILL_TO = ["RupeeDial", "New Delhi 110055, India", "+91 79829 53129", "info@rupeedial.com"];

function money(n: number) {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function invoiceLines(row: PayoutRequest, cases: InvoiceCase[]): Line[] {
  const ids = new Set(
    Array.isArray(row.bank_snapshot?.case_ids) ? (row.bank_snapshot.case_ids as unknown[]).map(String) : [],
  );
  const matched = cases.filter((item) => ids.has(item.purchase_id));
  if (matched.length) {
    return matched.map((item) => ({
      description: [item.applicant_name, item.product, item.city].filter(Boolean).join(" | "),
      disbursed: item.disbursed,
      commission: item.commission,
    }));
  }
  const disbursed = Number(row.bank_snapshot?.disbursed_total || 0);
  return [{ description: "Commission on disbursed cases", disbursed, commission: row.amount }];
}

export function downloadInvoicePdf(input: InvoicePdfInput) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const gstin = text(input.bank.gstin);
  const title = gstin ? "TAX INVOICE" : "INVOICE";
  const pageWidth = 210;
  let y = 18;

  doc.setFillColor(16, 102, 42);
  doc.rect(0, 0, pageWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("RUPEEDIAL ONE", 14, 8);
  doc.text(title, pageWidth - 14, 8, { align: "right" });

  doc.setTextColor(20, 40, 28);
  doc.setFontSize(16);
  doc.text(input.number, 14, y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const when = input.createdAt ? new Date(input.createdAt).toLocaleString("en-IN") : "";
  doc.text([when, input.statusLabel || ""].filter(Boolean).join(" | "), 14, y + 14);

  y += 24;
  doc.setDrawColor(216, 236, 221);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  const from = [
    text(input.bank.account_holder) || input.partnerName,
    input.partnerEmail || "",
    text(input.bank.pan) ? `PAN ${text(input.bank.pan)}` : "",
    gstin ? `GSTIN ${gstin}` : "GSTIN not provided",
    [text(input.bank.bank_name), text(input.bank.account_number), text(input.bank.ifsc)].filter(Boolean).join(" | "),
  ].filter(Boolean);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(16, 102, 42);
  doc.text("FROM (PARTNER)", 14, y);
  doc.text("BILL TO", 120, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(20, 40, 28);
  from.forEach((line, i) => doc.text(line, 14, y + 6 + i * 5));
  BILL_TO.forEach((line, i) => doc.text(line, 120, y + 6 + i * 5));
  y += 8 + Math.max(from.length, BILL_TO.length) * 5 + 4;

  const cols = [14, 112, 146, 176];
  doc.setFillColor(244, 251, 246);
  doc.rect(14, y, pageWidth - 28, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("CASE", cols[0] + 2, y + 5);
  doc.text("DISBURSED", cols[1], y + 5);
  doc.text("COMMISSION", cols[2], y + 5);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const line of input.lines) {
    if (y > 250) {
      doc.addPage();
      y = 18;
    }
    const wrapped = doc.splitTextToSize(line.description || "Case", 90);
    doc.text(wrapped, cols[0] + 2, y);
    doc.text(money(line.disbursed), cols[1], y);
    doc.text(money(line.commission), cols[2], y);
    y += Math.max(6, wrapped.length * 4.5);
  }

  y += 4;
  doc.line(120, y, pageWidth - 14, y);
  y += 7;
  const gst = Number(input.gstAmount || 0);
  const tds = Number(input.tdsAmount || 0);
  const net = Number(input.netPayable ?? input.amount);
  const totals: [string, string][] = [
    ["Commission", money(input.amount)],
    ["GST", gst > 0 ? money(gst) : "0.00"],
    ["TDS deducted", tds > 0 ? `-${money(tds)}` : "0.00"],
    ["Net payable", money(net)],
  ];
  totals.forEach(([label, value], index) => {
    const last = index === totals.length - 1;
    doc.setFont("helvetica", last ? "bold" : "normal");
    doc.text(label, 122, y);
    doc.text(`Rs ${value}`, pageWidth - 14, y, { align: "right" });
    y += 6;
  });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const pay = [input.paymentMode, input.utr].filter(Boolean).join(" | ");
  const notes = [
    "Commission on disbursed loan cases handled through RupeeDial.",
    gstin ? "GST is added because a GSTIN is on this invoice." : "GST is not added because no GSTIN was on the partner profile.",
    "TDS is deducted from the commission before payment.",
    pay ? `Payment: ${pay}` : "Payment is released after Accounts marks this invoice paid.",
  ];
  notes.forEach((line) => {
    doc.text(line, 14, y);
    y += 4.5;
  });

  doc.save(`${input.number.replace(/[^\w.-]+/g, "_")}.pdf`);
}
