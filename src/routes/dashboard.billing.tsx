import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Sparkles,
  ArrowRight,
  Loader2,
  Users,
  Wallet,
  Check,
  X,
} from "lucide-react";
import {
  getBillingMe,
  activateBillingPlan,
  cancelBillingPlan,
  inviteBillingSeat,
  getCrmUser,
  type BillingMe,
} from "@/lib/python-api";
import { isPlatformAdmin } from "@/lib/role-access";
import type { AppRole } from "@/lib/auth-context";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({ meta: [{ title: "Billing — RupeeDial One" }] }),
  component: BillingPage,
});

type Cycle = "monthly" | "quarterly" | "yearly";

function BillingPage() {
  const [data, setData] = useState<BillingMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: "", full_name: "", role: "dsa" });

  const load = useCallback(async () => {
    try {
      const me = await getBillingMe();
      setData(me);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load billing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onActivate = async (planId: string) => {
    setBusy(`activate-${planId}`);
    try {
      const res = await activateBillingPlan(planId, cycle);
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Activate failed");
    } finally {
      setBusy(null);
    }
  };

  const onCancel = async () => {
    if (!confirm("Cancel plan? Credits stay; modules lock after end date.")) return;
    setBusy("cancel");
    try {
      const res = await cancelBillingPlan();
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  };

  const onInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("invite");
    try {
      const res = await inviteBillingSeat(invite);
      toast.success(`${res.message}: ${res.temporary_password}`);
      setInvite({ email: "", full_name: "", role: "dsa" });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const ent = data?.entitlements;
  const planLabel = ent?.plan_name
    ? `${ent.plan_name} · ${ent.plan_cycle ?? "—"} · ${ent.plan_status}`
    : "No plan";
  const meEmail = typeof window !== "undefined" ? (JSON.parse(localStorage.getItem("rd_crm_user") || "{}") as { email?: string }).email : undefined;
  const isOwner =
    !data?.team?.length ||
    data.team.some((m) => m.is_owner && (!meEmail || m.email.toLowerCase() === meEmail.toLowerCase()));
  const isAdmin = isPlatformAdmin((getCrmUser()?.role as AppRole) || null);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Billing</h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          Plans, lead credits wallet, and team seats. Pay by UPI or bank transfer, then RupeeDial activates your plan — usually the same day.
        </p>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-gradient-to-br from-[#E8F7EC] to-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-[#10662A]/15 grid place-items-center">
              <Sparkles className="size-5 text-[#10662A]" />
            </div>
            <div>
              <div className="text-xs uppercase text-[#5c4d72]">Current plan</div>
              <div className="font-display text-xl font-bold text-[#390A5D]">{planLabel}</div>
              {ent?.plan_ends_at && (
                <div className="text-xs text-[#5c4d72] mt-0.5">
                  Ends {new Date(ent.plan_ends_at).toLocaleDateString("en-IN")}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="rounded-xl bg-white border border-[#d8ecdd] px-4 py-2">
              <div className="text-[10px] uppercase text-[#5c4d72] flex items-center gap-1">
                <Wallet className="size-3" /> Wallet
              </div>
              <div className="font-bold text-[#390A5D]">
                ₹{Number(ent?.wallet_balance ?? 0).toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-[#d8ecdd] px-4 py-2">
              <div className="text-[10px] uppercase text-[#5c4d72] flex items-center gap-1">
                <Users className="size-3" /> Seats
              </div>
              <div className="font-bold text-[#390A5D]">
                {data?.seats_used ?? 0} / {ent?.seat_limit ?? 1}
              </div>
            </div>
          </div>
        </div>
        {ent?.plan_status === "active" && (
          <button
            type="button"
            onClick={() => void onCancel()}
            disabled={busy === "cancel"}
            className="mt-4 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel plan"}
          </button>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        {(["monthly", "quarterly", "yearly"] as Cycle[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCycle(c)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              cycle === c
                ? "bg-[#10662A] text-white"
                : "bg-white border border-[#d8ecdd] text-[#390A5D]"
            }`}
          >
            {c}
            {c === "quarterly" ? " (−10%)" : c === "yearly" ? " (−20%)" : ""}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {(data?.available_plans ?? []).map((p) => {
          const price = p.price[cycle];
          const active = ent?.plan_id === p.id && ent?.plan_status === "active";
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 bg-white ${
                active ? "border-[#10662A] ring-1 ring-[#10662A]/30" : "border-[#d8ecdd]"
              }`}
            >
              <div className="font-display text-lg font-bold text-[#390A5D]">{p.name}</div>
              <div className="mt-1 text-2xl font-extrabold text-[#10662A]">
                ₹{price.toLocaleString("en-IN")}
                <span className="text-xs font-medium text-[#5c4d72]"> / {cycle}</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-[#5c4d72]">
                <li>{p.seats} seat{p.seats > 1 ? "s" : ""}</li>
                <li>₹{p.lead_credits_monthly.toLocaleString("en-IN")} lead credits / mo</li>
                {Object.entries(p.modules)
                  .filter(([, v]) => v)
                  .slice(0, 4)
                  .map(([k]) => (
                    <li key={k} className="flex items-center gap-1">
                      <Check className="size-3 text-[#10662A]" /> {k.replace(/_/g, " ")}
                    </li>
                  ))}
              </ul>
              {isAdmin || active ? (
                <button
                  type="button"
                  disabled={!!busy || active}
                  onClick={() => void onActivate(p.id)}
                  className="mt-4 w-full rounded-xl bg-[#10662A] text-white text-sm font-semibold py-2 disabled:opacity-50 hover:bg-[#0d5222]"
                >
                  {busy === `activate-${p.id}` ? "Activating…" : active ? "Active" : "Activate"}
                </button>
              ) : (
                <a
                  href={`https://wa.me/917982953129?text=${encodeURIComponent(
                    `Hi RupeeDial, I want to activate the ${p.name} plan (${cycle}, ₹${price.toLocaleString("en-IN")}). My CRM email: ${meEmail || ""}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block w-full rounded-xl bg-[#10662A] text-center text-white text-sm font-semibold py-2 hover:bg-[#0d5222]"
                >
                  Request activation
                </a>
              )}
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-4">
        <div className="font-semibold text-[#390A5D] flex items-center gap-2">
          <Users className="size-4 text-[#10662A]" /> Team seats
        </div>
        <ul className="divide-y divide-[#d8ecdd] text-sm">
          {(data?.team ?? []).map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-[#390A5D]">
                  {m.full_name} {m.is_owner && <span className="text-[10px] uppercase text-[#10662A]">Owner</span>}
                </div>
                <div className="text-xs text-[#5c4d72]">
                  {m.email} · {m.role}
                </div>
              </div>
              {!m.is_active && <X className="size-4 text-red-500" />}
            </li>
          ))}
        </ul>
        {isOwner && (ent?.seat_limit ?? 1) > 1 && (
          <form onSubmit={(e) => void onInvite(e)} className="grid sm:grid-cols-4 gap-2 pt-2">
            <input
              required
              placeholder="Full name"
              value={invite.full_name}
              onChange={(e) => setInvite((s) => ({ ...s, full_name: e.target.value }))}
              className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={invite.email}
              onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
              className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
            />
            <select
              value={invite.role}
              onChange={(e) => setInvite((s) => ({ ...s, role: e.target.value }))}
              className="rounded-lg border border-[#d8ecdd] px-3 py-2 text-sm"
            >
              <option value="dsa">DSA</option>
              <option value="caller">Caller</option>
              <option value="coordinator">Coordinator</option>
            </select>
            <button
              type="submit"
              disabled={busy === "invite"}
              className="rounded-lg bg-[#390A5D] text-white text-sm font-semibold py-2 disabled:opacity-50"
            >
              {busy === "invite" ? "…" : "Invite seat"}
            </button>
          </form>
        )}
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { to: "/dashboard/wallet", label: "Wallet", desc: "Lead credit balance", adminOnly: false },
          { to: "/dashboard/leadboard", label: "Leadboard", desc: "Buy with credits", adminOnly: false },
          { to: "/dashboard/profile", label: "Public profile", desc: "Firm page & slug", adminOnly: false },
          { to: "/dashboard/earnings", label: "Earnings", desc: "Payouts from deals", adminOnly: false },
          { to: "/dashboard/admin/partners", label: "Partner Applications", desc: "Approve DSA", adminOnly: true },
          { to: "/dashboard/admin/users", label: "Users", desc: "CRM logins", adminOnly: true },
        ]
          .filter((l) => !l.adminOnly || isAdmin)
          .map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="rounded-xl border border-[#d8ecdd] bg-white p-4 hover:bg-[#E8F7EC]/60 transition-colors group"
          >
            <div className="font-semibold text-sm text-[#390A5D] flex items-center gap-2">
              <Building2 className="size-4 text-[#10662A]" />
              {l.label}
              <ArrowRight className="size-3.5 ml-auto opacity-0 group-hover:opacity-100" />
            </div>
            <p className="text-xs text-[#5c4d72] mt-1">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
