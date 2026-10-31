import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  createPayoutAdjustment,
  createPayoutGrid,
  decidePayoutAdjustment,
  decidePayoutGrid,
  listPayoutAdjustments,
  listPayoutGrids,
  quotePayout,
  type PayoutAdjustmentRow,
  type PayoutGridRow,
  type PayoutQuote,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/payout-grids")({
  head: () => ({ meta: [{ title: "Payout Grids — Admin" }] }),
  component: PayoutGridsPage,
});

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function PayoutGridsPage() {
  const [grids, setGrids] = useState<PayoutGridRow[]>([]);
  const [adjustments, setAdjustments] = useState<PayoutAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [quote, setQuote] = useState<PayoutQuote | null>(null);
  const [gridForm, setGridForm] = useState({
    channel_name: "",
    product: "",
    effective_from: "",
    receivable_percent: "1.4",
    payable_percent: "90",
    note: "",
  });
  const [calc, setCalc] = useState({
    amount: "",
    receivable_percent: "1.4",
    payable_percent: "90",
    subvention_points: "0",
    other_points: "0",
  });
  const [adj, setAdj] = useState({
    deal_no: "",
    kind: "subvention",
    subvention_points: "0",
    other_points: "0",
    payable_percent: "",
    reason: "",
  });

  const load = async () => {
    const [gridRes, adjRes] = await Promise.all([listPayoutGrids(), listPayoutAdjustments()]);
    setGrids(gridRes.items);
    setAdjustments(adjRes.items);
  };

  useEffect(() => {
    load()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load payout grids"))
      .finally(() => setLoading(false));
  }, []);

  const saveGrid = async () => {
    setBusy("grid");
    try {
      await createPayoutGrid({
        channel_name: gridForm.channel_name.trim(),
        product: gridForm.product.trim(),
        effective_from: gridForm.effective_from,
        receivable_percent: Number(gridForm.receivable_percent),
        payable_percent: Number(gridForm.payable_percent),
        note: gridForm.note.trim(),
      });
      toast.success("Sheet saved as pending. Approve it before it is used.");
      setGridForm((f) => ({ ...f, note: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the sheet");
    } finally {
      setBusy("");
    }
  };

  const runQuote = async () => {
    setBusy("quote");
    try {
      const result = await quotePayout({
        amount: Number(calc.amount),
        receivable_percent: Number(calc.receivable_percent),
        payable_percent: Number(calc.payable_percent),
        subvention_points: Number(calc.subvention_points || 0),
        other_points: Number(calc.other_points || 0),
      });
      setQuote(result);
    } catch (error) {
      setQuote(null);
      toast.error(error instanceof Error ? error.message : "Could not calculate");
    } finally {
      setBusy("");
    }
  };

  const saveAdjustment = async () => {
    setBusy("adj");
    try {
      await createPayoutAdjustment({
        deal_no: adj.deal_no.trim(),
        kind: adj.kind,
        subvention_points: Number(adj.subvention_points || 0),
        other_points: Number(adj.other_points || 0),
        payable_percent: adj.payable_percent.trim() === "" ? null : Number(adj.payable_percent),
        reason: adj.reason.trim(),
      });
      toast.success("Adjustment is pending. The case rate changes only after approval.");
      setAdj((a) => ({ ...a, reason: "" }));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the adjustment");
    } finally {
      setBusy("");
    }
  };

  const decide = async (kind: "grid" | "adj", id: string, approve: boolean) => {
    setBusy(id);
    try {
      if (kind === "grid") await decidePayoutGrid(id, approve);
      else await decidePayoutAdjustment(id, approve);
      toast.success(approve ? "Approved" : "Rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const field = "h-10 w-full rounded-xl border border-[#d8ecdd] bg-white px-3 text-sm text-[#14281c]";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#14281c]">Payout grids</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#5c4d72]">
          Lender rate and the connector share of that commission. A new month does not change cases that already have a rate. GST and TDS stay on Commission Rules.
        </p>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_24px_rgba(16,102,42,0.05)]">
        <h2 className="font-semibold text-[#14281c]">Calculator</h2>
        <p className="mt-0.5 text-xs text-[#5c4d72]">Same split as a closure file. Nothing is saved.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-5">
          <input className={field} placeholder="Disbursed ₹" value={calc.amount} onChange={(e) => setCalc({ ...calc, amount: e.target.value })} />
          <input className={field} placeholder="Lender %" value={calc.receivable_percent} onChange={(e) => setCalc({ ...calc, receivable_percent: e.target.value })} />
          <input className={field} placeholder="DSA share %" value={calc.payable_percent} onChange={(e) => setCalc({ ...calc, payable_percent: e.target.value })} />
          <input className={field} placeholder="Subvention pts" value={calc.subvention_points} onChange={(e) => setCalc({ ...calc, subvention_points: e.target.value })} />
          <input className={field} placeholder="Other pts" value={calc.other_points} onChange={(e) => setCalc({ ...calc, other_points: e.target.value })} />
        </div>
        <button type="button" onClick={() => void runQuote()} disabled={busy === "quote"} className="mt-3 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Calculate
        </button>
        {quote && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Effective rate" value={`${quote.effective_percent}%`} />
            <Stat label="Lender pays" value={inr(quote.gross_commission)} />
            <Stat label="Connector payout" value={inr(quote.dsa_payout)} />
            <Stat label="Agent share" value={inr(quote.agent_share)} />
            <Stat label="Company net" value={inr(quote.company_net)} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_24px_rgba(16,102,42,0.05)]">
        <h2 className="font-semibold text-[#14281c]">New rate sheet</h2>
        <p className="mt-0.5 text-xs text-[#5c4d72]">Stays pending until approved. Old approved sheets remain for earlier dates.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className={field} placeholder="Lender or channel" value={gridForm.channel_name} onChange={(e) => setGridForm({ ...gridForm, channel_name: e.target.value })} />
          <input className={field} placeholder="Product, same as the case" value={gridForm.product} onChange={(e) => setGridForm({ ...gridForm, product: e.target.value })} />
          <input className={field} type="date" value={gridForm.effective_from} onChange={(e) => setGridForm({ ...gridForm, effective_from: e.target.value })} />
          <input className={field} placeholder="Lender pays %" value={gridForm.receivable_percent} onChange={(e) => setGridForm({ ...gridForm, receivable_percent: e.target.value })} />
          <input className={field} placeholder="Connector share %" value={gridForm.payable_percent} onChange={(e) => setGridForm({ ...gridForm, payable_percent: e.target.value })} />
          <input className={field} placeholder="Note" value={gridForm.note} onChange={(e) => setGridForm({ ...gridForm, note: e.target.value })} />
        </div>
        <button type="button" onClick={() => void saveGrid()} disabled={busy === "grid"} className="mt-3 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Save pending sheet
        </button>
        <div className="mt-4 overflow-x-auto">
          {grids.length === 0 ? (
            <p className="text-sm text-[#5c4d72]">No rate sheets yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-[#5c4d72]">
                <tr>
                  <th className="py-2">Lender</th>
                  <th>Product</th>
                  <th>From</th>
                  <th>Lender %</th>
                  <th>DSA %</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {grids.map((row) => (
                  <tr key={row.id} className="border-t border-[#e2efe6]">
                    <td className="py-2 font-medium text-[#14281c]">{row.channel_name}</td>
                    <td>{row.product}</td>
                    <td>{row.effective_from}</td>
                    <td>{row.receivable_percent}</td>
                    <td>{row.payable_percent}</td>
                    <td className="capitalize">{row.status}</td>
                    <td className="py-2 text-right">
                      {row.status === "pending" && (
                        <span className="inline-flex gap-2">
                          <button type="button" className="text-xs font-semibold text-[#10662A]" disabled={busy === row.id} onClick={() => void decide("grid", row.id, true)}>Approve</button>
                          <button type="button" className="text-xs font-semibold text-red-700" disabled={busy === row.id} onClick={() => void decide("grid", row.id, false)}>Reject</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_24px_rgba(16,102,42,0.05)]">
        <h2 className="font-semibold text-[#14281c]">Case adjustment</h2>
        <p className="mt-0.5 text-xs text-[#5c4d72]">Changes one closure file after approval. Paid or collected cases are locked. The rate sheet is not edited.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className={field} placeholder="Deal number" value={adj.deal_no} onChange={(e) => setAdj({ ...adj, deal_no: e.target.value })} />
          <select className={field} value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value })}>
            <option value="subvention">Subvention</option>
            <option value="special">Special approval</option>
            <option value="clawback">Clawback</option>
            <option value="other">Other</option>
          </select>
          <input className={field} placeholder="Reason" value={adj.reason} onChange={(e) => setAdj({ ...adj, reason: e.target.value })} />
          <input className={field} placeholder="Subvention points" value={adj.subvention_points} onChange={(e) => setAdj({ ...adj, subvention_points: e.target.value })} />
          <input className={field} placeholder="Other points" value={adj.other_points} onChange={(e) => setAdj({ ...adj, other_points: e.target.value })} />
          <input className={field} placeholder="New DSA share % (optional)" value={adj.payable_percent} onChange={(e) => setAdj({ ...adj, payable_percent: e.target.value })} />
        </div>
        <button type="button" onClick={() => void saveAdjustment()} disabled={busy === "adj"} className="mt-3 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Submit adjustment
        </button>
        <ul className="mt-4 space-y-2">
          {adjustments.length === 0 && <li className="text-sm text-[#5c4d72]">No adjustments yet.</li>}
          {adjustments.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm">
              <div>
                <span className="font-semibold text-[#14281c]">{row.deal_no}</span>
                <span className="ml-2 capitalize text-[#5c4d72]">{row.kind} · {row.status}</span>
                <p className="text-xs text-[#5c4d72]">{row.reason}</p>
                {row.after_receivable != null && (
                  <p className="text-xs text-[#10662A]">Rate {row.before_receivable}% → {row.after_receivable}%</p>
                )}
              </div>
              {row.status === "pending" && (
                <span className="inline-flex gap-2">
                  <button type="button" className="text-xs font-semibold text-[#10662A]" disabled={busy === row.id} onClick={() => void decide("adj", row.id, true)}>Approve</button>
                  <button type="button" className="text-xs font-semibold text-red-700" disabled={busy === row.id} onClick={() => void decide("adj", row.id, false)}>Reject</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f5fcf7] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</div>
      <div className="font-display text-lg font-bold text-[#14281c]">{value}</div>
    </div>
  );
}
