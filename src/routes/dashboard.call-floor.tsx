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
  const totals = COUNTS.map((item) => ({
    ...item,
    value: rows.reduce((sum, row) => sum + Number(row[item.key] || 0), 0),
  }));

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Team leader</p>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Caller check</h1>
        <p className="mt-1 max-w-2xl text-sm text-[#5c4d72]">
          Each number stays on the telecaller you gave it to. Not called means they have not saved a result. Open a card to see every number, the result, and the time.
        </p>
      </div>
      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-[#10662A]" /></div>
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-[#d8ecdd] bg-white p-8 text-sm text-[#5c4d72]">No company telecaller reports to this desk yet.</p>
      ) : (
        <>
          <section className="rounded-3xl border border-[#d8ecdd] bg-white p-4 shadow-[0_8px_30px_rgba(16,102,42,0.05)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Whole team</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {totals.map((item) => (
                <div key={item.key} className="rounded-2xl bg-[#F4FBF6] px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{item.label}</dt>
                  <dd className="mt-1 font-display text-2xl font-bold text-[#14281c]">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="grid gap-4 xl:grid-cols-2">
            {rows.map((row) => {
              const initial = (row.name || "?").trim().charAt(0).toUpperCase();
              const selected = openId === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className={`rounded-3xl border bg-white p-4 text-left shadow-[0_8px_30px_rgba(16,102,42,0.04)] ${selected ? "border-[#10662A] ring-2 ring-[#10662A]/20" : "border-[#d8ecdd]"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-2xl bg-[#10662A] font-display text-lg font-bold text-white">{initial}</div>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg font-bold text-[#390A5D]">{row.name}</h2>
                      <p className="truncate text-xs text-[#5c4d72]">{row.email}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {COUNTS.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-[#e7f5eb] bg-[#F4FBF6] px-3 py-2.5">
                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{item.label}</dt>
                        <dd className="mt-1 font-display text-xl font-bold text-[#14281c]">{row[item.key]}</dd>
                      </div>
                    ))}
                  </dl>
                </button>
              );
            })}
          </div>
          {open ? (
            <section className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_8px_30px_rgba(16,102,42,0.05)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e7f5eb] px-5 py-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">Numbers</p>
                  <h2 className="font-display text-lg font-bold text-[#390A5D]">{open.name}</h2>
                </div>
                <p className="text-sm text-[#5c4d72]">{open.given} given</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-max min-w-full text-sm">
                  <thead className="bg-[#F4FBF6] text-left text-[11px] uppercase tracking-wide text-[#5c4d72]">
                    <tr>
                      {["Customer", "Phone", "City", "Partner", "Result", "When"].map((head) => (
                        <th key={head} className="whitespace-nowrap px-5 py-3">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {open.leads.map((lead) => (
                      <tr key={lead.id} className="border-t border-[#eef6f0]">
                        <td className="whitespace-nowrap px-5 py-3 font-semibold text-[#390A5D]">{lead.applicant}</td>
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-xs">{lead.phone || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3">{lead.city || "—"}</td>
                        <td className="whitespace-nowrap px-5 py-3">{lead.partner}</td>
                        <td className="whitespace-nowrap px-5 py-3">{lead.result}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-[#5c4d72]">{when(lead.at)}</td>
                      </tr>
                    ))}
                    {open.leads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-[#5c4d72]">Nothing given yet. Use Call queue.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
