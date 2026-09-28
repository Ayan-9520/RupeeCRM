import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2 } from "lucide-react";
import { PostCanvas } from "@/components/marketing/PostCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import {
  templatesByKind,
  partnerBrandingFrom,
  personalize,
  type MarketingTemplate,
} from "@/lib/marketing";
import { getCrmUser, getPartnerProfile } from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/marketing/posts")({
  head: () => ({ meta: [{ title: "Marketing Posts — RupeeDial One" }] }),
  component: PostsPage,
});

function PostsPage() {
  const { entitlements, loading: entLoading, marketingBasic, marketingFull } =
    useBillingEntitlements();
  const [branding, setBranding] = useState(() => partnerBrandingFrom(getCrmUser()));
  const [selected, setSelected] = useState<MarketingTemplate | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const allPosts = useMemo(() => templatesByKind("post"), []);
  // Starter (basic): first template only for visual; Growth+: all
  const posts = marketingFull ? allPosts : allPosts.slice(0, 1);

  useEffect(() => {
    (async () => {
      const user = getCrmUser();
      const profile = await getPartnerProfile().catch(() => null);
      setBranding(partnerBrandingFrom(user, profile));
    })();
  }, []);

  useEffect(() => {
    if (posts.length && !selected) setSelected(posts[0]);
  }, [posts, selected]);

  if (entLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-5 animate-spin text-[#10662A]" />
      </div>
    );
  }

  if (!entitlements.has_active_plan) {
    return (
      <MarketingUpgradeGate
        title="Activate a plan"
        description="Starter includes basic social posts. Growth unlocks the full template pack."
      />
    );
  }

  if (!marketingBasic) {
    return (
      <MarketingUpgradeGate
        title="Marketing not on this plan"
        description="Your plan does not include marketing_basic."
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

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    toast.success("Caption copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[#390A5D]">Social posts</h2>
        <p className="text-sm text-[#5c4d72] mt-1">
          {marketingFull
            ? "Full template pack — download PNG & share."
            : "Starter: 1 visual template. Upgrade to Growth for the full pack."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {posts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
              selected.id === t.id
                ? "bg-[#10662A] text-white border-[#10662A]"
                : "bg-white border-[#d8ecdd] text-[#390A5D]"
            }`}
          >
            {t.name}
          </button>
        ))}
        {!marketingFull && (
          <span className="text-xs text-[#5c4d72] self-center">+ more on Growth</span>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="overflow-auto rounded-2xl border border-[#d8ecdd] bg-[#0c2340]/5 p-2">
          <div className="origin-top-left scale-[0.38] sm:scale-[0.42] w-[1080px]">
            <PostCanvas ref={canvasRef} template={selected} branding={branding} />
          </div>
        </div>
        <div className="space-y-4">
          <pre className="rounded-xl border border-[#d8ecdd] bg-white p-4 text-sm text-[#5c4d72] whitespace-pre-wrap font-sans">
            {caption}
          </pre>
          <button
            type="button"
            onClick={() => void copyCaption()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d8ecdd] px-3 py-2 text-xs font-semibold"
          >
            {copied ? <Check className="size-3.5 text-[#10662A]" /> : <Copy className="size-3.5" />}
            Copy caption
          </button>
          <ShareBar
            targetRef={canvasRef}
            shareText={caption}
            shareUrl={branding.referralLink}
            filename="rupeedial-post.png"
          />
        </div>
      </div>
    </div>
  );
}
