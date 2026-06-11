import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionShell } from "../shared/SectionShell";
import { exportCasePdf, exportCsv, printCaseSummary } from "@/lib/customer-crm/export-case";
import { loadDisbursals, loadPayouts, summarizeFinance } from "@/lib/customer-crm/phase5-api";
import { loadLenderCases } from "@/lib/customer-crm/phase4-api";
import { computeCustomerRisk } from "@/lib/customer-crm/risk-scoring";
import type { CustomerWorkspaceData } from "@/lib/customer-crm/types";
import type { EligibilityEngineResult } from "@/lib/customer-crm/eligibility-types";
import { toast } from "sonner";

export function ExportToolbar({
  workspace,
  eligibility,
  pipelineStage,
}: {
  workspace: CustomerWorkspaceData;
  eligibility: EligibilityEngineResult | null;
  pipelineStage: string;
}) {
  const [busy, setBusy] = useState(false);

  const run = async (kind: "pdf" | "profile" | "lenders" | "disbursal" | "payout" | "print") => {
    setBusy(true);
    try {
      const [d, p, l] = await Promise.all([
        loadDisbursals(workspace.profile.lead_purchase_id),
        loadPayouts(workspace.profile.lead_purchase_id),
        loadLenderCases(workspace.profile.lead_purchase_id),
      ]);
      const finance = summarizeFinance(d.rows, p.rows);
      const risk = computeCustomerRisk(workspace, eligibility);
      const id = workspace.profile.lead_purchase_id.slice(0, 8);

      if (kind === "pdf") {
        exportCasePdf({ ws: workspace, finance, lenders: l.rows, risk, pipelineStage });
        toast.success("PDF downloaded");
      } else if (kind === "print") {
        printCaseSummary();
      } else if (kind === "profile") {
        exportCsv(`profile-${id}.csv`, ["Field", "Value"], [
          ["Name", workspace.profile.full_name ?? ""],
          ["Mobile", workspace.profile.mobile ?? ""],
          ["Product", workspace.loanRequirements[0]?.product_type ?? ""],
          ["Income", workspace.profile.monthly_income ?? ""],
        ]);
      } else if (kind === "lenders") {
        exportCsv(
          `lenders-${id}.csv`,
          ["Lender", "ROI", "Tenure", "Sanction", "Payout", "Status"],
          l.rows.map((r) => [
            r.lender_name ?? "",
            r.roi ?? "",
            r.tenure ?? "",
            r.sanctioned_amount ?? "",
            r.payout_expected ?? "",
            r.login_status,
          ]),
        );
      } else if (kind === "disbursal") {
        exportCsv(
          `disbursals-${id}.csv`,
          ["Status", "Sanctioned", "Disbursed", "Net", "UTR", "Date"],
          d.rows.map((r) => [
            r.disbursal_status,
            r.sanctioned_amount ?? "",
            r.disbursed_amount ?? "",
            r.net_disbursal ?? "",
            r.utr_number ?? "",
            r.disbursal_date ?? "",
          ]),
        );
      } else if (kind === "payout") {
        exportCsv(
          `payouts-${id}.csv`,
          ["Status", "Type", "Amount", "Expected", "Received", "Ref"],
          p.rows.map((r) => [
            r.payout_status,
            r.payout_type,
            r.payout_amount ?? "",
            r.expected_date ?? "",
            r.received_date ?? "",
            r.payout_reference ?? "",
          ]),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionShell title="Export & Print" description="PDF, Excel (CSV), and print" icon={Download}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("pdf")}>
          <FileText className="size-4 mr-1" /> PDF summary
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("profile")}>
          <FileSpreadsheet className="size-4 mr-1" /> Profile CSV
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("lenders")}>
          <FileSpreadsheet className="size-4 mr-1" /> Lenders CSV
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("disbursal")}>
          <FileSpreadsheet className="size-4 mr-1" /> Disbursal CSV
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("payout")}>
          <FileSpreadsheet className="size-4 mr-1" /> Payout CSV
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => run("print")}>
          <Printer className="size-4 mr-1" /> Print
        </Button>
      </div>
    </SectionShell>
  );
}


