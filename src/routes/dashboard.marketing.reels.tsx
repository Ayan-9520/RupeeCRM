import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import {
  templatesByKind,
  partnerBrandingFrom,
  personalize,
} from "@/lib/marketing";
import { getCrmUser, getPartnerProfile } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/marketing/reels")({
  head: () => ({ meta: [{ title: "Reels — RupeeDial One" }] }),
  component: ReelsPage,
});

function ReelsPage() {
  const { loading, marketingFull } = useBillingEntitlements();
  const [branding, setBranding] = useState(() => partnerBrandingFrom(getCrmUser()));
  const [copied, setCopied] = useState<string | null>(null);
  const templates = useMemo(() => templatesByKind("reel"), []);

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

  if (!marketingFull) {
    return (
      <MarketingUpgradeGate
        title="Reels scripts"
        description="Reel / short-video scripts unlock on Growth and Pro."
      />
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-bold text-[#390A5D]">Reel scripts</h2>
        <p className="text-sm text-[#5c4d72] mt-1">
          Shoot on phone — copy the script, film, post. Video editor later.
        </p>
      </div>
      <div className="space-y-3">
        {templates.map((tpl) => {
          const script = [
            personalize(tpl.headline, branding),
            personalize(tpl.subheadline || "", branding),
            personalize(tpl.body || "", branding),
            `CTA: ${tpl.cta} · ${branding.referralLink}`,
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <div key={tpl.id} className="rounded-2xl border border-[#d8ecdd] bg-white p-5">
              <div className="font-semibold text-[#390A5D]">{tpl.name}</div>
              <pre className="mt-2 text-sm text-[#5c4d72] whitespace-pre-wrap font-sans">{script}</pre>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(script);
                  setCopied(tpl.id);
                  toast.success("Script copied");
                  setTimeout(() => setCopied(null), 2000);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold"
              >
                {copied === tpl.id ? (
                  <Check className="size-3.5 text-[#10662A]" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                Copy script
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
