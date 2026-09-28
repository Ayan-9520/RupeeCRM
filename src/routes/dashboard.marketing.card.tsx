import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { VisitingCardCanvas, type CardData } from "@/components/marketing/VisitingCardCanvas";
import { ShareBar } from "@/components/marketing/ShareBar";
import {
  getVisitingCard,
  saveVisitingCard,
  getPartnerProfile,
  type VisitingCardData,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/marketing/card")({
  head: () => ({ meta: [{ title: "Visiting Card — RupeeDial One" }] }),
  component: CardPage,
});

function CardPage() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<VisitingCardData | null>(null);
  const [productsText, setProductsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileUrl, setProfileUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [card, profile] = await Promise.all([
        getVisitingCard(),
        getPartnerProfile().catch(() => null),
      ]);
      const qr =
        card.qr_target_url ||
        profile?.public_url ||
        (profile?.slug ? `https://rupeedial.com/p/${profile.slug}` : "https://rupeedial.com");
      setForm({ ...card, qr_target_url: qr });
      setProductsText((card.products || []).join(", "));
      setProfileUrl(
        profile?.public_url ||
          (profile?.slug ? `https://rupeedial.com/p/${profile.slug}` : null),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load card");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canvasData: CardData | null = useMemo(() => {
    if (!form) return null;
    return {
      full_name: form.full_name || "Partner",
      designation: form.designation,
      company_name: form.company_name || "RupeeDial Partner",
      phone: form.phone || "+91",
      email: form.email,
      whatsapp: form.whatsapp,
      website: form.website || form.qr_target_url,
      city: form.city,
      photo_url: form.photo_url,
      logo_url: form.logo_url,
      products: productsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      theme: form.theme,
      qrValue: form.qr_target_url || "https://rupeedial.com",
    };
  }, [form, productsText]);

  const onSave = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const products = productsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const saved = await saveVisitingCard({
        designation: form.designation,
        company_name: form.company_name,
        phone: form.phone,
        email: form.email,
        whatsapp: form.whatsapp,
        website: form.website,
        city: form.city,
        logo_url: form.logo_url,
        products,
        theme: form.theme,
        qr_target_url: form.qr_target_url,
      });
      setForm({ ...saved, full_name: form.full_name });
      toast.success("Card saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form || !canvasData) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#390A5D]">Visiting card</h1>
          <p className="text-sm text-[#5c4d72] mt-1">
            QR opens your public profile. Download / share as image.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/dashboard/profile"
            className="rounded-xl border border-[#d8ecdd] px-3 py-2 text-sm font-semibold text-[#390A5D]"
          >
            Edit profile
          </Link>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3 rounded-2xl border border-[#d8ecdd] bg-white p-5">
          {(
            [
              ["company_name", "Company"],
              ["designation", "Designation"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["city", "City"],
              ["qr_target_url", "QR URL"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="font-semibold text-[#390A5D]">{label}</span>
              <input
                value={(form[key] as string) || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              />
            </label>
          ))}
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Products</span>
            <input
              value={productsText}
              onChange={(e) => setProductsText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
          {profileUrl && (
            <p className="text-xs text-[#5c4d72]">
              Tip: publish profile first so QR lands on{" "}
              <span className="font-mono text-[#10662A]">{profileUrl}</span>
            </p>
          )}
        </div>

        <div className="space-y-3 overflow-auto">
          <div className="origin-top-left scale-[0.42] sm:scale-[0.48] lg:scale-[0.52] w-[1050px]">
            <VisitingCardCanvas ref={cardRef} data={canvasData} />
          </div>
          <ShareBar
            targetRef={cardRef}
            shareText={`${canvasData.full_name} · ${canvasData.company_name}`}
            shareUrl={canvasData.qrValue}
            filename="rupeedial-card.png"
          />
        </div>
      </div>
    </div>
  );
}
