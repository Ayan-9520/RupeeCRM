import { Banknote, ShieldCheck, CreditCard, LineChart, ArrowUpRight } from "lucide-react";

const categories = [
  {
    icon: Banknote,
    title: "Loans",
    tagline: "Every retail & SME loan product",
    items: ["Personal", "Business", "Home", "LAP", "MSME", "Working Capital", "Machinery", "Education", "Auto"],
    payout: "1–5% per disbursal",
  },
  {
    icon: ShieldCheck,
    title: "Insurance",
    tagline: "Life, Health & General",
    items: ["Term Life", "Health (Individual)", "Family Floater", "Motor", "Travel", "Fire", "Marine"],
    payout: "10–40% per policy",
  },
  {
    icon: CreditCard,
    title: "Credit Cards",
    tagline: "All major issuers",
    items: ["Co-branded", "Lifetime free", "Travel", "Cashback", "Business", "Secured"],
    payout: "₹500–₹5,000 per card",
  },
  {
    icon: LineChart,
    title: "Investments",
    tagline: "Wealth & savings products",
    items: ["Mutual Funds", "SIPs", "Fixed Deposits", "Bonds", "Demat onboarding"],
    payout: "Trail commissions",
    soon: true,
  },
];

export function Products() {
  return (
    <section id="products" className="py-24 lg:py-32 bg-background border-t border-border relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-[0.04] [background-image:radial-gradient(oklch(0.55_0.16_165)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[oklch(0.5_0.16_165)] font-semibold">Products</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            One platform. <span className="text-gradient">Every financial product.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Loans, insurance, credit cards and investments — distribute, track and earn from a single CRM.
            Switch products without switching tools.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <div
              key={c.title}
              className="group relative rounded-2xl bg-card border border-border p-6 hover:shadow-elevated hover:-translate-y-1 transition-smooth flex flex-col"
            >
              {c.soon && (
                <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  Coming soon
                </span>
              )}
              <div className="size-12 rounded-xl bg-mint-gradient grid place-items-center shadow-mint group-hover:scale-110 transition-smooth">
                <c.icon className="size-6 text-primary" strokeWidth={2.2} />
              </div>
              <h3 className="mt-5 font-display font-semibold text-xl">{c.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{c.tagline}</p>

              <ul className="mt-4 flex flex-wrap gap-1.5">
                {c.items.map((it) => (
                  <li
                    key={it}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-foreground/75 border border-border"
                  >
                    {it}
                  </li>
                ))}
              </ul>

              <div className="mt-5 pt-4 border-t border-dashed border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Payout</div>
                  <div className="font-mono text-sm font-semibold mt-0.5">{c.payout}</div>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-smooth" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-[oklch(0.6_0.18_165)] animate-pulse" />
          New product categories ship every quarter — Mutual Funds &amp; Demat onboarding next.
        </div>
      </div>
    </section>
  );
}
