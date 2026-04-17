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
import { PostCanvas } from "@/components/marketing/PostCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import {
  type MarketingTemplate, type PartnerBranding, PRODUCT_LABEL,
  buildReferralLink, generateReferralCode, personalize,
} from "@/lib/marketing";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard/marketing/posts")({
  component: PostsBuilder,
});

function PostsBuilder() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<MarketingTemplate | null>(null);
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [branding, setBranding] = useState<PartnerBranding>({
    name: "", phone: "", company: "LeadMines", referralLink: "", email: "",
  });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Load profile + templates
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: tpls }, { data: profile }] = await Promise.all([
        supabase.from("marketing_templates").select("*").eq("kind", "post").eq("enabled", true).order("display_order"),
        supabase.from("profiles").select("full_name, phone, company_name").eq("id", user.id).maybeSingle(),
      ]);
      const list = (tpls ?? []) as unknown as MarketingTemplate[];
      setTemplates(list);
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

  const filtered = useMemo(
    () => filter === "all" ? templates : templates.filter((t) => t.product === filter),
    [templates, filter],
  );

  const pickTemplate = (t: MarketingTemplate) => {
    setSelected(t);
    setHeadline(t.headline);
    setBody(t.body ?? "");
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
    <div className="grid lg:grid-cols-[320px_1fr_360px] gap-6">
      {/* Template list */}
      <div className="space-y-3">
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

      {/* Preview */}
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
                />
              </div>
            ) : (
              <div className="text-muted-foreground">Pick a template to preview</div>
            )}
          </CardContent>
        </Card>
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
