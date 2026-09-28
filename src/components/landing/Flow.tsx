const steps = [
  { n: "01", title: "Lead arrives", desc: "Form saves to DB, emails the team, and syncs into One." },
  { n: "02", title: "Buy on Leadboard", desc: "Filter by product and city, purchase with wallet." },
  { n: "03", title: "Work in My Leads", desc: "Auto-filled fields, notes, follow-ups, stage moves." },
  { n: "04", title: "Disburse", desc: "New → Contacted → Docs → Bank → Sanctioned → Disbursed." },
];

export function Flow() {
  return (
    <section id="flow" className="py-16 sm:py-20 lg:py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5">
        <div className="max-w-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#10662A]">
            How One works
          </p>
          <h2 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#390A5D]">
            Four steps. Zero clutter.
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#5c4d72]">
            Same flow for Personal Loan, CGTMSE, Subsidy, and Trade Finance.
          </p>
        </div>

        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-[#d8ecdd] bg-[#E8F7EC]/40 p-5"
            >
              <div className="font-display text-sm font-bold text-[#10662A] tracking-wide">{s.n}</div>
              <h3 className="mt-2 font-bold text-[#390A5D] text-lg">{s.title}</h3>
              <p className="mt-1.5 text-sm text-[#5c4d72] leading-relaxed">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
