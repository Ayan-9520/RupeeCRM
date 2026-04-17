import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildReferralLink, generateReferralCode, personalize, shareWhatsApp,
  type PartnerBranding, type MarketingTemplate, PRODUCT_LABEL,
} from "@/lib/marketing";
import { Copy, MessageCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/whatsapp")({
  component: WhatsAppCampaign,
});

function WhatsAppCampaign() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MarketingTemplate | null>(null);
  const [editor, setEditor] = useState("");
  const [recipient, setRecipient] = useState("");
  const [bulkList, setBulkList] = useState("");
  const [branding, setBranding] = useState<PartnerBranding>({
    name: "", phone: "", company: "LeadMines", referralLink: "", email: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: tpls }, { data: profile }] = await Promise.all([
        supabase.from("marketing_templates").select("*").eq("kind", "whatsapp").eq("enabled", true).order("display_order"),
        supabase.from("profiles").select("full_name, phone, company_name").eq("id", user.id).maybeSingle(),
      ]);
      const list = (tpls ?? []) as unknown as MarketingTemplate[];
      setTemplates(list);
      const code = generateReferralCode(profile?.full_name ?? user.email ?? "user", user.id);
      setBranding({
        name: profile?.full_name ?? "Partner",
        phone: profile?.phone ?? "",
        company: profile?.company_name ?? "LeadMines",
        referralLink: buildReferralLink(code),
        email: user.email ?? "",
      });
      if (list[0]) {
        setSelected(list[0]);
        setEditor(list[0].body ?? "");
      }
      setLoading(false);
    })();
  }, [user]);

  const finalText = useMemo(() => personalize(editor, branding), [editor, branding]);
  const c2cLink = useMemo(() => {
    const cleaned = recipient.replace(/\D/g, "");
    if (!cleaned) return `https://wa.me/?text=${encodeURIComponent(finalText)}`;
    return `https://wa.me/${cleaned}?text=${encodeURIComponent(finalText)}`;
  }, [recipient, finalText]);

  const recipients = useMemo(
    () => bulkList.split(/[\s,;\n]+/).map((s) => s.trim()).filter(Boolean),
    [bulkList],
  );

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); }
    catch { toast.error("Copy failed"); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="space-y-2">
        <Label>Templates</Label>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {templates.map((t) => {
            const active = selected?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setSelected(t); setEditor(t.body ?? ""); }}
                className={`w-full text-left rounded-lg border p-3 transition-all hover:border-primary ${active ? "border-primary ring-2 ring-primary/20 bg-primary/5" : ""}`}
              >
                <Badge variant="secondary" className="mb-1.5 text-[10px]">{PRODUCT_LABEL[t.product]}</Badge>
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.headline}</div>
              </button>
            );
          })}
          {templates.length === 0 && <div className="text-sm text-muted-foreground py-4">No WhatsApp templates yet.</div>}
        </div>
      </div>

      <div className="space-y-5">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <Label>Message body</Label>
              <Textarea value={editor} onChange={(e) => setEditor(e.target.value)} rows={6} className="font-mono text-sm" />
              <div className="text-xs text-muted-foreground mt-1">
                Variables: <code>{`{{name}}`}</code> <code>{`{{phone}}`}</code> <code>{`{{company}}`}</code> <code>{`{{link}}`}</code>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-4 border">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Final preview</div>
              <div className="text-sm whitespace-pre-wrap">{finalText}</div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Your name</Label>
                <Input value={branding.name} onChange={(e) => setBranding({ ...branding, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Your phone</Label>
                <Input value={branding.phone} onChange={(e) => setBranding({ ...branding, phone: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Apply link</Label>
                <Input value={branding.referralLink} onChange={(e) => setBranding({ ...branding, referralLink: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="font-semibold flex items-center gap-2"><LinkIcon className="size-4" /> Click-to-chat link generator</div>
              <p className="text-xs text-muted-foreground mt-1">Enter a phone number (with country code, no symbols) to send to a single contact, or leave blank for a generic share link.</p>
            </div>
            <div className="flex gap-2">
              <Input placeholder="e.g. 919876543210" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <Button onClick={() => shareWhatsApp(finalText, recipient || undefined)} className="gap-2">
                <MessageCircle className="size-4" /> Open
              </Button>
            </div>
            <div className="rounded-md bg-muted/40 border p-3 text-xs font-mono break-all flex items-start gap-2">
              <span className="flex-1">{c2cLink}</span>
              <button onClick={() => copy(c2cLink)} className="text-primary hover:opacity-70 shrink-0"><Copy className="size-3.5" /></button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <div className="font-semibold">Bulk message (sequential)</div>
              <p className="text-xs text-muted-foreground mt-1">Paste numbers (comma / newline separated). Click each to open WhatsApp with the message pre-filled. Bulk WhatsApp Business API integration coming soon.</p>
            </div>
            <Textarea
              placeholder="919876543210, 919812345678&#10;918765432100"
              value={bulkList}
              onChange={(e) => setBulkList(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            {recipients.length > 0 && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                <div className="text-xs text-muted-foreground">{recipients.length} recipients</div>
                {recipients.map((r, i) => (
                  <div key={`${r}-${i}`} className="flex items-center justify-between gap-2 p-2 rounded border bg-card text-sm">
                    <span className="font-mono">{r}</span>
                    <Button size="sm" variant="outline" onClick={() => shareWhatsApp(finalText, r)}>
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
