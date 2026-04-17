import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { type MarketingTemplate, PRODUCT_LABEL, type MarketingProduct, type TemplateKind } from "@/lib/marketing";
import { Loader2, Plus, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/marketing")({
  component: AdminMarketing,
});

const KINDS: TemplateKind[] = ["post", "whatsapp", "reel", "visiting_card"];
const PRODUCTS = Object.keys(PRODUCT_LABEL) as MarketingProduct[];

type Editing = Partial<MarketingTemplate> & { theme_bg?: string; theme_accent?: string; theme_text?: string };

function AdminMarketing() {
  const { role, loading: authLoading } = useAuth();
  const [list, setList] = useState<MarketingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("marketing_templates").select("*").order("display_order");
    setList((data ?? []) as unknown as MarketingTemplate[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (authLoading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const newTemplate = () => {
    setEditing({
      kind: "post", product: "generic", name: "", headline: "", subheadline: "",
      body: "", cta: "Apply Now", enabled: true, display_order: list.length + 1,
      theme_bg: "#0c2340", theme_accent: "#2dd4a8", theme_text: "#ffffff",
    });
    setOpen(true);
  };

  const editTemplate = (t: MarketingTemplate) => {
    setEditing({
      ...t,
      theme_bg: t.theme.bg, theme_accent: t.theme.accent, theme_text: t.theme.text,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.headline) { toast.error("Name and headline required"); return; }
    const payload = {
      kind: editing.kind!, product: editing.product!, name: editing.name!,
      headline: editing.headline!, subheadline: editing.subheadline ?? null,
      body: editing.body ?? null, cta: editing.cta ?? "Apply Now",
      enabled: editing.enabled ?? true, display_order: editing.display_order ?? 0,
      theme: { bg: editing.theme_bg, accent: editing.theme_accent, text: editing.theme_text },
    };
    const { error } = editing.id
      ? await supabase.from("marketing_templates").update(payload).eq("id", editing.id)
      : await supabase.from("marketing_templates").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved");
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("marketing_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const toggle = async (t: MarketingTemplate) => {
    const { error } = await supabase.from("marketing_templates").update({ enabled: !t.enabled }).eq("id", t.id);
    if (error) toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Marketing Templates</h1>
          <p className="text-sm text-muted-foreground">Curate the template library used by all partners.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={newTemplate} className="gap-2"><Plus className="size-4" /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit" : "New"} template</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Kind</Label>
                    <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as TemplateKind })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Product</Label>
                    <Select value={editing.product} onValueChange={(v) => setEditing({ ...editing, product: v as MarketingProduct })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PRODUCTS.map((p) => <SelectItem key={p} value={p}>{PRODUCT_LABEL[p]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Internal name</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Headline</Label>
                  <Input value={editing.headline ?? ""} onChange={(e) => setEditing({ ...editing, headline: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Subheadline</Label>
                  <Input value={editing.subheadline ?? ""} onChange={(e) => setEditing({ ...editing, subheadline: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Body</Label>
                  <Textarea value={editing.body ?? ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={3} />
                </div>
                <div>
                  <Label className="text-xs">CTA</Label>
                  <Input value={editing.cta ?? ""} onChange={(e) => setEditing({ ...editing, cta: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Background</Label>
                    <Input type="color" value={editing.theme_bg} onChange={(e) => setEditing({ ...editing, theme_bg: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Accent</Label>
                    <Input type="color" value={editing.theme_accent} onChange={(e) => setEditing({ ...editing, theme_accent: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Text</Label>
                    <Input type="color" value={editing.theme_text} onChange={(e) => setEditing({ ...editing, theme_text: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <Label className="text-xs">Display order</Label>
                    <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.enabled ?? true} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                    <Label>Enabled</Label>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((t) => (
            <Card key={t.id} className={t.enabled ? "" : "opacity-60"}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{t.kind}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{PRODUCT_LABEL[t.product]}</Badge>
                    </div>
                  </div>
                  <Switch checked={t.enabled} onCheckedChange={() => toggle(t)} />
                </div>
                <div
                  className="rounded h-16 px-3 flex items-center text-sm font-bold"
                  style={{ background: t.theme.bg, color: t.theme.text }}
                >
                  {t.headline}
                </div>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => editTemplate(t)}>
                    <Edit3 className="size-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => remove(t.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
