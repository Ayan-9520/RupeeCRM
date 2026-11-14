import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { assignCall, getCallQueue } from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { isPlatformAdmin } from "@/lib/role-access";

export const Route = createFileRoute("/dashboard/admin/call-queue")({
  head: () => ({ meta: [{ title: "Call queue — RupeeOne" }] }),
  component: CallQueuePage,
});

type QueueRow = {
  id: string;
  partner: string;
  applicant: string;
  city: string;
  product: string;
  stage: string;
  partner_has_caller: boolean;
  assigned_caller_id: string;
  assigned_caller: string;
};

function CallQueuePage() {
  const { role } = useAuth();
  const [items, setItems] = useState<QueueRow[]>([]);
  const [callers, setCallers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getCallQueue();
      setItems(data.items);
      setCallers(data.callers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the call queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async (row: QueueRow, callerId: string) => {
    setBusy(row.id);
    try {
      await assignCall(row.id, callerId || null);
      toast.success(callerId ? "Lead given to the company telecaller" : "Lead removed from the company telecaller");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not assign the lead");
    } finally {
      setBusy(null);
    }
  };

  if (!isPlatformAdmin(role)) {
    return <p className="text-sm text-[#5c4d72]">Admin only.</p>;
  }

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Call queue</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          Company telecallers see a lead only after you give it to them. A partner who has their own telecaller keeps that lead in their team.
        </p>
      </div>
      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white">
          <table className="w-max min-w-full text-sm">
            <thead className="bg-[#E8F7EC] text-left text-xs uppercase text-[#5c4d72]">
              <tr>
                {["Applicant", "Partner", "City", "Product", "Stage", "Company telecaller"].map((head) => (
                  <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-[#d8ecdd]">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#390A5D]">{row.applicant}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.partner}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.city || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.product || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{row.stage}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {row.partner_has_caller ? (
                      <span className="text-xs text-[#5c4d72]">Partner's own telecaller</span>
                    ) : (
                      <select
                        value={row.assigned_caller_id}
                        disabled={busy === row.id}
                        onChange={(event) => void save(row, event.target.value)}
                        className="h-9 rounded-xl border border-[#d8ecdd] px-2 text-sm"
                      >
                        <option value="">Not assigned</option>
                        {callers.map((caller) => (
                          <option key={caller.id} value={caller.id}>{caller.name}</option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#5c4d72]">No new or contacted file.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
