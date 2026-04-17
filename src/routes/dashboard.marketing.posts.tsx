import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCanvas } from "@/components/marketing/PostCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import {
  type MarketingTemplate, type PartnerBranding, PRODUCT_LABEL,
  buildReferralLink, generateReferralCode, personalize,
} from "@/lib/marketing";
import { Loader2, Sparkles, Wand2, ImageOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/posts")({
  component: PostsBuilder,
});

interface ProductImage {
  id: string;
  product: string;
  image_url: string;
}

function PostsBuilder() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [tab, setTab] = useState<"all" | "trending" | "festival" | "daily">("all");
  const [selected, setSelected] = useState<MarketingTemplate | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [branding, setBranding] = useState<PartnerBranding>({
    name: "", phone: "", company: "LeadMines", referralLink: "", email: "",
  });
  const [images, setImages] = useState<ProductImage[]>([]);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [generatingImg, setGeneratingImg] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load profile + templates + product images
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: tpls }, { data: profile }, { data: imgs }] = await Promise.all([
        supabase.from("marketing_templates").select("*").eq("kind", "post").eq("enabled", true).order("display_order"),
        supabase.from("profiles").select("full_name, phone, company_name").eq("id", user.id).maybeSingle(),
        supabase.from("product_images" as any).select("id, product, image_url").eq("is_active", true).order("display_order"),
      ]);
      const list = (tpls ?? []) as unknown as MarketingTemplate[];
      setTemplates(list);
      setImages((imgs ?? []) as ProductImage[]);
      const code = generateReferralCode(profile?.full_name ?? user.email ?? "user", user.id);
      setBranding({
        name: profile?.full_name ?? user.email?.split("@")[0] ?? "Partner",
        phone: profile?.phone ?? "+91 ",
        company: profile?.company_name ?? "LeadMines",
        referralLink: buildReferralLink(code),
        email: user.email ?? "",
      });
      if (list[0]) {
        setSelected(list[0]);
        setHeadline(list[0].headline);
        setBody(list[0].body ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    let list = templates;
    if (tab === "trending") list = list.filter((t) => (t as any).is_trending);
    else if (tab === "festival") list = list.filter((t) => (t as any).category === "festival");
    else if (tab === "daily") list = list.filter((t) => (t as any).is_daily);
    if (filter !== "all") list = list.filter((t) => t.product === filter);
    return list;
  }, [templates, filter, tab]);

  // Images for the currently-selected product (with generic fallback)
  const productImages = useMemo(() => {
    if (!selected) return [];
    const own = images.filter((i) => i.product === selected.product);
    if (own.length >= 1) return own.slice(0, 6);
    return images.filter((i) => i.product === "generic").slice(0, 6);
  }, [images, selected]);

  // Auto-pick the first image when template changes
  useEffect(() => {
    if (!selected) return;
    setActiveImage(productImages[0]?.image_url ?? null);
  }, [selected?.id, productImages.length]);

  const pickTemplate = (t: MarketingTemplate) => {
    setSelected(t);
    setHeadline(t.headline);
    setBody(t.body ?? "");
  };

  const generateAIImage = async () => {
    if (!selected) return;
    setGeneratingImg(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-marketing-image", {
        body: { product: selected.product },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.image_url;
      if (!url) throw new Error("No image returned");
      // Optimistic add
      const newImg: ProductImage = { id: crypto.randomUUID(), product: selected.product, image_url: url };
      setImages((prev) => [newImg, ...prev]);
      setActiveImage(url);
      toast.success("AI image generated!");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to generate image");
    } finally {
      setGeneratingImg(false);
    }
  };

  const shareText = useMemo(() => {
    if (!selected) return "";
    const lines = [
      personalize(headline, branding),
      personalize(body, branding),
      "",
      `📞 ${branding.name} · ${branding.phone}`,
      `Apply: ${branding.referralLink}`,
    ];
    return lines.filter(Boolean).join("\n");
  }, [selected, headline, body, branding]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid lg:grid-cols-[300px_1fr_340px] gap-6">
      {/* Template list */}
      <div className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="trending">🔥</TabsTrigger>
            <TabsTrigger value="festival">🎉</TabsTrigger>
            <TabsTrigger value="daily">📅</TabsTrigger>
          </TabsList>
        </Tabs>
        <Label>Filter by product</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {Object.entries(PRODUCT_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {filtered.map((t) => {
            const active = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => pickTemplate(t)}
                className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary ${active ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="size-12 rounded-md shrink-0 grid place-items-center text-xs font-bold"
                    style={{ background: t.theme.bg, color: t.theme.text }}
                  >
                    {t.product.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{PRODUCT_LABEL[t.product]}</div>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">No templates for this product.</div>
          )}
        </div>
      </div>

      {/* Preview + image picker */}
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4 bg-muted/30 flex items-center justify-center min-h-[480px] overflow-auto">
            {selected ? (
              <div style={{ transform: "scale(0.42)", transformOrigin: "top center" }}>
                <PostCanvas
                  ref={canvasRef}
                  template={selected}
                  branding={branding}
                  customHeadline={headline}
                  customBody={body}
                  imageUrl={activeImage}
                />
              </div>
            ) : (
              <div className="text-muted-foreground">Pick a template to preview</div>
            )}
          </CardContent>
        </Card>

        {/* Product image picker */}
        {selected && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                Product visuals — {PRODUCT_LABEL[selected.product]}
              </div>
              <Button size="sm" variant="outline" onClick={generateAIImage} disabled={generatingImg} className="gap-2">
                {generatingImg ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                Generate AI Image
              </Button>
            </div>
            {productImages.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <ImageOff className="size-4" />
                No images yet — click "Generate AI Image" to create one.
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                <button
                  onClick={() => setActiveImage(null)}
                  className={`aspect-square rounded-md border-2 grid place-items-center text-xs font-medium transition-all ${!activeImage ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                  title="No image"
                >
                  <ImageOff className="size-4 text-muted-foreground" />
                </button>
                {productImages.map((img) => {
                  const active = activeImage === img.image_url;
                  return (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(img.image_url)}
                      className={`aspect-square rounded-md border-2 overflow-hidden transition-all ${active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"}`}
                    >
                      <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selected && (
          <ShareBar
            targetRef={canvasRef}
            shareText={shareText}
            shareUrl={branding.referralLink}
            filename={`${selected.product}-${Date.now()}.png`}
          />
        )}
      </div>

      {/* Editor */}
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3 bg-primary/5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" />
            Auto-personalization
          </div>
          <div className="text-xs text-muted-foreground">
            Your details are inserted automatically. Use <code className="text-primary">{`{{name}}`}</code>, <code className="text-primary">{`{{phone}}`}</code>, <code className="text-primary">{`{{company}}`}</code>, <code className="text-primary">{`{{link}}`}</code> in copy.
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Your Name</Label>
            <Input value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Company / Brand</Label>
            <Input value={branding.company} onChange={(e) => setBranding({ ...branding, company: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Referral / Apply link</Label>
            <Input value={branding.referralLink} onChange={(e) => setBranding({ ...branding, referralLink: e.target.value })} />
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t">
          {selected && <Badge variant="secondary">{selected.name}</Badge>}
          <div>
            <Label className="text-xs">Headline</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Body</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </div>
          {selected && (
            <Button variant="outline" size="sm" onClick={() => pickTemplate(selected)} className="w-full">
              Reset to template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
