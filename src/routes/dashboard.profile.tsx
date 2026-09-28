import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Save } from "lucide-react";
import {
  getPartnerProfile,
  savePartnerProfile,
  type PartnerProfile,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/profile")({
  head: () => ({ meta: [{ title: "Public profile — RupeeDial One" }] }),
  component: ProfilePage,
});

function ProfilePage() {
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#390A5D]">Public profile</h1>
        <p className="text-sm text-[#5c4d72] mt-1">
          Growth+: publish at{" "}
          <span className="font-mono text-[#10662A]">rupeedial.com/p/{previewSlug}</span>
          {" · "}
          subdomain <span className="font-mono">{previewSlug}.rupeedial.com</span> (DNS later).
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
            onChange={(e) => setForm({ ...form, firm_name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Slug (URL)</span>
          <input
            required
            value={form.slug}
            onChange={(e) =>
              setForm({
                ...form,
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              })
            }
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2 font-mono text-sm"
            placeholder="kesarenterprises"
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
          <span className="font-semibold text-[#390A5D]">Bio</span>
          <textarea
            rows={4}
            value={form.bio || ""}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
          />
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
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[#d8ecdd] px-3 py-2"
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
          {form.published && form.slug && (
            <a
              href={
                form.public_url ||
                `${(import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://rupeedial.com"}/p/${form.slug}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d8ecdd] px-4 py-2 text-sm font-semibold text-[#390A5D]"
            >
              <ExternalLink className="size-4" /> Preview
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
