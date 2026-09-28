import { ArrowRight, ShieldCheck, Clock3, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

const STAGES = ["New", "Contacted", "Docs", "Bank", "Sanctioned", "Disbursed"];

export function Hero() {
  return (
    <section className="relative min-h-[88vh] flex items-center overflow-hidden bg-white">
      {/* Soft mint atmosphere — same as rupeedial.com */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 100% 0%, rgba(232,247,236,0.95), transparent 55%), radial-gradient(70% 60% at 0% 100%, rgba(245,252,247,1), transparent 50%), linear-gradient(180deg, #ffffff 0%, #f5fcf7 100%)",
        }}
      />

      <div className="relative w-full max-w-6xl mx-auto px-5 pt-28 pb-14 lg:pt-32 lg:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="animate-fade-up">
            <p className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-[#10662A] leading-[1.05]">
              RupeeDial{" "}
              <span className="text-[#390A5D]">One</span>
            </p>

            <h1 className="mt-5 text-xl sm:text-2xl lg:text-[1.75rem] font-bold text-[#390A5D] leading-snug max-w-lg">
              Loan leads to disbursal —{" "}
              <span className="text-[#10662A]">one CRM</span> for every product.
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#5c4d72] max-w-md leading-relaxed">
              Website forms, marketplace buy, My Leads pipeline, and banker follow-ups — built for RupeeDial DSAs.
              <span className="text-[#10662A] font-semibold"> No clutter. Full details.</span>
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: ShieldCheck, t: "Secure CRM" },
                { icon: Clock3, t: "Live pipeline" },
                { icon: MapPin, t: "Pan-India leads" },
              ].map(({ icon: Icon, t }) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#cfe7d5] bg-[#E8F7EC]/70 px-3 py-1.5 text-xs font-semibold text-[#10662A]"
                >
                  <Icon className="size-3.5" />
                  {t}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="group rd-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all"
              >
                Open RupeeDial One
                <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#products"
                className="rd-btn-outline inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold transition-all"
              >
                View all products
              </a>
            </div>
          </div>

          {/* Right visual — white panel like site hero card */}
          <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
            <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5 sm:p-6 shadow-[0_4px_24px_rgba(16,102,42,0.08)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#10662A] mb-4">
                Live pipeline
              </div>
              <ul className="space-y-2.5">
                {STAGES.map((step, i) => (
                  <li
                    key={step}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      i === 0 ? "bg-[#E8F7EC]" : "bg-[#f5fcf7]"
                    }`}
                  >
                    <span
                      className={`size-2.5 rounded-full shrink-0 ${
                        i === 0 ? "bg-[#10662A]" : "bg-[#cfe7d5]"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        i === 0 ? "text-[#10662A]" : "text-[#390A5D]/70"
                      }`}
                    >
                      {step}
                    </span>
                    {i === 0 && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#10662A]">
                        Active
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
