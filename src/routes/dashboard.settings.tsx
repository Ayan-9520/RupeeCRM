import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Share2, Copy, ExternalLink } from "lucide-react";
import { buildReferralLink, APPLY_PRODUCTS } from "@/lib/referrals";
import { crmMe, getCrmUser, updateCrmProfile, getPayoutBank, savePayoutBank, type CrmUser } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — RupeeDial One" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const [dsaId, setDsaId] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState("personal-loan");
  const [bank, setBank] = useState({
    account_holder: "",
    account_number: "",
    ifsc: "",
    bank_name: "",
    pan: "",
  });
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    (async () => {
      const cached = getCrmUser();
      if (cached) applyUser(cached);
      try {
        const me = await crmMe();
        applyUser(me);
        const b = await getPayoutBank();
        setBank({
          account_holder: b.account_holder || "",
          account_number: b.account_number || "",
          ifsc: b.ifsc || "",
          bank_name: b.bank_name || "",
          pan: b.pan || "",
        });
      } catch (e) {
        if (!cached) toast.error(e instanceof Error ? e.message : "Could not load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function applyUser(u: CrmUser) {
    setEmail(u.email ?? "");
    setForm({
      full_name: u.full_name ?? "",
      phone: u.phone ?? "",
    });
    setDsaId(u.dsa_id ?? null);
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateCrmProfile({
        full_name: form.full_name.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      applyUser(updated);
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const refLink = dsaId ? buildReferralLink(dsaId, productSlug) : "";

  if (loading) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#390A5D]">Settings</h1>
        <p className="text-[#5c4d72] mt-1">Manage your CRM profile and referral preferences.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl bg-white border border-[#d8ecdd] p-6 shadow-[0_4px_20px_rgba(16,102,42,0.05)] space-y-4">
        <h2 className="font-semibold text-[#390A5D]">Profile</h2>
        <label className="block">
          <span className="text-xs font-semibold text-[#5c4d72]">Full name</span>
          <input
            className="input-base w-full mt-1"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#5c4d72]">Phone</span>
          <input
            className="input-base w-full mt-1"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91 …"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#5c4d72]">Email</span>
          <input className="input-base w-full mt-1 bg-[#f5fcf7] text-[#5c4d72]" value={email} readOnly />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="bg-[#10662A] text-white rounded-xl px-4 py-2 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </button>
      </form>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSavingBank(true);
          try {
            const saved = await savePayoutBank(bank);
            setBank({
              account_holder: saved.account_holder,
              account_number: saved.account_number,
              ifsc: saved.ifsc,
              bank_name: saved.bank_name,
              pan: saved.pan,
            });
            toast.success(saved.complete ? "Bank details saved" : "Saved — fill all fields for payouts");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Bank save failed");
          } finally {
            setSavingBank(false);
          }
        }}
        className="rounded-2xl bg-white border border-[#d8ecdd] p-6 shadow-[0_4px_20px_rgba(16,102,42,0.05)] space-y-4"
      >
        <h2 className="font-semibold text-[#390A5D]">Bank details (payouts)</h2>
        <p className="text-xs text-[#5c4d72]">
          Required for earnings withdrawals (min ₹1,000). Lead wallet credits cannot be cashed out.
        </p>
        {(
          [
            ["account_holder", "Account holder"],
            ["account_number", "Account number"],
            ["ifsc", "IFSC"],
            ["bank_name", "Bank name"],
            ["pan", "PAN (optional)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="text-xs font-semibold text-[#5c4d72]">{label}</span>
            <input
              className="input-base w-full mt-1"
              value={bank[key]}
              onChange={(e) => setBank((b) => ({ ...b, [key]: e.target.value }))}
            />
          </label>
        ))}
        <button
          type="submit"
          disabled={savingBank}
          className="bg-[#10662A] text-white rounded-xl px-4 py-2 font-semibold inline-flex items-center gap-2 disabled:opacity-60"
        >
          {savingBank ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save bank
        </button>
      </form>

      {dsaId ? (
        <div className="rounded-2xl bg-white border border-[#d8ecdd] p-6 shadow-[0_4px_20px_rgba(16,102,42,0.05)] space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-[#E8F7EC] grid place-items-center text-[#10662A] shrink-0">
              <Share2 className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-[#390A5D]">Your referral link</h2>
              <p className="text-sm text-[#5c4d72]">
                DSA ID <span className="font-mono font-semibold text-[#10662A]">{dsaId}</span> — share with customers.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className="input-base">
              {APPLY_PRODUCTS.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
            <input readOnly value={refLink} className="input-base flex-1 min-w-[12rem] font-mono text-xs" />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(refLink);
                toast.success("Link copied!");
              }}
              className="rounded-xl border border-[#d8ecdd] px-3 py-2 hover:bg-[#E8F7EC] inline-flex items-center gap-1.5 text-sm font-semibold text-[#390A5D]"
            >
              <Copy className="size-3.5" /> Copy
            </button>
            <a
              href={refLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-[#d8ecdd] p-2 hover:bg-[#E8F7EC]"
            >
              <ExternalLink className="size-4 text-[#10662A]" />
            </a>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d8ecdd] bg-[#f5fcf7] p-5 text-sm text-[#5c4d72]">
          DSA ID appears after partner approval. Once approved, your referral link will show here.
        </div>
      )}
    </div>
  );
}
