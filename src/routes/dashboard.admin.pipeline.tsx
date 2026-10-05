import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { advancePipeline, getPipeline, importPipeline, type PipelineRow, type PipelineView } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/pipeline")({
  head: () => ({ meta: [{ title: "Data Pipeline — Admin" }] }),
  component: PipelinePage,
});

const NEXT: Record<string, string> = {
  imported: "consent",
  consent: "campaign",
  campaign: "telecalling",
  telecalling: "qualified",
  qualified: "allocated",
};

const STEP_LABEL: Record<string, string> = {
  consent: "Mark consent",
  campaign: "Set campaign",
  telecalling: "Send to telecalling",
  qualified: "Mark qualified",
  allocated: "Allocate",
};

function PipelinePage() {
  const [view, setView] = useState<PipelineView | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("motorcart");
  const [campaign, setCampaign] = useState("");
  const [consent, setConsent] = useState(false);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [assignee, setAssignee] = useState("");

  const load = () => {
    setLoading(true);
    getPipeline()
      .then(setView)
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load pipeline"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const importRows = async () => {
    const rows = raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, phone, city, product] = line.split(",").map((part) => part.trim());
        return { name: name || "", phone: phone || "", city: city || "", product: product || "personal" };
      });
    setBusy(true);
    try {
      const result = await importPipeline({ source, campaign, consent, rows });
      toast.success(`${result.created} added, ${result.duplicates} already in CRM`);
      setRaw("");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const step = async (row: PipelineRow) => {
    const next = NEXT[row.stage];
    if (!next) return;
    if (next === "allocate" && !assignee.trim()) {
      toast.error("Enter the assignee email first");
      return;
    }
    if (next === "campaign" && !campaign.trim() && !row.campaign) {
      toast.error("Enter a campaign name above, then set campaign");
      return;
    }
    setBusy(true);
    try {
      await advancePipeline(row.id, {
        step: next,
        campaign,
        assignee_email: assignee,
      });
      toast.success(STEP_LABEL[next] || "Updated");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Step failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] lg:text-3xl">Data Pipeline</h1>
        <p className="mt-1 text-[#5c4d72]">
          Import, dedupe, consent, campaign, telecalling, qualification, then allocation. These rows stay off the public marketplace.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {(view?.sources || []).map((item) => (
          <article key={item.key} className="rounded-2xl border border-[#d8ecdd] bg-white p-3">
            <p className="text-xs text-[#5c4d72]">{item.label}</p>
            <p className="text-xl font-bold text-[#390A5D]">{item.count}</p>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-semibold text-[#390A5D]">Import</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <select value={source} onChange={(event) => setSource(event.target.value)} className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm">
            {(view?.sources || []).map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
          <input value={campaign} onChange={(event) => setCampaign(event.target.value)} placeholder="Campaign name" className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-[#390A5D]">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            Consent already taken
          </label>
        </div>
        <textarea
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder={"One row per line: Name, Phone, City, Product\nPhase Ten, 9822222222, Pune, auto"}
          className="mt-3 min-h-28 w-full rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm"
        />
        <button type="button" disabled={busy} onClick={() => void importRows()} className="mt-3 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Import
        </button>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-[#390A5D]">Queue</h2>
          <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Assignee email for allocation" className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
        </div>
        {loading ? (
          <div className="grid place-items-center py-10"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#5c4d72]">
                  <th className="py-2">Name</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Stage</th>
                  <th>Campaign</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(view?.rows || []).map((row) => (
                  <tr key={row.id} className="border-t border-[#eef6ef]">
                    <td className="py-2">{row.name}<div className="text-xs text-[#5c4d72]">{row.city} · {row.product}</div></td>
                    <td>{row.phone}</td>
                    <td>{row.source_label}</td>
                    <td>{row.stage}</td>
                    <td>{row.campaign || "—"}</td>
                    <td className="text-right">
                      {NEXT[row.stage] ? (
                        <button type="button" disabled={busy} onClick={() => void step(row)} className="rounded-lg border border-[#d8ecdd] px-2 py-1 text-xs font-semibold text-[#10662A]">
                          {STEP_LABEL[NEXT[row.stage]]}
                        </button>
                      ) : (
                        <span className="text-xs text-[#5c4d72]">{row.allocated_to}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {view && view.rows.length === 0 ? <p className="py-6 text-sm text-[#5c4d72]">No pipeline rows yet.</p> : null}
          </div>
        )}
      </section>
    </div>
  );
}
