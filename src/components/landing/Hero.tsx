import heroImg from "@/assets/hero-leadmines.jpg";
import { ArrowRight, ShieldCheck, Zap, Users } from "lucide-react";

export function Hero() {
  return (
    <section className="relative pt-28 lg:pt-36 pb-20 lg:pb-28 overflow-hidden bg-hero-gradient text-white">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute -top-32 -right-32 size-[480px] rounded-full bg-[oklch(0.78_0.16_165_/_0.25)] blur-3xl" />
      <div className="absolute -bottom-40 -left-40 size-[520px] rounded-full bg-[oklch(0.55_0.15_220_/_0.35)] blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-medium text-white/90">
            <span className="size-1.5 rounded-full bg-[hsl(var(--mint))] bg-mint-gradient animate-pulse" />
            India's #1 Lead Marketplace + DSA CRM Platform
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-[1.05] tracking-tight">
            Mine high-intent <span className="text-gradient">financial leads</span>. Close more loans.
          </h1>

          <p className="mt-6 text-lg text-white/75 max-w-xl leading-relaxed">
            AI-verified leads for Loans, Credit Cards, Insurance & Mutual Funds — paired with a full DSA CRM,
            partner community, and affiliate earnings. From click to disbursal, on one premium platform.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="#pricing"
              className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth"
            >
              Start earning today
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-smooth" />
            </a>
            <a
              href="#flow"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/20 text-white font-medium transition-smooth"
            >
              See how it works
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-4 max-w-lg">
            {[
              { icon: ShieldCheck, label: "AI Verified", value: "98%" },
              { icon: Zap, label: "Avg. Close", value: "3.2 days" },
              { icon: Users, label: "Active DSAs", value: "12,400+" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md p-4">
                <s.icon className="size-4 text-[oklch(0.85_0.18_160)]" />
                <div className="mt-2 text-2xl font-display font-bold">{s.value}</div>
                <div className="text-[11px] uppercase tracking-wider text-white/60 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-fade-up" style={{ animationDelay: "150ms" }}>
          <div className="absolute -inset-6 bg-mint-gradient opacity-20 blur-3xl rounded-[2rem]" />
          <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-elevated animate-float">
            <img
              src={heroImg}
              alt="LeadMines DSA CRM dashboard preview"
              width={1600}
              height={1200}
              className="w-full h-auto"
            />
          </div>
          <div className="absolute -bottom-6 -left-6 hidden sm:block rounded-2xl bg-card text-foreground shadow-elevated px-5 py-4 backdrop-blur-xl">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hot Lead</div>
            <div className="font-display font-semibold text-sm mt-1">Personal Loan · ₹8L · Mumbai</div>
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-[oklch(0.5_0.16_160)] font-medium">
              <span className="size-1.5 rounded-full bg-[oklch(0.7_0.18_160)]" />
              Score 92 · Verified now
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
