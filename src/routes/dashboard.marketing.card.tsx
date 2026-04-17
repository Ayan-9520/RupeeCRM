import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VisitingCardCanvas, type CardData } from "@/components/marketing/VisitingCardCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import { Loader2, Save, X, Plus } from "lucide-react";
import { buildReferralLink, generateReferralCode } from "@/lib/marketing";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/card")({
  component: VisitingCardPage,
});

const THEMES = [
  { name: "Midnight", bg: "#0c2340", accent: "#2dd4a8", text: "#ffffff" },
  { name: "Noir Gold", bg: "#0d0d0d", accent: "#c9a84c", text: "#f5f0e0" },
  { name: "Cloud", bg: "#fafbfc", accent: "#3b82f6", text: "#0a0a1a" },
  { name: "Emerald", bg: "#064e3b", accent: "#73ffb8", text: "#ffffff" },
  { name: "Sunset", bg: "#5c2018", accent: "#e8b84a", text: "#ffffff" },
  { name: "Charcoal", bg: "#1a1a1a", accent: "#e85d3a", text: "#ffffff" },
];

const PRODUCT_OPTIONS = [
  "Personal Loan", "Business Loan", "Home Loan", "LAP", "MSME",
  "Credit Card", "Insurance", "Mutual Funds",
];

function VisitingCardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cardId, setCardId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    full_name: "", designation: "DSA Partner", company_name: "LeadMines",
    phone: "", email: "", whatsapp: "", website: "", city: "",
    photo_url: "", logo_url: "",
  });
  const [products, setProducts] = useState<string[]>(["Personal Loan", "Business Loan", "Insurance"]);
  const [theme, setTheme] = useState(THEMES[0]);
  const [productInput, setProductInput] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: cards }, { data: profile }] = await Promise.all([
        supabase.from("visiting_cards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        supabase.from("profiles").select("full_name, phone, company_name, city").eq("id", user.id).maybeSingle(),
      ]);
      const code = generateReferralCode(profile?.full_name ?? user.email ?? "user", user.id);
      setReferralCode(code);
      const c = (cards ?? [])[0];
      if (c) {
        setCardId(c.id);
        setForm({
          full_name: c.full_name, designation: c.designation ?? "",
          company_name: c.company_name ?? "", phone: c.phone, email: c.email ?? "",
          whatsapp: c.whatsapp ?? "", website: c.website ?? "", city: c.city ?? "",
          photo_url: c.photo_url ?? "", logo_url: c.logo_url ?? "",
        });
        setProducts(c.products ?? []);
        const t = (c.theme as any) ?? {};
        const matched = THEMES.find((x) => x.bg === t.bg) ?? THEMES[0];
        setTheme(matched);
      } else {
        setForm((f) => ({
          ...f,
          full_name: profile?.full_name ?? user.email?.split("@")[0] ?? "",
          phone: profile?.phone ?? "",
          company_name: profile?.company_name ?? "LeadMines",
          email: user.email ?? "",
          city: profile?.city ?? "",
        }));
      }
      setLoading(false);
    })();
  }, [user]);

  const cardData: CardData = useMemo(() => ({
    full_name: form.full_name || "Your Name",
    designation: form.designation, company_name: form.company_name,
    phone: form.phone || "+91 ", email: form.email, whatsapp: form.whatsapp,
    website: form.website, city: form.city,
    photo_url: form.photo_url, logo_url: form.logo_url,
    products,
    theme: { bg: theme.bg, accent: theme.accent, text: theme.text },
    qrValue: buildReferralLink(referralCode),
  }), [form, products, theme, referralCode]);

  const addProduct = (p?: string) => {
    const val = (p ?? productInput).trim();
    if (!val || products.includes(val)) return;
    setProducts([...products, val]);
    setProductInput("");
  };

  const save = async () => {
    if (!user) return;
    if (!form.full_name || !form.phone) { toast.error("Name and phone required"); return; }
    setSaving(true);
    const payload = {
      user_id: user.id,
      full_name: form.full_name, designation: form.designation || null,
      company_name: form.company_name || null, phone: form.phone,
      email: form.email || null, whatsapp: form.whatsapp || null,
      website: form.website || null, city: form.city || null,
      photo_url: form.photo_url || null, logo_url: form.logo_url || null,
      products,
      theme: { bg: theme.bg, accent: theme.accent, text: theme.text },
      is_default: true,
    };
    const { data, error } = cardId
      ? await supabase.from("visiting_cards").update(payload).eq("id", cardId).select().single()
      : await supabase.from("visiting_cards").insert(payload).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setCardId(data.id);
    toast.success("Card saved");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 bg-muted/30 flex items-center justify-center min-h-[420px] overflow-auto">
            <div style={{ transform: "scale(0.55)", transformOrigin: "top center" }}>
              <VisitingCardCanvas ref={canvasRef} data={cardData} />
            </div>
          </CardContent>
        </Card>
        <ShareBar
          targetRef={canvasRef}
          shareText={`${cardData.full_name} · ${cardData.designation ?? ""}\n${cardData.company_name ?? ""}\n📞 ${cardData.phone}\n${buildReferralLink(referralCode)}`}
          shareUrl={buildReferralLink(referralCode)}
          filename={`${form.full_name || "card"}-card.png`}
        />
      </div>

      <div className="space-y-5">
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="font-semibold flex items-center justify-between">
              Card details
              <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <Label className="text-xs">Full name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Phone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">WhatsApp</Label>
                <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Website</Label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="font-semibold">Products offered</div>
            <div className="flex flex-wrap gap-1.5">
              {products.map((p) => (
                <Badge key={p} variant="secondary" className="gap-1 pr-1">
                  {p}
                  <button onClick={() => setProducts(products.filter((x) => x !== p))} className="hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PRODUCT_OPTIONS.filter((p) => !products.includes(p)).map((p) => (
                <Button key={p} size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addProduct(p)}>
                  <Plus className="size-3" /> {p}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Input placeholder="Custom product…" value={productInput} onChange={(e) => setProductInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProduct())} />
              <Button onClick={() => addProduct()} variant="outline">Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="font-semibold">Theme</div>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t) => {
                const active = theme.bg === t.bg;
                return (
                  <button
                    key={t.name}
                    onClick={() => setTheme(t)}
                    className={`rounded-lg border-2 p-2 text-left transition-all ${active ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}
                  >
                    <div className="h-10 rounded flex" style={{ background: t.bg }}>
                      <div className="w-1/3" style={{ background: t.accent }} />
                    </div>
                    <div className="text-xs mt-1.5 font-medium">{t.name}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
