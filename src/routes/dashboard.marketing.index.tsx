import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, MessageCircle, IdCard, Film, Link2, Sparkles, Zap, Lock } from "lucide-react";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";

export const Route = createFileRoute("/dashboard/marketing/")({
  component: MarketingHome,
});

const TILES = [
  {
    to: "/dashboard/marketing/oneclick",
    icon: Zap,
    title: "One Click Post",
    desc: "Instant branded post — generate, share, done.",
    needFull: true,
  },
  {
    to: "/dashboard/marketing/posts",
    icon: ImageIcon,
    title: "Social Media Posts",
    desc: "Templates for PL, HL, cards — auto-personalized PNG.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/whatsapp",
    icon: MessageCircle,
    title: "WhatsApp Campaign",
    desc: "Click-to-chat templates with your name & link.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/card",
    icon: IdCard,
    title: "Visiting Card",
    desc: "Digital card with QR to your public profile.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/reels",
    icon: Film,
    title: "Reel scripts",
    desc: "Short-form scripts for offers & intros.",
    needFull: true,
  },
  {
    to: "/dashboard/marketing/referral",
    icon: Link2,
    title: "Referral Link",
    desc: "Personal lead-capture & product links.",
    needFull: false,
  },
] as const;

function MarketingHome() {
  const { marketingFull, entitlements } = useBillingEntitlements();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#d8ecdd] bg-gradient-to-br from-[#E8F7EC] via-white to-transparent p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-[#10662A]/15 grid place-items-center">
            <Sparkles className="size-6 text-[#10662A]" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold text-[#390A5D]">
              Turn every share into a lead
            </h2>
            <p className="text-[#5c4d72] mt-1 max-w-2xl text-sm">
              Starter: WhatsApp, basic posts, visiting card. Growth+: full post pack, reels &
              one-click.
              {!entitlements.has_active_plan && (
                <>
                  {" "}
                  <Link to="/dashboard/billing" className="font-semibold text-[#10662A] underline">
                    Activate a plan
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => {
          const locked = t.needFull && !marketingFull;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="hover:shadow-md transition-shadow h-full border-[#d8ecdd]">
                <CardContent className="p-6">
                  <div className="size-10 rounded-lg bg-[#E8F7EC] grid place-items-center mb-4 relative">
                    <t.icon className="size-5 text-[#10662A]" />
                    {locked && (
                      <Lock className="size-3 absolute -top-1 -right-1 text-amber-600" />
                    )}
                  </div>
                  <div className="font-semibold text-lg mb-1 text-[#390A5D]">
                    {t.title}
                    {locked && (
                      <span className="ml-2 text-[10px] uppercase text-amber-700">Growth+</span>
                    )}
                  </div>
                  <div className="text-sm text-[#5c4d72]">{t.desc}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
