import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Loader2, ExternalLink } from "lucide-react";
import { MarketingUpgradeGate } from "@/components/marketing/MarketingUpgradeGate";
import { useBillingEntitlements } from "@/hooks/use-billing-entitlements";
import { buildReferralLink, partnerBrandingFrom, shareWhatsApp } from "@/lib/marketing";
import { getCrmUser, getPartnerProfile } from "@/lib/python-api";
import { APPLY_PRODUCTS } from "@/lib/referrals";

export const Route = createFileRoute("/dashboard/marketing/referral")({
  head: () => ({ meta: [{ title: "Referral Link — RupeeDial One" }] }),
  component: ReferralPage,
});

const SITE = "https://rupeedial.com";

function ReferralPage() {
  const { entitlements, loading, marketingBasic } = useBillingEntitlements();
  const user = getCrmUser();
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [firm, setFirm] = useState("RupeeDial Partner");
  const [copied, setCopied] = useState<string | null>(null);

  const code = user?.dsa_id || user?.email?.split("@")[0] || "partner";
  const primary = buildReferralLink(code, SITE);

  useEffect(() => {
    (async () => {
      const profile = await getPartnerProfile().catch(() => null);
      if (profile?.public_url) setProfileUrl(profile.public_url);
      else if (profile?.slug) setProfileUrl(`${SITE}/p/${profile.slug}`);
      if (profile?.firm_name) setFirm(profile.firm_name);
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
        title="Referral links"
        description="Activate any plan to get your personal lead-capture links."
      />
    );
  }

  const invite = `Hi, I'm ${user?.full_name || "your RupeeDial partner"} from ${firm}. Check loan eligibility here: ${profileUrl || primary}`;

  const copy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    toast.success("Copied");
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="font-display text-xl font-bold text-[#390A5D]">Referral links</h2>
        <p className="text-sm text-[#5c4d72] mt-1">
          Share your profile or product links. Ref code:{" "}
          <span className="font-mono text-[#10662A]">{code}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-[#d8ecdd] bg-white p-5 space-y-3">
        <div className="text-xs uppercase font-semibold text-[#5c4d72]">Primary</div>
        <div className="font-mono text-sm break-all text-[#390A5D]">{primary}</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copy("primary", primary)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold"
          >
            {copied === "primary" ? <Check className="size-3.5 text-[#10662A]" /> : <Copy className="size-3.5" />}
            Copy
          </button>
          <button
            type="button"
            onClick={() => shareWhatsApp(invite)}
            className="rounded-lg bg-[#25D366] text-white px-3 py-1.5 text-xs font-semibold"
          >
            WhatsApp invite
          </button>
        </div>
      </div>

      {profileUrl && (
        <div className="rounded-2xl border border-[#d8ecdd] bg-[#E8F7EC]/50 p-5 space-y-2">
          <div className="text-xs uppercase font-semibold text-[#5c4d72]">Public profile</div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-[#10662A] break-all inline-flex items-center gap-1"
          >
            {profileUrl} <ExternalLink className="size-3" />
          </a>
          <div>
            <button
              type="button"
              onClick={() => void copy("profile", profileUrl)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8ecdd] px-3 py-1.5 text-xs font-semibold bg-white"
            >
              {copied === "profile" ? <Check className="size-3.5 text-[#10662A]" /> : <Copy className="size-3.5" />}
              Copy profile URL
            </button>
            <Link to="/dashboard/profile" className="ml-3 text-xs font-semibold text-[#10662A] underline">
              Edit profile
            </Link>
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-semibold text-[#390A5D] mb-2">Product links</div>
        <ul className="space-y-2">
          {APPLY_PRODUCTS.map((p) => {
            const url = `${SITE}/check-eligibility?ref=${encodeURIComponent(code)}&product=${p.slug}`;
            return (
              <li
                key={p.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d8ecdd] bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium text-[#390A5D]">{p.label}</span>
                <button
                  type="button"
                  onClick={() => void copy(p.slug, url)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#10662A]"
                >
                  {copied === p.slug ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
