import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, MessageCircle, IdCard, Film, Link2, Zap, Lock } from "lucide-react";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";

export const Route = createFileRoute("/dashboard/marketing/")({
  component: MarketingHome,
});

const TILES = [
  {
    to: "/dashboard/marketing/oneclick",
    icon: Zap,
    kicker: "One tap",
    title: "One click post",
    desc: "A finished post with your name, phone and link, ready to share.",
    needFull: true,
  },
  {
    to: "/dashboard/marketing/posts",
    icon: ImageIcon,
    kicker: "Social",
    title: "Social posts",
    desc: "Home loan, personal loan and card pictures with your details.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/whatsapp",
    icon: MessageCircle,
    kicker: "Chat",
    title: "WhatsApp",
    desc: "A message the customer opens in WhatsApp with one tap.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/card",
    icon: IdCard,
    kicker: "Card",
    title: "Visiting card",
    desc: "A digital card and a QR that opens your public profile.",
    needFull: false,
  },
  {
    to: "/dashboard/marketing/reels",
    icon: Film,
    kicker: "Video",
    title: "Reel scripts",
    desc: "Short lines for an offer, an intro, or a festival post.",
    needFull: true,
  },
  {
    to: "/dashboard/marketing/referral",
    icon: Link2,
    kicker: "Link",
    title: "Referral link",
    desc: "Your own link so a customer applies through you.",
    needFull: false,
  },
] as const;

function MarketingHome() {
  const { marketingFull } = useBillingEntitlements();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {TILES.map((tile) => {
        const locked = tile.needFull && !marketingFull;
        return (
          <Link
            key={tile.to}
            to={tile.to}
            className="flex min-h-[168px] flex-col rounded-2xl border border-[#d8ecdd] bg-white p-5 shadow-[0_8px_24px_rgba(16,102,42,0.04)] transition hover:border-[#10662A]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A]">
                <tile.icon className="size-5" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#5c4d72]">{tile.kicker}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-bold text-[#390A5D]">{tile.title}</h3>
            <p className="mt-1 text-sm leading-6 text-[#5c4d72]">{tile.desc}</p>
            <p className="mt-auto pt-4 text-xs font-semibold text-[#10662A]">
              {locked ? (
                <span className="inline-flex items-center gap-1"><Lock className="size-3.5" /> Opens on the Growth plan</span>
              ) : (
                "Open"
              )}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
