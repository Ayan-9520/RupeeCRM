import { Megaphone, Filter, ShoppingCart, Phone, FileText, Building2, CheckCircle2 } from "lucide-react";

const steps = [
  { icon: Megaphone, title: "Marketing", desc: "Run ads on Meta, Google, WhatsApp" },
  { icon: Filter, title: "AI Verify", desc: "OTP + dedup + cold/warm/hot scoring" },
  { icon: ShoppingCart, title: "Leadboard", desc: "DSAs filter & buy from wallet" },
  { icon: Phone, title: "Call Center", desc: "Telecallers qualify & schedule" },
  { icon: FileText, title: "Documents", desc: "Sales coordinator collects & uploads" },
  { icon: Building2, title: "Lender Portal", desc: "Banks/NBFCs review & decide" },
  { icon: CheckCircle2, title: "Disbursal", desc: "Track approval, payout & commission" },
];

export function Flow() {
  return (
    <section id="flow" className="py-24 lg:py-32 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wa-green)]/5 to-transparent pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-5 lg:px-8">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--wa-green)] font-bold">The Flow</div>
          <h2 className="mt-3 text-3xl lg:text-5xl font-bold tracking-tight">
            One pipeline, <span className="text-gradient">ad click to disbursal</span>.
          </h2>
          <p className="mt-4 text-muted-foreground text-lg">
            Every lead moves through seven calibrated stages — visible to every role, in real time.
          </p>
        </div>

        <div className="mt-14 relative">
          <div className="hidden lg:block absolute top-7 left-[6%] right-[6%] h-0.5 bg-gradient-to-r from-transparent via-[var(--wa-green)]/30 to-transparent" />
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-5 lg:gap-3">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="relative size-14 mx-auto rounded-2xl bg-card border border-border shadow-card grid place-items-center hover:border-[var(--wa-green)]/40 transition-smooth">
                  <s.icon className="size-6 text-[var(--wa-teal)] dark:text-[var(--wa-green)]" strokeWidth={2} />
                  <div className="absolute -top-2 -right-2 size-5 rounded-full bg-[var(--wa-green)] grid place-items-center text-[10px] font-bold text-white">
                    {i + 1}
                  </div>
                </div>
                <div className="mt-4 text-center">
                  <div className="font-display font-semibold text-sm">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
