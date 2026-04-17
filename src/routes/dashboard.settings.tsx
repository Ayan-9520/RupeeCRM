import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings — LeadMines" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", company_name: "" });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (data) setForm({
        full_name: data.full_name ?? "", phone: data.phone ?? "",
        city: data.city ?? "", company_name: data.company_name ?? "",
      });
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile information.</p>
      </div>

      <form onSubmit={save} className="rounded-2xl bg-card border border-border p-6 shadow-card space-y-4">
        <Field label="Email"><input value={user?.email ?? ""} disabled className="input-base opacity-60" /></Field>
        <Field label="Role"><input value={role ?? ""} disabled className="input-base opacity-60 uppercase" /></Field>
        <Field label="Full name">
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-base" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-base" />
        </Field>
        <Field label="City">
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-base" />
        </Field>
        <Field label="Company name (optional)">
          <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="input-base" />
        </Field>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 h-10 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-card hover:bg-primary/90 disabled:opacity-60">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
