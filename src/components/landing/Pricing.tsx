import { Check, MessageCircle } from "lucide-react";

const plans = [
  {
    name: "Starter", price: "₹999", period: "/month", tag: "Try the platform",
    features: ["CRM access", "Limited leads", "Community access", "1 user seat"],
  },
  {
    name: "Growth", price: "₹4,999", period: "/month", tag: "Most popular", featured: true,
    features: ["Full CRM + pipeline", "Leadboard access", "AI-verified leads", "3 user seats", "WhatsApp alerts"],
  },
  {
    name: "Pro", price: "₹24,999", period: "/year", tag: "Best value",
    features: ["Unlimited leads", "Priority lead access", "Dedicated support", "10 user seats", "Refund policy"],
  },
  {
    name: "Enterprise", price: "Custom", period: "", tag: "For NBFCs & networks",
    features: ["API access", "Bulk leads", "Custom integrations", "Unlimited users", "SLA + onboarding"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 lg:py-32 relative">
      <div className="absolute inset-0 wa-pattern opacity-25" />
      <div className="absolute inset-0 bg-secondary/50" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--wa-green)] font-bold">Pricing</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            Plans that scale with your <span className="text-gradient">disbursal book</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">Lead cost ₹100–₹300 each · Earn 1–5% commission per disbursal</p>
        </div>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-3xl p-7 flex flex-col transition-smooth ${
                p.featured
                  ? "wa-header-bar text-white shadow-elevated lg:-translate-y-2 border border-[var(--wa-green)]/30"
                  : "bg-card border border-border hover:shadow-card hover:border-[var(--wa-green)]/25"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[var(--wa-green)] text-white text-[11px] font-bold shadow-mint">
                  <MessageCircle className="size-3" fill="currentColor" fillOpacity={0.3} /> {p.tag}
                </div>
              )}
              {!p.featured && (
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{p.tag}</div>
              )}

              <div className={`font-display text-2xl font-bold mt-3 ${p.featured ? "text-white" : ""}`}>{p.name}</div>

              <div className="mt-5 flex items-baseline gap-1">
                <span className={`text-4xl font-display font-bold ${p.featured ? "text-white" : ""}`}>{p.price}</span>
                <span className={`text-sm ${p.featured ? "text-white/60" : "text-muted-foreground"}`}>{p.period}</span>
              </div>

              <ul className={`mt-6 space-y-3 flex-1 ${p.featured ? "text-white/85" : ""}`}>
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`size-4 mt-0.5 shrink-0 ${p.featured ? "text-[var(--wa-green)]" : "text-[var(--wa-green)]"}`}
                      strokeWidth={3}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <a
                href="#cta"
                className={`mt-7 text-center py-3 rounded-full font-semibold text-sm transition-smooth ${
                  p.featured
                    ? "bg-[var(--wa-green)] text-white shadow-mint hover:scale-[1.02] hover:bg-[var(--wa-green-dark)]"
                    : "bg-[var(--wa-green)] text-white hover:bg-[var(--wa-green-dark)]"
                }`}
              >
                {p.name === "Enterprise" ? "Talk to sales" : "Start free trial"}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
