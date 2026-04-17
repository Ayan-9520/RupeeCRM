import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section id="cta" className="py-24 lg:py-32 bg-secondary/40">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <div className="relative rounded-3xl bg-hero-gradient text-white px-8 py-16 lg:px-16 lg:py-20 overflow-hidden shadow-elevated">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-[oklch(0.78_0.16_165_/_0.3)] blur-3xl" />

          <div className="relative max-w-2xl">
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
              Ready to mine your next <span className="text-gradient">₹1 Cr</span>?
            </h2>
            <p className="mt-5 text-white/80 text-lg">
              Join 12,400+ DSAs already closing more loans with LeadMines. 14-day free trial. No card required.
            </p>

            <form className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg">
              <input
                type="email"
                required
                placeholder="you@company.com"
                className="flex-1 px-5 py-3.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md placeholder:text-white/50 text-white focus:outline-none focus:border-[oklch(0.78_0.16_165)] transition-smooth"
              />
              <button
                type="submit"
                className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-mint-gradient text-primary font-semibold shadow-mint hover:scale-[1.02] transition-smooth"
              >
                Get started
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-smooth" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
