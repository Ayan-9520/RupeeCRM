import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, MessageCircle, IdCard, Film, Link2, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/dashboard/marketing/")({
  component: MarketingHome,
});

const TILES = [
  { to: "/dashboard/marketing/oneclick", icon: Zap, title: "One Click Post ⚡", desc: "Instant branded post — trending, daily, or festival. Generate, share, done.", color: "from-primary/15 to-accent/10" },
  { to: "/dashboard/marketing/posts", icon: ImageIcon, title: "Social Media Posts", desc: "Pre-designed templates for PL, BL, HL, Credit Cards, Insurance — auto-personalized.", color: "from-emerald-500/10 to-emerald-500/5" },
  { to: "/dashboard/marketing/whatsapp", icon: MessageCircle, title: "WhatsApp Campaign", desc: "Click-to-chat links, message templates, and bulk-ready scripts.", color: "from-green-500/10 to-green-500/5" },
  { to: "/dashboard/marketing/card", icon: IdCard, title: "Visiting Card Generator", desc: "Digital business card with QR code, photo, and shareable image.", color: "from-blue-500/10 to-blue-500/5" },
  { to: "/dashboard/marketing/reels", icon: Film, title: "Reel / Video Builder", desc: "Short reel templates for offers, festivals, and product pitches.", color: "from-purple-500/10 to-purple-500/5" },
  { to: "/dashboard/marketing/referral", icon: Link2, title: "Referral Link", desc: "Your personal lead-capture link to share anywhere.", color: "from-amber-500/10 to-amber-500/5" },
] as const;

function MarketingHome() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-accent/5 to-transparent p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-primary/15 grid place-items-center">
            <Sparkles className="size-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">Turn every share into a lead.</h2>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Auto-personalized creatives with your name, phone, and referral link baked in.
              Pick a template, tweak the copy, share to WhatsApp / Facebook / LinkedIn — done.
            </p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TILES.map((t) => (
          <Link key={t.to} to={t.to}>
            <Card className={`bg-gradient-to-br ${t.color} hover:shadow-lg transition-shadow h-full`}>
              <CardContent className="p-6">
                <div className="size-10 rounded-lg bg-background/80 grid place-items-center mb-4 shadow-sm">
                  <t.icon className="size-5 text-primary" />
                </div>
                <div className="font-semibold text-lg mb-1">{t.title}</div>
                <div className="text-sm text-muted-foreground">{t.desc}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
