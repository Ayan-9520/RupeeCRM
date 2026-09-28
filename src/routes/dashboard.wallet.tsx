import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet as WalletIcon, Loader2, Plus, Store, KanbanSquare, CreditCard } from "lucide-react";
import { getBillingMe, listMyLeads, type CrmPurchase } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () => ({ meta: [{ title: "Wallet — RupeeDial One" }] }),
  component: WalletPage,
});

type Txn = {
  id: string;
  type: "debit";
  amount: number;
  description: string;
  balance_after: number;
  created_at: string;
};

function WalletPage() {
  const [wallet, setWallet] = useState({ balance: 0, total_recharged: 0, total_spent: 0 });
  const [txns, setTxns] = useState<Txn[]>([]);
  const [planLabel, setPlanLabel] = useState<string>("—");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [billing, data] = await Promise.all([getBillingMe(), listMyLeads()]);
        const balance = Number(billing.entitlements.wallet_balance || 0);
        const purchases = [...(data.items ?? [])].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const totalSpent = purchases.reduce((s, p) => s + Number(p.price_paid || 0), 0);
        let running = balance + totalSpent;
        const chronological = [...purchases].reverse();
        const built: Txn[] = chronological.map((p: CrmPurchase) => {
          const amount = Number(p.price_paid || 0);
          running = Math.max(0, running - amount);
          const name = p.lead?.applicant_name ?? "Lead";
          const stage = p.pipeline_stage || "new";
          return {
            id: p.id,
            type: "debit" as const,
            amount,
            description: `${name} · ${stage}`,
            balance_after: running,
            created_at: p.created_at,
          };
        });

        setWallet({
          balance,
          total_recharged: balance + totalSpent,
          total_spent: totalSpent,
        });
        setPlanLabel(
          billing.entitlements.plan_name
            ? `${billing.entitlements.plan_name} (${billing.entitlements.plan_status})`
            : "No plan",
        );
        setTxns(built.reverse());
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load wallet");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Wallet</h1>
          <p className="text-[#5c4d72] mt-1">
            Lead credits from your plan. Buying a lead deducts from this balance. Credits cannot be
            withdrawn — use{" "}
            <Link to="/dashboard/earnings" className="font-semibold text-[#10662A] underline">
              Earnings
            </Link>{" "}
            for bank payouts (min ₹1,000 from converted deals).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white px-4 py-2 text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
          >
            <CreditCard className="size-4 text-[#10662A]" /> Billing
          </Link>
          <Link
            to="/dashboard/leadboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white px-4 py-2 text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
          >
            <Store className="size-4 text-[#10662A]" /> Leadboard
          </Link>
          <Link
            to="/dashboard/my-leads"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] bg-white px-4 py-2 text-sm font-semibold text-[#390A5D] hover:bg-[#E8F7EC]"
          >
            <KanbanSquare className="size-4 text-[#10662A]" /> My Leads
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-[#d8ecdd] bg-white p-6 lg:p-8 relative overflow-hidden shadow-[0_4px_24px_rgba(16,102,42,0.06)]">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(70% 80% at 100% 0%, rgba(232,247,236,0.95), transparent 55%)",
            }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-[#10662A] text-sm font-semibold">
              <WalletIcon className="size-4" /> Lead credits · {planLabel}
            </div>
            <div className="font-display text-4xl lg:text-5xl font-extrabold mt-2 text-[#390A5D]">
              ₹{wallet.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-xl bg-[#E8F7EC]/80 border border-[#d8ecdd] p-3">
                <div className="text-[#5c4d72] text-xs font-semibold uppercase tracking-wide">Credits in</div>
                <div className="font-bold mt-0.5 text-[#390A5D]">₹{wallet.total_recharged.toLocaleString("en-IN")}</div>
              </div>
              <div className="rounded-xl bg-[#E8F7EC]/80 border border-[#d8ecdd] p-3">
                <div className="text-[#5c4d72] text-xs font-semibold uppercase tracking-wide">Total spent</div>
                <div className="font-bold mt-0.5 text-[#390A5D]">₹{wallet.total_spent.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#d8ecdd] p-5 shadow-[0_4px_20px_rgba(16,102,42,0.05)] space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-[#390A5D]">
            <Plus className="size-4 text-[#10662A]" /> Actions
          </h3>
          <p className="text-xs text-[#5c4d72]">
            Activate a plan under Billing to add credits. Extra recharge / Razorpay lands later.
          </p>
          <Link
            to="/dashboard/billing"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10662A] text-white py-2.5 text-sm font-semibold hover:bg-[#0d5222]"
          >
            Go to Billing
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-[#d8ecdd] font-semibold text-[#390A5D] text-sm">
          Recent lead purchases
        </div>
        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="size-5 animate-spin text-[#10662A]" />
          </div>
        ) : txns.length === 0 ? (
          <p className="text-sm text-[#5c4d72] text-center py-10">No purchases yet</p>
        ) : (
          <ul className="divide-y divide-[#d8ecdd]">
            {txns.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium text-[#390A5D]">{t.description}</div>
                  <div className="text-xs text-[#5c4d72]">
                    {new Date(t.created_at).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-red-700">−₹{t.amount.toLocaleString("en-IN")}</div>
                  <div className="text-[10px] text-[#5c4d72]">bal ₹{t.balance_after.toLocaleString("en-IN")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
