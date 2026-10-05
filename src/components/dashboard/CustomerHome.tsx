import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getCustomerHome, type CustomerApplication } from "@/lib/python-api";

type Application = CustomerApplication;

const SECTIONS = [
  "My Applications",
  "Eligibility",
  "Offers",
  "Documents",
  "Application Status",
  "Sanction",
  "Disbursement",
  "My Advisor",
  "Support",
  "Recommended Products",
  "Notifications",
] as const;

type Section = (typeof SECTIONS)[number];

function inr(n: number | null | undefined) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

export function CustomerHome({ firstName }: { firstName: string }) {
  const [section, setSection] = useState<Section>("My Applications");
  const [rows, setRows] = useState<Application[]>([]);
  const [advisor, setAdvisor] = useState("RupeeDial expert");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCustomerHome()
      .then((data) => {
        setRows(data.applications ?? []);
        if (data.advisor) setAdvisor(data.advisor);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const current = rows[0];
  const site = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:5173"
    : "https://rupeedial.com";

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#10662A]">Customer</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-[#390A5D]">
          {firstName ? `${firstName}'s loans` : "Your loans"}
        </h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          Applications from Check Eligibility. Lender approval still happens with the bank, not on this screen.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSection(item)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              section === item ? "bg-[#10662A] text-white" : "border border-[#d8ecdd] bg-white text-[#390A5D]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8ecdd] p-8 text-center">
          <p className="font-semibold text-[#390A5D]">No application yet</p>
          <a href={`${site}/check-eligibility`} className="mt-3 inline-flex rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white">
            Check eligibility
          </a>
        </div>
      ) : (
        <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
          {section === "My Applications" && (
            <ul className="divide-y divide-[#d8ecdd]">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-[#390A5D]">{row.product}</div>
                    <div className="text-xs text-[#5c4d72]">{row.reference} · {row.city || "—"} · {row.lender || "Offer pending"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#10662A]">{inr(row.amount)}</div>
                    <div className="text-[10px] font-bold uppercase text-[#5c4d72]">{row.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {section === "Eligibility" && current && (
            <p className="text-sm text-[#390A5D]">
              {current.product} for {inr(current.income)} monthly income. Indicative eligibility {inr(current.amount)}. This is not a bank sanction.
            </p>
          )}
          {section === "Offers" && current && (
            <p className="text-sm text-[#390A5D]">
              {current.lender ? `${current.lender} · ${current.rate ?? "—"}% · EMI ${inr(current.emi)}` : "Choose an offer on Check Eligibility to see it here."}
            </p>
          )}
          {section === "Documents" && (
            <p className="text-sm text-[#390A5D]">
              {(current?.documents ?? []).length ? current?.documents.join(", ") : "Documents are collected with your expert after this check. Upload stays on the eligibility form."}
            </p>
          )}
          {section === "Application Status" && current && <p className="text-sm font-semibold text-[#390A5D]">{current.status}</p>}
          {section === "Sanction" && (
            <p className="text-sm text-[#390A5D]">{current?.sanction ? inr(current.sanction) : "No sanction yet. The lender updates this after login."}</p>
          )}
          {section === "Disbursement" && (
            <p className="text-sm text-[#390A5D]">{current?.disbursement ? inr(current.disbursement) : "No disbursement yet."}</p>
          )}
          {section === "My Advisor" && <p className="text-sm text-[#390A5D]">{advisor} will call on the mobile you used for eligibility.</p>}
          {section === "Support" && (
            <a href={`${site}/expert`} className="text-sm font-semibold text-[#10662A]">Talk to an expert</a>
          )}
          {section === "Recommended Products" && (
            <ul className="space-y-2 text-sm text-[#390A5D]">
              {(current?.recommended ?? []).map((item) => (
                <li key={item}>
                  <a className="font-semibold text-[#10662A]" href={`${site}/check-eligibility?product=${encodeURIComponent(item)}`}>{item}</a>
                </li>
              ))}
            </ul>
          )}
          {section === "Notifications" && (
            <ul className="space-y-2 text-sm text-[#5c4d72]">
              {rows.map((row) => (
                <li key={row.id}>
                  {row.product} is {row.status}
                  {row.created_at ? ` · ${new Date(row.created_at).toLocaleString("en-IN")}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
