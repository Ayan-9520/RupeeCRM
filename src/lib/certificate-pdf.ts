import { jsPDF } from "jspdf";

export type CertificatePayload = {
  fullName: string;
  courseTitle: string;
  badge: string | null;
  scorePercent: number;
  certificateNo: string;
  issuedAt: string; // ISO
};

/**
 * Generates a landscape A4 PDF certificate and triggers download.
 * Returns the data URL so it can also be uploaded to storage if needed.
 */
export function generateCertificatePdf(p: CertificatePayload): string {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const H = 210;

  // Background
  doc.setFillColor(252, 251, 248);
  doc.rect(0, 0, W, H, "F");

  // Outer border (mint accent)
  doc.setDrawColor(46, 204, 113);
  doc.setLineWidth(2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4);
  doc.setDrawColor(180, 200, 190);
  doc.rect(12, 12, W - 24, H - 24);

  // Top accent bar
  doc.setFillColor(46, 204, 113);
  doc.rect(8, 8, W - 16, 6, "F");

  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(46, 204, 113);
  doc.text("LEADMINES ACADEMY · CERTIFIED PARTNER", W / 2, 28, { align: "center" });

  // Title
  doc.setFontSize(36);
  doc.setTextColor(20, 20, 20);
  doc.text("Certificate of Completion", W / 2, 50, { align: "center" });

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(90, 90, 90);
  doc.text("This certifies that", W / 2, 68, { align: "center" });

  // Recipient name
  doc.setFont("times", "italic");
  doc.setFontSize(34);
  doc.setTextColor(20, 20, 20);
  doc.text(p.fullName || "Verified Partner", W / 2, 88, { align: "center" });

  // Underline
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 80, 92, W / 2 + 80, 92);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(70, 70, 70);
  doc.text("has successfully completed the course", W / 2, 105, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.text(p.courseTitle, W / 2, 122, { align: "center" });

  // Score & badge row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(90, 90, 90);
  const scoreText = `with a score of ${p.scorePercent}%${p.badge ? `   ·   Badge: ${p.badge}` : ""}`;
  doc.text(scoreText, W / 2, 134, { align: "center" });

  // Footer block
  const issuedDate = new Date(p.issuedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.4);
  doc.line(40, 165, 110, 165);
  doc.line(W - 110, 165, W - 40, 165);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Issued on", 75, 172, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(issuedDate, 75, 178, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.text("Authorised Signatory", W - 75, 172, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text("LeadMines Academy · MoneyMines", W - 75, 178, { align: "center" });

  // Certificate number
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Certificate No. ${p.certificateNo}`, W / 2, 195, { align: "center" });
  doc.text("Verify at rupeedial.com/verify", W / 2, 200, { align: "center" });

  // Trigger download
  const filename = `${p.certificateNo}.pdf`;
  doc.save(filename);

  return doc.output("datauristring");
}
