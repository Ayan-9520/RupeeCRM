import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Film, Sparkles, Download, Play, Loader2 } from "lucide-react";
import type { MarketingTemplate } from "@/lib/marketing";
import { PRODUCT_LABEL } from "@/lib/marketing";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/reels")({
  component: ReelsPage,
});

function ReelsPage() {
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("marketing_templates").select("*").eq("kind", "reel").eq("enabled", true).order("display_order");
      setTemplates((data ?? []) as unknown as MarketingTemplate[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-gradient-to-br from-purple-500/10 to-pink-500/5 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-primary mt-0.5" />
          <div>
            <div className="font-semibold">Reel templates (preview)</div>
            <div className="text-sm text-muted-foreground">
              Pick a script structure, record a 15-second video on your phone, and overlay our PNG title cards.
              Full in-app reel editor with music & timeline arrives in v2.
            </div>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <div
              className="aspect-[9/16] flex flex-col justify-between p-6 relative"
              style={{ background: t.theme.bg, color: t.theme.text }}
            >
              <div className="absolute top-3 right-3">
                <Badge style={{ background: t.theme.accent, color: t.theme.bg }}>{PRODUCT_LABEL[t.product]}</Badge>
              </div>
              <div className="size-10 rounded-full grid place-items-center" style={{ background: t.theme.accent, color: t.theme.bg }}>
                <Film className="size-5" />
              </div>
              <div>
                <div className="text-3xl font-black leading-tight">{t.headline}</div>
                {t.subheadline && (
                  <div className="text-sm mt-2 opacity-80">{t.subheadline}</div>
                )}
                <div className="text-xs mt-4 opacity-70 italic">{t.body}</div>
              </div>
              <div className="text-base font-bold px-4 py-2 rounded-lg w-fit" style={{ background: t.theme.accent, color: t.theme.bg }}>
                {t.cta}
              </div>
            </div>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div className="text-sm font-medium truncate">{t.name}</div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-8" onClick={() => toast.info("Reel preview coming soon")}>
                  <Play className="size-4" />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => toast.info("Download enabled in v2 reel editor")}>
                  <Download className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {templates.length === 0 && (
          <div className="col-span-full text-sm text-muted-foreground text-center py-12">No reel templates yet.</div>
        )}
      </div>
    </div>
  );
}
