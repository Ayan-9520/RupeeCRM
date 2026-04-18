import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Share2, Copy, ExternalLink } from "lucide-react";
import { buildReferralLink, APPLY_PRODUCTS } from "@/lib/referrals";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — LeadMines" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", company_name: "" });
  const [allowMarketplace, setAllowMarketplace] = useState(false);
  const [dsaId, setDsaId] = useState<string | null>(null);
  const [productSlug, setProductSlug] = useState("personal-loan");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,phone,city,company_name,allow_marketplace,dsa_id")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          full_name: data.full_name ?? "", phone: data.phone ?? "",
          city: data.city ?? "", company_name: data.company_name ?? "",
        });
        setAllowMarketplace(Boolean(data.allow_marketplace));
        setDsaId(data.dsa_id);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  const toggleMarketplace = async (next: boolean) => {
    if (!user) return;
    setAllowMarketplace(next);
    const { error } = await supabase.from("profiles").update({ allow_marketplace: next }).eq("id", user.id);
    if (error) {
      toast.error(error.message);
      setAllowMarketplace(!next);
    } else {
      toast.success(next ? "Marketplace sharing enabled — you'll earn 20% on each sale" : "Marketplace sharing disabled — leads stay exclusive to you");
    }
  };

  const refLink = dsaId ? buildReferralLink(dsaId, productSlug) : "";

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and referral preferences.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
        <h2 className="font-semibold">Profile</h2>
        {(["full_name","phone","city","company_name"] as const).map((k) => (
          <label key={k} className="block">
            <span className="text-xs font-semibold text-foreground/70 capitalize">{k.replace("_"," ")}</span>
            <input className="input-base w-full mt-1" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
          </label>
        ))}
        <button disabled={saving} className="bg-accent text-accent-foreground rounded-xl px-4 py-2 font-semibold inline-flex items-center gap-2">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </button>
      </form>

      {dsaId && (
        <div className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-accent/15 grid place-items-center text-accent shrink-0">
              <Share2 className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Your referral link</h2>
              <p className="text-sm text-muted-foreground">Share with customers — referred leads come straight to your dashboard, free.</p>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <select value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className="input-base">
              {APPLY_PRODUCTS.map((p) => <option key={p.slug} value={p.slug}>{p.label}</option>)}
            </select>
            <input readOnly value={refLink} className="input-base flex-1 font-mono text-xs" />
            <button onClick={() => { navigator.clipboard.writeText(refLink); toast.success("Link copied!"); }} className="rounded-xl border border-border px-3 py-2 hover:bg-secondary inline-flex items-center gap-1.5 text-sm font-semibold">
              <Copy className="size-3.5" /> Copy
            </button>
            <a href={refLink} target="_blank" rel="noreferrer" className="rounded-xl border border-border p-2 hover:bg-secondary"><ExternalLink className="size-4" /></a>
          </div>

          <div className="rounded-xl border border-border bg-secondary/30 p-4 flex items-start gap-3">
            <input
              id="mkt"
              type="checkbox"
              checked={allowMarketplace}
              onChange={(e) => toggleMarketplace(e.target.checked)}
              className="size-4 mt-0.5 accent-accent"
            />
            <label htmlFor="mkt" className="text-sm cursor-pointer">
              <div className="font-semibold">Allow my referred leads to be sold in the marketplace</div>
              <div className="text-muted-foreground text-xs mt-1">
                When enabled, leads from your link enter the public marketplace. You earn <strong>20% commission</strong> when another DSA buys & disburses them. When disabled (default), referred leads stay <strong>exclusive & free</strong> for you only.
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
