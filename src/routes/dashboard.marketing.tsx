import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Megaphone, Image as ImageIcon, MessageCircle, IdCard, Film, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/marketing")({
  component: MarketingLayout,
});

const TABS = [
  { to: "/dashboard/marketing", label: "Overview", icon: Megaphone, exact: true },
  { to: "/dashboard/marketing/posts", label: "Social Posts", icon: ImageIcon },
  { to: "/dashboard/marketing/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/dashboard/marketing/card", label: "Visiting Card", icon: IdCard },
  { to: "/dashboard/marketing/reels", label: "Reels", icon: Film },
  { to: "/dashboard/marketing/referral", label: "Referral Link", icon: Link2 },
];

function MarketingLayout() {
  const loc = useLocation();
  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname.startsWith(to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold tracking-tight">Marketing Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create, personalize, and share branded creatives across every channel.
        </p>
      </div>

      <div className="border-b overflow-x-auto">
        <nav className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const active = isActive(t.to, t.exact);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
