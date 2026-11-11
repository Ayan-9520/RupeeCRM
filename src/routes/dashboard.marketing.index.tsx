import { createFileRoute, Link } from "@tanstack/react-router";
import { Image as ImageIcon, MessageCircle, IdCard, Film, Link2, Zap, Lock, ArrowUpRight } from "lucide-react";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";

export const Route = createFileRoute("/dashboard/marketing/")({
  component: MarketingHome,
});

const TILES = [
  {
    to: "/dashboard/marketing/oneclick",
    icon: Zap,
    title: "One click post",
    desc: "A finished post with your name, phone and link.",
    needFull: true,
    preview: "post",
  },
  {
    to: "/dashboard/marketing/posts",
    icon: ImageIcon,
    title: "Social posts",
    desc: "Home loan, personal loan and card creatives.",
    needFull: false,
    preview: "grid",
  },
  {
    to: "/dashboard/marketing/whatsapp",
    icon: MessageCircle,
    title: "WhatsApp",
    desc: "A message the customer can open in one tap.",
    needFull: false,
    preview: "chat",
  },
  {
    to: "/dashboard/marketing/card",
    icon: IdCard,
    title: "Visiting card",
    desc: "A card with a QR to your public profile.",
    needFull: false,
    preview: "card",
  },
  {
    to: "/dashboard/marketing/reels",
    icon: Film,
    title: "Reel scripts",
    desc: "Short lines for an offer or an introduction.",
    needFull: true,
    preview: "reel",
  },
  {
    to: "/dashboard/marketing/referral",
    icon: Link2,
    title: "Referral link",
    desc: "Your own link for a loan or a product.",
    needFull: false,
    preview: "link",
  },
] as const;

function Preview({ kind }: { kind: (typeof TILES)[number]["preview"] }) {
  if (kind === "post") {
    return (
      <div className="rounded-xl bg-[#0D4F20] p-3 text-white">
        <p className="text-[10px] uppercase tracking-wide text-white/70">Home loan</p>
        <p className="mt-1 font-display text-sm font-bold leading-snug">Compare rates. Apply with your partner.</p>
      </div>
    );
  }
  if (kind === "grid") {
    return (
      <div className="grid grid-cols-3 gap-1.5">
        {["Loan", "Card", "Cover"].map((label) => (
          <div key={label} className="rounded-lg bg-[#E8F7EC] px-2 py-3 text-center text-[10px] font-semibold text-[#0D4F20]">
            {label}
          </div>
        ))}
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="rounded-xl bg-[#F4FBF6] px-3 py-2">
        <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#10662A] px-3 py-2 text-[11px] leading-4 text-white">
          Hi, I can check a personal loan for you. Reply YES.
        </div>
      </div>
    );
  }
  if (kind === "card") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[#d8ecdd] bg-white px-3 py-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#10662A]">RupeeDial partner</p>
          <p className="text-sm font-semibold text-[#390A5D]">Your name</p>
        </div>
        <span className="grid size-9 place-items-center rounded-md border border-[#d8ecdd] text-[9px] font-bold text-[#0D4F20]">QR</span>
      </div>
    );
  }
  if (kind === "reel") {
    return (
      <div className="flex h-16 items-end rounded-xl bg-gradient-to-br from-[#390A5D] to-[#0D4F20] px-3 py-2">
        <p className="text-[11px] font-semibold text-white">Hook · offer · your number</p>
      </div>
    );
  }
  return (
    <div className="truncate rounded-full bg-[#E8F7EC] px-3 py-2 text-[11px] font-semibold text-[#0D4F20]">
      rupeedial.com/p/your-name
    </div>
  );
}

function MarketingHome() {
  const { marketingFull, entitlements } = useBillingEntitlements();

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0D4F20] to-[#10662A] p-6 text-white shadow-[0_18px_40px_rgba(13,79,32,0.22)] md:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B7E4C7]">Campaign desk</p>
        <h2 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight">Posts, WhatsApp and a card that carry your name.</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
          Pick a format, put your phone and profile link on it, then send it to a customer. Starter covers WhatsApp, posts and the visiting card. Growth adds reels and one-click posts.
        </p>
        {!entitlements.has_active_plan && (
          <Link to="/dashboard/billing" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0D4F20]">
            Activate a plan <ArrowUpRight className="size-4" />
          </Link>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const locked = tile.needFull && !marketingFull;
          return (
            <Link key={tile.to} to={tile.to} className="group rounded-2xl border border-[#d8ecdd] bg-white p-4 shadow-[0_8px_24px_rgba(16,102,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(16,102,42,0.08)]">
              <Preview kind={tile.preview} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 font-display text-lg font-bold text-[#390A5D]">
                    <tile.icon className="size-4 text-[#10662A]" />
                    {tile.title}
                  </div>
                  <p className="mt-1 text-sm leading-5 text-[#5c4d72]">{tile.desc}</p>
                </div>
                {locked && <Lock className="size-4 shrink-0 text-[#390A5D]" />}
              </div>
              {locked && <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#10662A]">Growth plan</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
