import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2, MessageCircle } from "lucide-react";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import {
  templatesByKind,
  partnerBrandingFrom,
  personalize,
  shareWhatsApp,
} from "@/lib/marketing";
import { getCrmUser, getPartnerProfile } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/marketing/whatsapp")({
  head: () => ({ meta: [{ title: "WhatsApp — RupeeDial One" }] }),
  component: WhatsAppPage,
});

function WhatsAppPage() {
  const { entitlements, loading, marketingBasic } = useBillingEntitlements();
  const [branding, setBranding] = useState(() => partnerBrandingFrom(getCrmUser()));
  const [copied, setCopied] = useState<string | null>(null);
  const templates = useMemo(() => templatesByKind("whatsapp"), []);

  useEffect(() => {
    (async () => {
      const user = getCrmUser();
      const profile = await getPartnerProfile().catch(() => null);
      setBranding(partnerBrandingFrom(user, profile));
    })();
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!entitlements.has_active_plan || !marketingBasic) {
    return (
      <MarketingUpgradeGate
        title="WhatsApp campaigns"
        description="Included on Starter and above. Activate a plan to personalize & share."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-bold text-[#390A5D]">WhatsApp templates</h2>
        <p className="text-sm text-[#5c4d72] mt-1">
          Personalized for {branding.name} · opens WhatsApp with text ready.
        </p>
      </div>
      <div className="space-y-3">
        {templates.map((tpl) => {
          const body = personalize(tpl.body || tpl.headline, branding);
          return (
            <div key={tpl.id} className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
              <div className="font-semibold text-[#390A5D]">{tpl.name}</div>
              <pre className="mt-2 text-sm text-[#5c4d72] whitespace-pre-wrap font-sans">{body}</pre>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    shareWhatsApp(body);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] text-white px-3 py-1.5 text-xs font-semibold"
                >
                  <MessageCircle className="size-3.5" /> Open WhatsApp
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(body);
                    setCopied(tpl.id);
                    toast.success("Copied");
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold"
                >
                  {copied === tpl.id ? (
                    <Check className="size-3.5 text-[#10662A]" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  Copy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
