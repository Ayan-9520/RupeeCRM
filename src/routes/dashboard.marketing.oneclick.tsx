import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PostCanvas } from "@/components/marketing/PostCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { templatesByKind, partnerBrandingFrom, personalize } from "@/lib/marketing";
import { getCrmUser, getPartnerProfile } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/marketing/oneclick")({
  head: () => ({ meta: [{ title: "One Click Post — RupeeDial One" }] }),
  component: OneClickPage,
});

function OneClickPage() {
  const { loading, marketingFull } = useBillingEntitlements();
  const [branding, setBranding] = useState(() => partnerBrandingFrom(getCrmUser()));
  const canvasRef = useRef<HTMLDivElement>(null);
  const posts = useMemo(() => templatesByKind("post"), []);
  const [idx, setIdx] = useState(0);
  const selected = posts[idx % Math.max(posts.length, 1)];

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
        title="One-click post"
        description="Instant branded posts unlock on Growth and Pro."
      />
    );
  }

  if (!selected) return null;

  const caption = [
    personalize(selected.headline, branding),
    personalize(selected.body || "", branding),
    branding.referralLink,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#390A5D]">One-click post</h2>
          <p className="text-sm text-[#5c4d72] mt-1">Pick a vibe → download → share.</p>
        </div>
        <button
          type="button"
          onClick={() => setIdx((i) => i + 1)}
          className="rounded-xl bg-[#10662A] text-white px-4 py-2 text-sm font-semibold"
        >
          Next template
        </button>
      </div>
      <p className="text-sm font-semibold text-[#390A5D]">{selected.name}</p>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="overflow-auto rounded-2xl border border-[#d8ecdd] p-2">
          <div className="origin-top-left scale-[0.38] sm:scale-[0.42] w-[1080px]">
            <PostCanvas ref={canvasRef} template={selected} branding={branding} />
          </div>
        </div>
        <ShareBar
          targetRef={canvasRef}
          shareText={caption}
          shareUrl={branding.referralLink}
          filename="rupeedial-oneclick.png"
        />
      </div>
    </div>
  );
}
