import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2 } from "lucide-react";
import { getMyNetwork, inviteNetworkPartner, type NetworkMe } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/network")({
  head: () => ({ meta: [{ title: "Network — RupeeDial One" }] }),
  component: NetworkPage,
});

function inr(n: number) {
  return `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
}

function inviteUrl(code: string) {
  const host = window.location.hostname;
  const site = host === "localhost" || host === "127.0.0.1" ? "http://127.0.0.1:5173" : "https://rupeedial.com";
  return `${site}/become-partner?ref=${encodeURIComponent(code)}`;
}

function NetworkPage() {
  const [data, setData] = useState<NetworkMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setData(await getMyNetwork());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load network");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const invite = async () => {
    if (name.trim().length < 2) {
      toast.error("Enter the partner name");
      return;
    }
    setBusy(true);
    try {
      const row = await inviteNetworkPartner({ full_name: name.trim(), phone, email });
      const url = inviteUrl(row.code);
      setLink(url);
      setName("");
      setPhone("");
      setEmail("");
      toast.success("Invite created");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const cards = [
    ["My Network", String(data.connector_count), "Invited and joined"],
    ["My Connectors", String(data.connector_count), "People on your code"],
    ["Active Connectors", String(data.active_count), "Joined and active"],
    ["Business Generated", inr(data.business), "Disbursed in the downline"],
    ["Network Revenue", inr(data.revenue), "From admin share rules"],
    ["Performance", `${data.performance}%`, "Disbursed cases / purchases"],
    ["Rewards", inr(data.revenue), "Same share, by level"],
  ] as const;

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Network</h1>
        <p className="mt-1 text-sm text-[#5c4d72]">
          Invite connectors. Revenue share follows the levels set by admin, not a fixed rate in the product.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl border border-[#d8ecdd] bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#5c4d72]">{label}</p>
            <p className="mt-1 font-display text-lg font-bold text-[#10662A]">{value}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{hint}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-semibold text-[#390A5D]">Invite partner</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Mobile" className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm" />
        </div>
        <button type="button" disabled={busy} onClick={() => void invite()} className="mt-3 rounded-xl bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Creating…" : "Create invite link"}
        </button>
        {link ? (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link copied");
            }}
            className="mt-3 flex items-center gap-2 text-left text-sm font-medium text-[#10662A]"
          >
            <Copy className="size-4" /> {link}
          </button>
        ) : null}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white p-4">
        <h2 className="font-semibold text-[#390A5D]">Rewards by level</h2>
        {data.rewards.length === 0 ? (
          <p className="mt-2 text-sm text-[#5c4d72]">Admin has not published network levels yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#d8ecdd]">
            {data.rewards.map((row) => (
              <li key={row.level} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{row.label} · {row.share_percent}% of their commission · {row.connectors} connectors</span>
                <span className="font-bold text-[#10662A]">{inr(row.reward)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#d8ecdd] bg-white">
        <h2 className="border-b border-[#d8ecdd] px-4 py-3 font-semibold text-[#390A5D]">Connectors</h2>
        {data.connectors.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#5c4d72]">No connectors yet. Send an invite link.</p>
        ) : (
          <ul className="divide-y divide-[#d8ecdd]">
            {data.connectors.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium text-[#390A5D]">{row.name || "Invited partner"}</div>
                  <div className="text-xs text-[#5c4d72]">{row.email || row.phone || row.code} · {row.code}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-[#10662A]">{inr(row.business)}</div>
                  <div className="text-[10px] font-bold uppercase text-[#5c4d72]">{row.status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
