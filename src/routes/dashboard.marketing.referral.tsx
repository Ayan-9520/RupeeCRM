import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, MessageCircle, Facebook, Linkedin, Twitter } from "lucide-react";
import {
  buildReferralLink, generateReferralCode,
  shareWhatsApp, shareFacebook, shareLinkedIn, shareTwitter,
} from "@/lib/marketing";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/marketing/referral")({
  component: ReferralPage,
});

function ReferralPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(profile?.full_name ?? user.email?.split("@")[0] ?? "Partner");
      setCode(generateReferralCode(profile?.full_name ?? user.email ?? "user", user.id));
      setLoading(false);
    })();
  }, [user]);

  const link = useMemo(() => buildReferralLink(code), [code]);
  const shareText = `Hi! Apply for instant Loans, Credit Cards & Insurance through me. Quick approval, best rates. Get started: ${link}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Your referral link</div>
            <div className="text-xl font-display font-bold mt-1">{name}</div>
          </div>

          <div>
            <Label className="text-xs">Custom code (optional)</Label>
            <div className="flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} maxLength={20} />
            </div>
            <div className="text-xs text-muted-foreground mt-1">Letters & numbers only.</div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 flex items-center gap-2">
            <span className="font-mono text-sm flex-1 truncate">{link}</span>
            <Button size="icon" variant="ghost" onClick={copy}><Copy className="size-4" /></Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Quick share</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => shareWhatsApp(shareText)} className="gap-2 text-emerald-600">
                <MessageCircle className="size-4" /> WhatsApp
              </Button>
              <Button variant="outline" onClick={() => shareFacebook(link, shareText)} className="gap-2 text-blue-600">
                <Facebook className="size-4" /> Facebook
              </Button>
              <Button variant="outline" onClick={() => shareLinkedIn(link)} className="gap-2 text-sky-700">
                <Linkedin className="size-4" /> LinkedIn
              </Button>
              <Button variant="outline" onClick={() => shareTwitter(shareText, link)} className="gap-2">
                <Twitter className="size-4" /> X
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 flex flex-col items-center text-center space-y-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Scan to apply</div>
          <div className="bg-white p-4 rounded-2xl border shadow-sm">
            <QRCodeSVG value={link} size={220} level="M" />
          </div>
          <div className="text-sm text-muted-foreground max-w-xs">
            Print this QR on your visiting card, posters, or storefront. Scans land directly on your branded apply page.
          </div>
          <div className="text-xs text-muted-foreground italic">
            Click & conversion tracking arrives with the public landing page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
