import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CTA() {
  return (
    <section className="py-16 sm:py-20 bg-[#f5fcf7]">
      <div className="max-w-6xl mx-auto px-5">
        <div className="rounded-2xl border border-[#d8ecdd] bg-white px-6 py-12 sm:px-12 sm:py-14 shadow-[0_4px_24px_rgba(16,102,42,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#10662A]">
            RupeeDial One
          </p>
          <h2 className="mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#390A5D] max-w-lg">
            Ready to run your desk?
          </h2>
          <p className="mt-3 text-[#5c4d72] text-sm sm:text-base max-w-md leading-relaxed">
            Sign in to buy leads, edit full form data, and move cases to disbursal.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rd-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            >
              Open RupeeDial One
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://rupeedial.com"
              target="_blank"
              rel="noreferrer"
              className="rd-btn-outline inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
            >
              Visit rupeedial.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
