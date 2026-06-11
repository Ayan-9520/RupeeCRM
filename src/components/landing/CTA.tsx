import { ArrowRight, MessageCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CTA() {
  return (
    <section id="cta" className="py-24 lg:py-32 bg-background relative">
      <div className="max-w-5xl mx-auto px-5 lg:px-8">
        <div className="relative rounded-3xl wa-header-bar text-white px-8 py-16 lg:px-16 lg:py-20 overflow-hidden shadow-elevated">
          <div className="absolute inset-0 wa-pattern opacity-10" />
          <div className="absolute -top-24 -right-24 size-80 rounded-full bg-[var(--wa-green)]/25 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 size-64 rounded-full bg-white/5 blur-2xl" />

          <div className="relative max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium mb-6">
              <MessageCircle className="size-3.5" />
              WhatsApp-ready CRM · Instant alerts
            </div>
            <h2 className="text-3xl lg:text-5xl font-bold tracking-tight">
              Ready to mine your next <span className="text-[var(--wa-green)]">₹1 Cr</span>?
            </h2>
            <p className="mt-5 text-white/80 text-lg">
              Join 12,400+ DSAs already closing more loans with LeadMines. ₹500 free wallet credit. No card required.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to="/auth"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white font-semibold shadow-mint hover:scale-[1.02] transition-smooth"
              >
                Create your free account
                <ArrowRight className="size-4 group-hover:translate-x-1 transition-smooth" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-white/10 border border-white/25 backdrop-blur-md text-white font-semibold hover:bg-white/15 transition-smooth"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
