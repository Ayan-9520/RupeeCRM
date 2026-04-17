import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PostCanvas } from "@/components/marketing/PostCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import {
  type MarketingTemplate, type PartnerBranding,
  buildReferralLink, generateReferralCode, personalize, PRODUCT_LABEL,
} from "@/lib/marketing";
import { Loader2, Sparkles, Shuffle, Zap } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/oneclick")({
  component: OneClick,
});

function pickRandom<T>(arr: T[]): T | null {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function OneClick() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketingTemplate | null>(null);
  const [branding, setBranding] = useState<PartnerBranding>({
    name: "", phone: "", company: "LeadMines", referralLink: "", email: "",
  });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: tpls }, { data: profile }] = await Promise.all([
        supabase.from("marketing_templates").select("*").eq("kind", "post").eq("enabled", true),
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
      // Prefer trending → daily → any
      const trending = list.filter((t) => (t as any).is_trending);
      const daily = list.filter((t) => (t as any).is_daily);
      setSelected(pickRandom(trending) ?? pickRandom(daily) ?? pickRandom(list));
      setLoading(false);
    })();
  }, [user]);

  const generate = (pool: "trending" | "daily" | "festival" | "any" = "any") => {
    let list = templates;
    if (pool === "trending") list = templates.filter((t) => (t as any).is_trending);
    if (pool === "daily") list = templates.filter((t) => (t as any).is_daily);
    if (pool === "festival") list = templates.filter((t) => (t as any).category === "festival");
    if (!list.length) {
      toast.error("No templates available in this category yet.");
      return;
    }
    // Avoid repeating same template
    const others = list.filter((t) => t.id !== selected?.id);
    setSelected(pickRandom(others.length ? others : list));
    toast.success("Fresh post ready!");
  };

  const shareText = useMemo(() => {
    if (!selected) return "";
    return [
      personalize(selected.headline, branding),
      personalize(selected.body ?? "", branding),
      "",
      `📞 ${branding.name} · ${branding.phone}`,
      `Apply: ${branding.referralLink}`,
    ].filter(Boolean).join("\n");
  }, [selected, branding]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/10 to-transparent p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-xl bg-primary/20 grid place-items-center">
            <Zap className="size-6 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              One Click Post <Sparkles className="size-5 text-primary" />
            </h2>
            <p className="text-muted-foreground mt-1">
              We'll pick a high-converting template, brand it with your details, and prep it to share — instantly.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <Button onClick={() => generate("trending")} size="lg" className="gap-2">
            <Zap className="size-4" /> Generate Trending
          </Button>
          <Button onClick={() => generate("daily")} variant="secondary" size="lg" className="gap-2">
            <Shuffle className="size-4" /> Today's Post
          </Button>
          <Button onClick={() => generate("festival")} variant="outline" size="lg" className="gap-2">
            🎉 Festival Special
          </Button>
          <Button onClick={() => generate("any")} variant="ghost" size="lg" className="gap-2">
            <Shuffle className="size-4" /> Surprise Me
          </Button>
        </div>
      </div>

      {selected && (
        <div className="grid md:grid-cols-[1fr_320px] gap-6 items-start">
          <Card>
            <CardContent className="p-4 bg-muted/30 flex items-center justify-center min-h-[480px] overflow-auto">
              <div style={{ transform: "scale(0.42)", transformOrigin: "top center" }}>
                <PostCanvas ref={canvasRef} template={selected} branding={branding} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{PRODUCT_LABEL[selected.product]}</Badge>
                {(selected as any).is_trending && <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">🔥 Trending</Badge>}
                {(selected as any).is_daily && <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">📅 Daily</Badge>}
                {(selected as any).category === "festival" && <Badge className="bg-pink-500/15 text-pink-600 border-pink-500/30">🎉 Festival</Badge>}
              </div>
              <div className="font-semibold">{selected.name}</div>
              <div className="text-sm text-muted-foreground">{selected.headline}</div>
            </div>

            <ShareBar
              targetRef={canvasRef}
              shareText={shareText}
              shareUrl={branding.referralLink}
              filename={`oneclick-${selected.product}-${Date.now()}.png`}
            />

            <Button variant="outline" className="w-full gap-2" onClick={() => generate("any")}>
              <Shuffle className="size-4" /> Generate Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
