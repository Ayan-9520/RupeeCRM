import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Save } from "lucide-react";
import {
  getPartnerProfile,
  request,
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
  if (role === "admin" || role === "ceo" || role === "super_admin") {
    return (
      <div className="space-y-6">
        <StaffProfile />
        <ExpertPhotoDesk />
      </div>
    );
  }
  if (role && role !== "dsa" && role !== "affiliate") return <StaffProfile />;
  return <PartnerProfilePage />;
}

function ExpertPhotoDesk() {
  const icons = ["caller01", "caller02", "caller03", "caller04", "caller05", "caller06", "caller07", "caller08", "caller09", "caller10", "caller11", "caller12"];
  const [rows, setRows] = useState<{ firm_name: string; slug: string; logo_url?: string | null; contact_name?: string | null }[]>([]);
  const [busy, setBusy] = useState("");
  const [openSlug, setOpenSlug] = useState("");
  useEffect(() => {
    void request<{ items: { firm_name: string; slug: string; logo_url?: string | null; contact_name?: string | null }[] }>("/api/public/directory/partners?limit=100")
      .then((data) => setRows(data.items || []))
      .catch(() => setRows([]));
  }, []);
  const upload = async (slug: string, file: File) => {
    setBusy(slug);
    try {
      const body = new FormData();
      body.set("file", file);
      const saved = await request<{ logo_url: string }>(`/api/partner/profile/photo/${slug}`, { method: "POST", body });
      setRows((current) => current.map((row) => (row.slug === slug ? { ...row, logo_url: `${saved.logo_url}?v=${Date.now()}` } : row)));
      toast.success("Photo saved. It shows on the expert card.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo was not saved");
    } finally {
      setBusy("");
    }
  };
  const pick = async (slug: string, name: string) => {
    setBusy(slug);
    try {
      const saved = await request<{ logo_url: string }>(`/api/partner/profile/photo/${slug}/preset`, { method: "POST", body: JSON.stringify({ name }) });
      setRows((current) => current.map((row) => (row.slug === slug ? { ...row, logo_url: `${saved.logo_url}?v=${Date.now()}` } : row)));
      setOpenSlug("");
      toast.success("Photo saved. It shows on the expert card.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Icon was not saved");
    } finally {
      setBusy("");
    }
  };
  const remove = async (slug: string) => {
    setBusy(slug);
    try {
      await request(`/api/partner/profile/photo/${slug}`, { method: "DELETE" });
      setRows((current) => current.map((row) => (row.slug === slug ? { ...row, logo_url: null } : row)));
      setOpenSlug("");
      toast.success("Photo removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Photo was not removed");
    } finally {
      setBusy("");
    }
  };
  const open = rows.find((row) => row.slug === openSlug);
  return (
    <div className="mx-auto max-w-5xl">
      <section className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_12px_32px_rgba(16,102,42,0.06)]">
        <div className="flex items-center justify-between px-5 py-3">
          <div>
            <h2 className="font-display text-lg font-bold text-[#390A5D]">Expert photos</h2>
            <p className="text-xs text-[#5c4d72]">Click a photo to upload, pick an icon, or remove it.</p>
          </div>
        </div>
        <ul className="grid gap-2 border-t border-[#d8ecdd] p-3 sm:grid-cols-2">
          {rows.map((row) => (
            <li key={row.slug}>
              <button type="button" onClick={() => setOpenSlug(row.slug)} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-[#F4FBF6]">
                {row.logo_url ? <img src={row.logo_url} alt="" className="size-12 rounded-full object-cover ring-2 ring-[#10662A]" /> : <span className="grid size-12 place-items-center rounded-full bg-[#E8F7EC] text-sm font-bold text-[#10662A]">{(row.contact_name || row.firm_name || "E").slice(0, 1)}</span>}
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#390A5D]">{row.contact_name || row.firm_name}</span>
                  <span className="block truncate text-xs text-[#5c4d72]">{row.firm_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0D4F20]/45 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_rgba(13,79,32,0.28)]">
            <div className="flex items-center justify-between bg-[#0D4F20] px-5 py-4 text-white">
              <h2 className="font-display text-lg font-bold">Update profile picture</h2>
              <button type="button" onClick={() => setOpenSlug("")} className="grid size-8 place-items-center rounded-full hover:bg-white/10" aria-label="Close">✕</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-[#10662A] bg-[#F4FBF6] px-4 py-6 text-center">
                <span className="text-sm font-semibold text-[#10662A]">{busy === open.slug ? "Saving" : "Choose a photo"}</span>
                <span className="mt-1 text-xs text-[#5c4d72]">JPG or PNG, square looks best</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 text-sm" disabled={Boolean(busy)} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(open.slug, file).then(() => setOpenSlug("")); }} />
              </label>
              <p className="mb-2 mt-4 text-xs font-semibold text-[#390A5D]">Or pick an icon</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {icons.map((name) => (
                  <button key={name} type="button" disabled={Boolean(busy)} onClick={() => void pick(open.slug, name)} className="overflow-hidden rounded-xl bg-white ring-1 ring-[#d8ecdd] hover:ring-2 hover:ring-[#10662A] disabled:opacity-50">
                    <img src={`/profile-avatars/${name}.jpg`} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                {open.logo_url ? <button type="button" disabled={Boolean(busy)} onClick={() => void remove(open.slug)} className="mr-auto h-10 rounded-full border border-[#d8ecdd] px-5 text-sm font-semibold text-[#390A5D]">Remove</button> : null}
                <button type="button" onClick={() => setOpenSlug("")} className="h-10 rounded-full border border-[#10662A] bg-white px-5 text-sm font-semibold text-[#10662A]">Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProfilePhotoField({
  logoUrl,
  onChange,
}: {
  logoUrl: string | null | undefined;
  onChange: (logoUrl: string | null) => void;
}) {
  const icons = ["caller01", "caller02", "caller03", "caller04", "caller05", "caller06", "caller07", "caller08", "caller09", "caller10", "caller11", "caller12"];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const apply = (logo: string | null, message: string) => {
    onChange(logo ? `${logo}${logo.includes("?") ? "&" : "?"}v=${Date.now()}` : null);
    toast.success(message);
    setOpen(false);
  };
  const upload = (file: File) => {
    setBusy("upload");
    const body = new FormData();
    body.set("file", file);
    void request<{ logo_url: string | null }>("/api/partner/profile/photo", { method: "POST", body })
      .then((saved) => apply(saved.logo_url, "Photo saved. It shows on your expert card."))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Photo was not saved"))
      .finally(() => setBusy(""));
  };
  const pick = (name: string) => {
    setBusy(name);
    void request<{ logo_url: string | null }>("/api/partner/profile/photo/preset", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
      .then((saved) => apply(saved.logo_url, "Icon saved. It shows on your expert card."))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Icon was not saved"))
      .finally(() => setBusy(""));
  };
  const remove = () => {
    setBusy("remove");
    void request<{ logo_url: string | null }>("/api/partner/profile/photo", { method: "DELETE" })
      .then(() => apply(null, "Photo removed."))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Photo was not removed"))
      .finally(() => setBusy(""));
  };
  return (
    <div>
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={() => setOpen(true)} className="grid size-20 place-items-center overflow-hidden rounded-full bg-[#E8F7EC] text-xs font-semibold text-[#10662A] ring-4 ring-white shadow-[0_0_0_3px_#10662A]" aria-label="Update profile picture">
          {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : "Photo"}
        </button>
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-[#10662A]">Change photo</button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#0D4F20]/45 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_rgba(13,79,32,0.28)]">
            <div className="flex items-center justify-between bg-[#0D4F20] px-5 py-4 text-white">
              <h2 className="font-display text-lg font-bold">Update profile picture</h2>
              <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Close">✕</button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-5">
              <label className="flex cursor-pointer flex-col items-center rounded-2xl border border-dashed border-[#10662A] bg-[#F4FBF6] px-4 py-6 text-center">
                <span className="text-sm font-semibold text-[#10662A]">{busy === "upload" ? "Uploading" : "Choose a photo"}</span>
                <span className="mt-1 text-xs text-[#5c4d72]">JPG or PNG, square looks best</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-3 text-sm"
                  disabled={Boolean(busy)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) upload(file);
                  }}
                />
              </label>
              <p className="mb-2 mt-4 text-xs font-semibold text-[#390A5D]">Or pick an icon</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {icons.map((name) => (
                  <button key={name} type="button" disabled={Boolean(busy)} onClick={() => pick(name)} className="overflow-hidden rounded-xl bg-white ring-1 ring-[#d8ecdd] hover:ring-2 hover:ring-[#10662A] disabled:opacity-50">
                    <img src={`/profile-avatars/${name}.jpg`} alt="" className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                {logoUrl ? (
                  <button type="button" disabled={Boolean(busy)} onClick={remove} className="mr-auto h-10 rounded-full border border-[#d8ecdd] px-5 text-sm font-semibold text-[#390A5D] disabled:opacity-60">{busy === "remove" ? "Removing" : "Remove"}</button>
                ) : null}
                <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-full border border-[#10662A] bg-white px-5 text-sm font-semibold text-[#10662A]">Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PartnerProfilePage() {
  const { role } = useAuth();
  const affiliate = role === "affiliate";
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

  const field = "mt-0.5 w-full rounded-lg border border-[#d8ecdd] bg-[#F4FBF6] px-2.5 py-1.5 text-sm outline-none focus:border-[#10662A] focus:bg-white";
  const label = "block text-xs font-semibold text-[#390A5D]";

  return (
    <div className="mx-auto max-w-5xl">
      {!form.can_publish && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Publishing needs Growth or Pro.{" "}
          <Link to="/dashboard/billing" className="font-semibold underline">
            Activate a plan
          </Link>
        </div>
      )}

      <form onSubmit={(e) => void onSave(e)} className="overflow-hidden rounded-3xl border border-[#d8ecdd] bg-white shadow-[0_12px_32px_rgba(16,102,42,0.06)]">
        <div className="h-1.5 bg-[#10662A]" />
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <ProfilePhotoField logoUrl={form.logo_url} onChange={(logoUrl) => setForm({ ...form, logo_url: logoUrl })} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold text-[#390A5D]">{form.firm_name || (affiliate ? "Affiliate" : "Partner")}</h1>
            <p className="text-sm text-[#5c4d72]">{themeText("designation") || (affiliate ? "Affiliate" : "Loan advisor")} · {form.city || "City"}</p>
            <p className="mt-1 truncate font-mono text-xs text-[#10662A]">{previewHref}</p>
          </div>
          <button type="submit" disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-full bg-[#10662A] px-4 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </button>
        </div>
        <section className="grid gap-2 border-t border-[#d8ecdd] px-5 py-3 sm:grid-cols-2">
        <label className={label}>
          {affiliate ? "Name" : "Firm name"}
          <input required value={form.firm_name} onChange={(e) => { const firm_name = e.target.value; setForm({ ...form, firm_name, slug: firm_name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 40) }); }} className={field} />
        </label>
        <label className={label}>
          Tagline
          <input value={form.tagline || ""} onChange={(e) => setForm({ ...form, tagline: e.target.value })} className={field} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Public link
          <input readOnly value={previewHref} className={`${field} font-mono text-[#10662A]`} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {affiliate ? "Note" : "Story"}
          <textarea rows={2} value={form.bio || ""} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={field} placeholder="How you help customers" />
        </label>
        {affiliate ? null : <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Mission</span>
            <textarea rows={2} value={themeText("mission")} onChange={(e) => setTheme("mission", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Vision</span>
            <textarea rows={2} value={themeText("vision")} onChange={(e) => setTheme("vision", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" />
          </label>
        </div>}
        </section>
        <section className="grid gap-2 border-t border-[#d8ecdd] px-5 py-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Office address</span>
          <input value={themeText("address")} onChange={(e) => setTheme("address", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" />
        </label>
        {affiliate ? null : <>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Founder</span>
            <input value={themeText("founder")} onChange={(e) => setTheme("founder", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Established</span>
            <input value={themeText("founded")} onChange={(e) => setTheme("founded", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder="2016" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Working areas</span>
          <input value={themeText("areas")} onChange={(e) => setTheme("areas", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder="Delhi, Noida, Gurugram" />
        </label>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Business assisted</span>
            <input value={themeText("stat_business")} onChange={(e) => setTheme("stat_business", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder="₹12 Cr" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Families served</span>
            <input value={themeText("stat_families")} onChange={(e) => setTheme("stat_families", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Rating</span>
            <input value={themeText("stat_rating")} onChange={(e) => setTheme("stat_rating", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder="4.8" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Achievements</span>
          <textarea rows={2} value={themeText("achievements")} onChange={(e) => setTheme("achievements", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder={"One per line: Title | 2025"} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Certificates</span>
          <textarea rows={2} value={themeText("certificates")} onChange={(e) => setTheme("certificates", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder={"One per line: Certificate | Institute"} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Customer notes</span>
          <textarea rows={2} value={themeText("reviews")} onChange={(e) => setTheme("reviews", e.target.value)} className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white" placeholder={"One per line: Name | 5 | What they said"} />
        </label>
        </>}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">City</span>
            <input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">State</span>
            <input
              value={form.state || ""}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Phone</span>
            <input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Email</span>
            <input
              type="email"
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Website</span>
          <input
            value={themeText("website")}
            onChange={(e) => setTheme("website", e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            placeholder="https://"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Booking link</span>
          <input
            value={themeText("booking_url")}
            onChange={(e) => setTheme("booking_url", e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            placeholder="https://… leave blank to use the RupeeDial contact page"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[#390A5D]">Extra links</span>
          <textarea
            rows={2}
            value={themeText("links")}
            onChange={(e) => setTheme("links", e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            placeholder={"One per line: Instagram | https://instagram.com/…"}
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Pincode</span>
            <input
              value={themeText("pincode")}
              onChange={(e) => setTheme("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
              inputMode="numeric"
              placeholder="201301"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Designation</span>
            <input
              value={themeText("designation")}
              onChange={(e) => setTheme("designation", e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
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
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Languages</span>
            <input
              value={themeText("languages")}
              onChange={(e) => setTheme("languages", e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
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
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
              placeholder="8"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-[#390A5D]">Working since</span>
            <input
              value={themeText("since")}
              onChange={(e) => setTheme("since", e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
              placeholder="2016"
            />
          </label>
        </div>
        <label className={`${label} sm:col-span-2`}>
          <span className="font-semibold text-[#390A5D]">{affiliate ? "Products you refer" : "Products you handle"}</span>
          <input
            value={productsText}
            onChange={(e) => setProductsText(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[#d8ecdd] bg-[#F4FBF6] px-3 py-2 text-sm outline-none focus:border-[#10662A] focus:bg-white"
            placeholder="Personal Loan, Business Loan, Insurance"
          />
        </label>

        <div className="flex flex-wrap gap-x-4 gap-y-1 sm:col-span-2">
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

        <div className="flex flex-wrap gap-2 sm:col-span-2">
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
        </section>
      </form>
    </div>
  );
}
