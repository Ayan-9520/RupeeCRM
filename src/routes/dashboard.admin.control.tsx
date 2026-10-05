import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPipeline } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/admin/control")({
  head: () => ({ meta: [{ title: "Control Centre — Admin" }] }),
  component: ControlPage,
});

const MODULES = [
  { title: "Customers", to: "/dashboard/website-leads", note: "Website forms. Eligibility applications stay private." },
  { title: "Leads", to: "/dashboard/admin/leads", note: "Add and review CRM leads." },
  { title: "Partners", to: "/dashboard/admin/partners", note: "Approve a partner and open their login." },
  { title: "Telecallers", to: "/dashboard/admin/users", note: "Caller logins live with the other users." },
  { title: "Applications", to: "/dashboard/my-leads", note: "Owned cases from new to disbursed." },
  { title: "Lead Pricing", to: "/dashboard/admin/pricing", note: "Marketplace price rules." },
  { title: "Lead Allocation", to: "/dashboard/admin/pipeline", note: "Dedupe, consent, then assign." },
  { title: "Payout %", to: "/dashboard/admin/commissions", note: "Percent of a disbursed case. Invoices use the saved number." },
  { title: "Invoices", to: "/dashboard/admin/payouts", note: "Verify, process, and mark paid." },
  { title: "Campaigns", to: "/dashboard/admin/marketing", note: "Marketing templates." },
  { title: "Network", to: "/dashboard/admin/network", note: "Connector share is edited here, not hardcoded." },
  { title: "Training", to: "/dashboard/training", note: "Academy, scripts, and Ask RupeeDial." },
  { title: "Rewards", to: "/dashboard/rewards", note: "Partner rewards." },
  { title: "Reports", to: "/dashboard/los-executive", note: "Funnel and conversion." },
  { title: "Compliance", to: "/dashboard/training", note: "Consent and no bank promise, on the Academy page." },
  { title: "Audit Logs", to: "/dashboard/admin/trust", note: "Trust events, including pipeline import and allocation." },
] as const;

const LIFECYCLE = [
  "Business loan customer → credit card or OD → LAP → insurance",
  "Home loan customer → insurance → top-up → balance transfer",
  "Auto loan customer → insurance → refinance",
];

function ControlPage() {
  const [pipelineTotal, setPipelineTotal] = useState<number | null>(null);

  useEffect(() => {
    getPipeline()
      .then((data) => setPipelineTotal(data.total))
      .catch(() => setPipelineTotal(null));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D] lg:text-3xl">Control Centre</h1>
        <p className="mt-1 text-[#5c4d72]">
          Super Admin operating desk. Public pages stay on the website. Lender matching stays in OneFlo.
        </p>
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-semibold text-[#390A5D]">OneFlo</h2>
        <p className="mt-1 text-sm text-[#5c4d72]">
          Not connected. BRE, lender match, bank LOS, and document intelligence will use OneFlo when that API is available. This desk does not invent bank rules.
        </p>
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-semibold text-[#390A5D]">Customer lifecycle</h2>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-[#5c4d72]">
          {LIFECYCLE.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-2 text-xs text-[#5c4d72]">Ask RupeeDial can suggest a next product from an open case. It still does not sanction.</p>
      </section>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((item) => (
          <Link key={item.title} to={item.to} className="rounded-2xl border border-[#d8ecdd] bg-white p-4 hover:bg-[#f5fcf7]">
            <h2 className="font-semibold text-[#390A5D]">{item.title}</h2>
            <p className="mt-1 text-sm text-[#5c4d72]">{item.note}</p>
          </Link>
        ))}
        <article className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          <h2 className="font-semibold text-[#390A5D]">Data pipeline</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">{pipelineTotal === null ? "Open the pipeline to import." : `${pipelineTotal} rows in the private queue.`}</p>
        </article>
        <article className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          <h2 className="font-semibold text-[#390A5D]">Lenders, products, eligibility rules</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Product pages stay on the website. Eligibility comparison stays there too. Bank rules wait for OneFlo.</p>
        </article>
        <article className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          <h2 className="font-semibold text-[#390A5D]">API</h2>
          <p className="mt-1 text-sm text-[#5c4d72]">Website forms already post into this CRM. The public key stays in server config and is not shown here.</p>
        </article>
      </div>
    </div>
  );
}
