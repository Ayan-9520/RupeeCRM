import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Save } from "lucide-react";
import {
  getPartnerProfile,
  savePartnerProfile,
  type PartnerProfile,
} from "@/lib/python-api";
import { useAuth } from "@/lib/auth-context";
import { StaffProfile } from "@/components/dashboard/StaffProfile";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({ meta: [{ title: "My profile — RupeeOne" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { role } = useAuth();
  if (role && role !== "dsa" && role !== "affiliate") return <StaffProfile />;
  return <PartnerProfilePage />;
}

function PartnerProfilePage() {
  const [form, setForm] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productsText, setProductsText] = useState("");

  const load = useCallback(async () => {
    try {
      const p = await getPartnerProfile();
      setForm(p);
      setProductsText((p.products || []).join(", "));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const products = productsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const saved = await savePartnerProfile({
        firm_name: form.firm_name,
        slug: form.slug,
        tagline: form.tagline,
        bio: form.bio,
        city: form.city,
        state: form.state,
        phone: form.phone,
        email: form.email,
        logo_url: form.logo_url,
        published: form.published,
        directory_featured: form.directory_featured,
        products,
        theme: form.theme || {},
      });
      setForm(saved);
      setProductsText((saved.products || []).join(", "));
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-[#10662A]" />
      </div>
    );
  }

  const previewSlug = form.slug || "your-firm";
  const previewHref = `https://pro.rupeedial.com/${previewSlug}`;
  const theme = (form.theme || {}) as Record<string, unknown>;
  const themeText = (key: string) => (typeof theme[key] === "string" ? (theme[key] as string) : "");
  const setTheme = (key: string, value: string | boolean) =>
    setForm({ ...form, theme: { ...theme, [key]: value } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Public profile</h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          Public page{" "}
          <span className="font-mono text-[#10662A]">pro.rupeedial.com/{previewSlug}</span>
        </p>
      </div>

      {!form.can_publish && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Publishing needs Growth or Pro.{" "}
          <Link to="/dashboard/billing" className="font-semibold underline">
            Activate a plan
          </Link>
        </div>
      )}

      <form onSubmit={(e) => void onSave(e)} className="space-y-4 rounded-2xl border border-[#d8ecdd] bg-white p-5">
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Firm name</span>
          <input
            required
            value={form.firm_name}
            onChange={(e) => {
              const firm_name = e.target.value;
              const slug = firm_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40);
              setForm({ ...form, firm_name, slug });
            }}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Public link</span>
          <input
            readOnly
            value={previewHref}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 font-mono text-sm text-[#10662A]"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Tagline</span>
          <input
            value={form.tagline || ""}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Story</span>
          <textarea
            rows={5}
            value={form.bio || ""}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder="How you help customers, in your own words"
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Mission</span>
            <textarea rows={3} value={themeText("mission")} onChange={(e) => setTheme("mission", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Vision</span>
            <textarea rows={3} value={themeText("vision")} onChange={(e) => setTheme("vision", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Office address</span>
          <input value={themeText("address")} onChange={(e) => setTheme("address", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Founder</span>
            <input value={themeText("founder")} onChange={(e) => setTheme("founder", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Established</span>
            <input value={themeText("founded")} onChange={(e) => setTheme("founded", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder="2016" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Working areas</span>
          <input value={themeText("areas")} onChange={(e) => setTheme("areas", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder="Delhi, Noida, Gurugram" />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Business assisted</span>
            <input value={themeText("stat_business")} onChange={(e) => setTheme("stat_business", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder="₹12 Cr" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Families served</span>
            <input value={themeText("stat_families")} onChange={(e) => setTheme("stat_families", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Rating</span>
            <input value={themeText("stat_rating")} onChange={(e) => setTheme("stat_rating", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder="4.8" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Achievements</span>
          <textarea rows={3} value={themeText("achievements")} onChange={(e) => setTheme("achievements", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder={"One per line: Title | 2025"} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Certificates</span>
          <textarea rows={3} value={themeText("certificates")} onChange={(e) => setTheme("certificates", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder={"One per line: Certificate | Institute"} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Customer notes</span>
          <textarea rows={3} value={themeText("reviews")} onChange={(e) => setTheme("reviews", e.target.value)} className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2" placeholder={"One per line: Name | 5 | What they said"} />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">State</span>
            <input
              value={form.state || ""}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Phone</span>
            <input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Email</span>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Website</span>
          <input
            value={themeText("website")}
            onChange={(e) => setTheme("website", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder="https://"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Booking link</span>
          <input
            value={themeText("booking_url")}
            onChange={(e) => setTheme("booking_url", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder="https://… leave blank to use the RupeeDial contact page"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Extra links</span>
          <textarea
            rows={3}
            value={themeText("links")}
            onChange={(e) => setTheme("links", e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder={"One per line: Instagram | https://instagram.com/…"}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Pincode</span>
            <input
              value={themeText("pincode")}
              onChange={(e) => setTheme("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              inputMode="numeric"
              placeholder="201301"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Designation</span>
            <input
              value={themeText("designation")}
              onChange={(e) => setTheme("designation", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              placeholder="Loan advisor"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">WhatsApp</span>
            <input
              value={themeText("whatsapp")}
              onChange={(e) => setTheme("whatsapp", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Languages</span>
            <input
              value={themeText("languages")}
              onChange={(e) => setTheme("languages", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              placeholder="Hindi, English"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Years of experience</span>
            <input
              value={themeText("years")}
              onChange={(e) => setTheme("years", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              placeholder="8"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Working since</span>
            <input
              value={themeText("since")}
              onChange={(e) => setTheme("since", e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
              placeholder="2016"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Logo URL</span>
          <input
            value={form.logo_url || ""}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder="https://…"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Products (comma-separated)</span>
          <input
            value={productsText}
            onChange={(e) => setProductsText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
            placeholder="Personal Loan, Business Loan, Insurance"
          />
        </label>

        <div className="flex flex-wrap gap-4 pt-2">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
            <input
              type="checkbox"
              checked={theme.show_phone !== false}
              onChange={(e) => setTheme("show_phone", e.target.checked)}
            />
            Show phone on the page
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
            <input
              type="checkbox"
              checked={theme.show_email !== false}
              onChange={(e) => setTheme("show_email", e.target.checked)}
            />
            Show email on the page
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
            <input
              type="checkbox"
              checked={theme.show_whatsapp === true}
              onChange={(e) => setTheme("show_whatsapp", e.target.checked)}
            />
            Show WhatsApp on the page
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
            <input
              type="checkbox"
              checked={form.published}
              disabled={!form.can_publish}
              onChange={(e) => setForm({ ...form, published: e.target.checked })}
            />
            Publish on directory
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-[#390A5D]">
            <input
              type="checkbox"
              checked={form.directory_featured}
              disabled={!form.can_feature || !form.published}
              onChange={(e) => setForm({ ...form, directory_featured: e.target.checked })}
            />
            Featured (Pro)
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10662A] text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save profile
          </button>
          {form.slug && (
            <a
              href={import.meta.env.DEV ? `http://127.0.0.1:5173/p/${previewSlug}` : previewHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold text-[#390A5D]"
            >
              <ExternalLink className="size-4" /> Open page
            </a>
          )}
          <Link
            to="/dashboard/marketing/card"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold text-[#390A5D]"
          >
            Visiting card
          </Link>
        </div>
      </form>
    </div>
  );
}
