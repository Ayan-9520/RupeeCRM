import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getCallFloor, type CallFloorCaller } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/call-floor")({
  head: () => ({ meta: [{ title: "Caller check — RupeeOne" }] }),
  component: CallFloorPage,
});

const COUNTS: { key: keyof CallFloorCaller; label: string }[] = [
  { key: "given", label: "Given" },
  { key: "not_called", label: "Not called" },
  { key: "connected", label: "Connected" },
  { key: "interested", label: "Interested" },
  { key: "callback", label: "Callback" },
  { key: "not_reachable", label: "Not reachable" },
  { key: "not_interested", label: "Not interested" },
  { key: "wrong_number", label: "Wrong number" },
];

function when(value: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TeamLeadHome({ firstName }: { firstName: string }) {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Team leader</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">{firstName ? `${firstName}'s floor` : "Calling floor"}</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          You give leads to your company telecallers. You check who has not called, who connected, who is interested, and who needs a callback. Partner callers stay with their partner.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/dashboard/admin/call-queue" className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          <h2 className="font-display font-bold text-[#390A5D]">Call queue</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Put each number on one telecaller.</p>
        </Link>
        <Link to="/dashboard/call-floor" className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          <h2 className="font-display font-bold text-[#390A5D]">Caller check</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Given, not called, connected, interested, callback.</p>
        </Link>
      </div>
    </div>
  );
}

function CallFloorPage() {
  const [rows, setRows] = useState<CallFloorCaller[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getCallFloor()
      .then((data) => {
        setRows(data.items);
        setOpenId(data.items[0]?.id ?? null);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not load the floor"))
      .finally(() => setLoading(false));
  }, []);

  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Team leader</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Caller check</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          Each number stays on the telecaller you gave it to. Not called means they have not saved a result. A saved result is the button they pressed, with the time. This desk does not record the phone call itself.
        </p>
      </div>
      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#d8ecdd] bg-white p-8 text-sm text-[#5c4d72]">No company telecaller reports to this desk yet.</p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenId(row.id)}
                className={`rounded-2xl border bg-white p-4 text-left ${openId === row.id ? "border-[#10662A]" : "border-[#d8ecdd]"}`}
              >
                <h2 className="font-display text-lg font-bold text-[#390A5D]">{row.name}</h2>
                <p className="text-xs text-[#5c4d72]">{row.email}</p>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {COUNTS.map((item) => (
                    <div key={item.key}>
                      <dt className="text-[10px] uppercase tracking-wide text-[#5c4d72]">{item.label}</dt>
                      <dd className="font-display text-lg font-bold text-[#390A5D]">{row[item.key]}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            ))}
          </div>
          {open ? (
            <div className="overflow-x-auto rounded-2xl border border-[#d8ecdd] bg-white">
              <table className="w-max min-w-full text-sm">
                <thead className="bg-[#E8F7EC] text-left text-xs uppercase text-[#5c4d72]">
                  <tr>
                    {["Customer", "Phone", "City", "Partner", "Result", "When"].map((head) => (
                      <th key={head} className="whitespace-nowrap px-4 py-3">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {open.leads.map((lead) => (
                    <tr key={lead.id} className="border-t border-[#d8ecdd]">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#390A5D]">{lead.applicant}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{lead.phone || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{lead.city || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-3">{lead.partner}</td>
                      <td className="whitespace-nowrap px-4 py-3">{lead.result}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-[#5c4d72]">{when(lead.at)}</td>
                    </tr>
                  ))}
                  {open.leads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#5c4d72]">Nothing given yet. Use Call queue.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
