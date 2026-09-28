import { Building2, Landmark, Shield, Wallet } from "lucide-react";
import { RUPEEDIAL_PRODUCT_MENUS, RUPEEDIAL_SITE } from "@/lib/rupeedial-products";

const SLUG: Record<string, string> = {
  "Home Loan": "home-loan",
  "Personal Loan": "personal-loan",
  "Auto Loan": "auto-loan",
  "Education Loan": "education-loan",
  "Credit Cards": "credit-cards",
  "Loan Against Property": "lap-loan",
  Insurance: "insurance",
  "MSME Loan": "msme-loan",
  "Mudra Loan": "mudra-loan",
  "Machinery Loan": "machinery-loan",
  "Working Capital Loan": "working-capital-loan",
  "Business Loan": "business-loan",
  "Startup Business Loan": "startup-business-loan",
  "CGTMSE Loan": "cgtmse-loan",
  "PMEGP Loan": "pmegp-loan",
  "Stand-Up India": "standup-india",
  "Subsidy Linked MSME": "subsidy-linked-msme",
  "Export Finance": "export-finance",
  "Import Finance": "import-finance",
  "LC / BG": "lc-bg",
  "Invoice Financing": "invoice-financing",
  "Cash Credit (CC)": "cash-credit",
  "Overdraft (OD)": "overdraft",
};

const ICONS = [Wallet, Building2, Shield, Landmark] as const;

export function Products() {
  return (
    <section id="products" className="relative py-16 sm:py-20 lg:py-24 overflow-hidden">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(70% 50% at 50% -10%, rgba(16,102,42,0.07), transparent 60%), linear-gradient(180deg, #f5fcf7 0%, #ffffff 55%, #f5fcf7 100%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto">
          <p className="inline-flex items-center rounded-full bg-[#E8F7EC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#10662A] ring-1 ring-[#10662A]/15">
            Products
          </p>
          <h2 className="mt-4 font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#390A5D]">
            Every RupeeDial product in{" "}
            <span className="bg-gradient-to-r from-[#10662A] to-[#0D4F20] bg-clip-text text-transparent">
              One
            </span>
          </h2>
          <p className="mt-3 text-sm sm:text-base text-[#5c4d72] leading-relaxed">
            Retail · MSME · Government schemes · Trade finance — full names, one CRM desk.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {RUPEEDIAL_PRODUCT_MENUS.map((menu, idx) => {
            const Icon = ICONS[idx] ?? Wallet;
            return (
              <article
                key={menu.title}
                className="group relative flex flex-col rounded-2xl border border-[#d8ecdd] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(16,102,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#10662A]/35 hover:shadow-[0_16px_40px_rgba(16,102,42,0.12)]"
              >
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#10662A] via-[#3cb371] to-[#10662A] opacity-80" />

                <div className="flex items-start gap-3">
                  <span className="size-10 shrink-0 rounded-xl bg-gradient-to-br from-[#E8F7EC] to-[#d8ecdd] grid place-items-center text-[#10662A] ring-1 ring-[#10662A]/10 group-hover:scale-105 transition-transform">
                    <Icon className="size-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10662A]">
                      {menu.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-[#5c4d72]">
                      {menu.items.length} products
                    </p>
                  </div>
                </div>

                <ul className="mt-5 flex-1 space-y-0 divide-y divide-[#eef6f0]">
                  {menu.items.map((name) => {
                    const slug = SLUG[name];
                    const href = slug ? `${RUPEEDIAL_SITE}/${slug}` : RUPEEDIAL_SITE;
                    return (
                      <li key={name}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2.5 py-2.5 text-[13px] sm:text-sm font-semibold text-[#390A5D] hover:text-[#10662A] transition-colors"
                        >
                          <span className="size-1.5 rounded-full bg-[#10662A]/70 shrink-0" />
                          <span className="leading-snug">{name}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>

                <a
                  href={RUPEEDIAL_SITE}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 pt-3 border-t border-[#d8ecdd] text-xs font-bold text-[#10662A] opacity-80 group-hover:opacity-100 transition-opacity"
                >
                  Apply on rupeedial.com →
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
