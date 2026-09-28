import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Percent, Loader2, ArrowRight } from "lucide-react";
import { listMyLeads, type CrmPurchase } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/commissions")({
  head: () => ({ meta: [{ title: "Commissions — RupeeDial One" }] }),
  component: CommissionsPage,
});

function CommissionsPage() {
  const [rows, setRows] = useState<CrmPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await listMyLeads();
        setRows((data.items ?? []).filter((p) => p.converted));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] flex items-center gap-2">
          <Percent className="size-6 text-[#10662A]" /> Commissions
        </h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          Purchase & deal trail (rule engine next). Based on My Leads.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8ecdd] py-14 text-center text-sm text-[#5c4d72] space-y-3">
          <p>No converted deals yet.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/dashboard/my-leads" className="text-[#10662A] font-semibold hover:underline inline-flex items-center gap-1">
              My Leads <ArrowRight className="size-3.5" />
            </Link>
            <Link to="/dashboard/leadboard" className="text-[#10662A] font-semibold hover:underline inline-flex items-center gap-1">
              Leadboard <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#d8ecdd] overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#E8F7EC]/70 text-xs uppercase text-[#5c4d72]">
              <tr>
                <th className="text-left px-4 py-3">Lead</th>
                <th className="text-left px-4 py-3">Paid</th>
                <th className="text-left px-4 py-3">Deal</th>
                <th className="text-left px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-[#d8ecdd]">
                  <td className="px-4 py-3 font-medium text-[#390A5D]">{p.lead?.applicant_name ?? "—"}</td>
                  <td className="px-4 py-3">₹{Number(p.price_paid || 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {p.deal_value != null ? `₹${Number(p.deal_value).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">{p.pipeline_stage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
