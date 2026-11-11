import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Megaphone, Image as ImageIcon, MessageCircle, IdCard, Film, Link2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/marketing")({
  component: MarketingLayout,
});

const TABS = [
  { to: "/dashboard/marketing", label: "Overview", icon: Megaphone, exact: true },
  { to: "/dashboard/marketing/posts", label: "Social Posts", icon: ImageIcon, need: "basic" as const },
  { to: "/dashboard/marketing/whatsapp", label: "WhatsApp", icon: MessageCircle, need: "basic" as const },
  { to: "/dashboard/marketing/card", label: "Visiting Card", icon: IdCard, need: "basic" as const },
  { to: "/dashboard/marketing/reels", label: "Reels", icon: Film, need: "full" as const },
  { to: "/dashboard/marketing/oneclick", label: "One Click", icon: Zap, need: "full" as const },
  { to: "/dashboard/marketing/referral", label: "Referral Link", icon: Link2, need: "basic" as const },
];

function MarketingLayout() {
  const loc = useLocation();
  const { entitlements, loading, marketingFull } = useBillingEntitlements();
  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname.startsWith(to);

  const planLabel = entitlements.plan_name
    ? `${entitlements.plan_name} · ${entitlements.plan_status}`
    : "No plan";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">Marketing</p>
          <h1 className="text-3xl font-display font-bold tracking-tight text-[#390A5D]">
            Marketing desk
          </h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5c4d72]">
            Six tools. Each one puts your name and phone on something a customer can open.
          </p>
        </div>
        <Link
          to="/dashboard/billing"
          className="rounded-xl border border-[#d8ecdd] bg-white px-3 py-2 text-xs font-semibold text-[#390A5D]"
        >
          Plan: {loading ? "…" : planLabel}
          {!marketingFull && entitlements.has_active_plan && (
            <span className="ml-2 text-[#10662A]">· Upgrade for Reels</span>
          )}
        </Link>
      </div>

      {!entitlements.has_active_plan && !loading && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8ecdd] bg-[#F4FBF6] px-4 py-3 text-sm text-[#14281c]">
          <span>A plan turns these creatives on for your name and phone.</span>
          <Link to="/dashboard/billing" className="rounded-full bg-[#10662A] px-3 py-1.5 text-xs font-semibold text-white">
            Open billing
          </Link>
        </div>
      )}

      <div className="border-b border-[#d8ecdd] overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = isActive(t.to, t.exact);
            const locked = t.need === "full" && !marketingFull && entitlements.has_active_plan;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "border-[#10662A] text-[#10662A]"
                    : "border-transparent text-[#5c4d72] hover:text-[#390A5D]",
                  locked && "opacity-60",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                {locked && <span className="text-[10px] uppercase">Growth</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-5 animate-spin text-[#10662A]" />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
