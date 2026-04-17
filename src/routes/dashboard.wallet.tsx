import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Loader2, Plus } from "lucide-react";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () => ({ meta: [{ title: "Wallet — LeadMines" }] }),
  component: WalletPage,
});

type Txn = {
  id: string; type: "credit" | "debit"; amount: number; description: string;
  balance_after: number; created_at: string;
};

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

function WalletPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, total_recharged: 0, total_spent: 0 });
  const [txns, setTxns] = useState<Txn[]>([]);
  const [recharging, setRecharging] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [w, t] = await Promise.all([
      supabase.from("wallets").select("balance,total_recharged,total_spent").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (w.data) setWallet({
      balance: Number(w.data.balance),
      total_recharged: Number(w.data.total_recharged),
      total_spent: Number(w.data.total_spent),
    });
    setTxns((t.data ?? []) as Txn[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const recharge = async (amount: number) => {
    setRecharging(amount);
    const { error } = await supabase.rpc("recharge_wallet", { _amount: amount });
    setRecharging(null);
    if (error) toast.error(error.message);
    else { toast.success(`₹${amount} added to wallet`); load(); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground mt-1">Recharge funds to purchase premium leads. Demo mode — no real charge.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-3xl bg-hero-gradient text-white p-6 lg:p-8 relative overflow-hidden shadow-elevated">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="absolute -bottom-20 -right-20 size-64 rounded-full bg-[oklch(0.78_0.16_165_/_0.3)] blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <WalletIcon className="size-4" /> Available balance
            </div>
            <div className="font-display text-4xl lg:text-5xl font-bold mt-2">
              ₹{wallet.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-white/60">Total recharged</div><div className="font-semibold mt-0.5">₹{wallet.total_recharged.toLocaleString("en-IN")}</div></div>
              <div><div className="text-white/60">Total spent</div><div className="font-semibold mt-0.5">₹{wallet.total_spent.toLocaleString("en-IN")}</div></div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 shadow-card">
          <h3 className="font-semibold flex items-center gap-2"><Plus className="size-4 text-accent" /> Quick recharge</h3>
          <div className="mt-4 space-y-2">
            {QUICK_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => recharge(a)}
                disabled={recharging !== null}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border hover:border-accent hover:bg-accent/5 transition-smooth font-medium text-sm disabled:opacity-60"
              >
                ₹{a.toLocaleString("en-IN")}
                {recharging === a ? <Loader2 className="size-4 animate-spin text-accent" /> : <Plus className="size-4 text-accent" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
        <div className="p-5 border-b border-border">
          <h3 className="font-semibold">Recent transactions</h3>
        </div>
        {loading ? (
          <div className="p-12 grid place-items-center"><Loader2 className="size-5 animate-spin text-accent" /></div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">No transactions yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {txns.map((t) => (
              <li key={t.id} className="px-5 py-3 flex items-center gap-3">
                <div className={`size-9 rounded-full grid place-items-center ${t.type === "credit" ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
                  {t.type === "credit" ? <ArrowDownCircle className="size-4" /> : <ArrowUpCircle className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.description}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${t.type === "credit" ? "text-emerald-600" : "text-red-600"}`}>
                    {t.type === "credit" ? "+" : "−"}₹{Number(t.amount).toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Bal: ₹{Number(t.balance_after).toLocaleString("en-IN")}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
