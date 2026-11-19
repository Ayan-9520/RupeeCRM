import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { listCrmCareers, setCrmCareerStatus, type CrmCareer } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/careers")({
  head: () => ({ meta: [{ title: "Careers — RupeeOne" }] }),
  component: CareersPage,
});

const STATUSES = ["new", "shortlisted", "rejected"] as const;

function CareersPage() {
  const [rows, setRows] = useState<CrmCareer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listCrmCareers()
      .then((data) => setRows(data.items))
      .catch((error: Error) => toast.error(error.message || "Could not load applications"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (row: CrmCareer, status: string) => {
    setBusyId(row.id);
    try {
      const saved = await setCrmCareerStatus(row.id, status);
      setRows((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Admin</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-[#390A5D]">Careers</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          Job applications from rupeedial.com/career. These are not sales leads and do not enter the call queue.
        </p>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d8ecdd] bg-white p-10 text-center text-sm text-[#5c4d72]">
          No career application has arrived yet. A new form on the website will show here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-[#d8ecdd] bg-white">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="bg-[#E8F7EC] text-left text-[11px] uppercase tracking-wide text-[#10662A]">
              <tr>
                {["Name", "Phone", "Role", "City", "When", "Resume", "Status"].map((label) => (
                  <th key={label} className="whitespace-nowrap px-4 py-3 font-bold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#eef6f0]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#390A5D]">{row.full_name}</div>
                    <div className="text-xs text-[#5c4d72]">{row.email || row.website_lead_id}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div>{row.position || "—"}</div>
                    <div className="text-xs text-[#5c4d72]">{row.experience ? `${row.experience} exp` : ""}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{row.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#5c4d72]">{new Date(row.created_at).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    {row.resume_url ? (
                      <a href={row.resume_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#10662A]">
                        CV <ExternalLink className="size-3.5" />
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {STATUSES.map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => void setStatus(row, status)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${row.status === status ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] text-[#390A5D]"}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
