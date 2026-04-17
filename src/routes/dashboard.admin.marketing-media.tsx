import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PRODUCT_LABEL } from "@/lib/marketing";
import type { MarketingProduct } from "@/lib/marketing";
import { Loader2, Upload, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Video, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/admin/marketing-media")({
  component: AdminMarketingMedia,
});

type MediaType = "image" | "video";
type Item = {
  id: string;
  product: MarketingProduct;
  media_type: MediaType;
  image_url: string;
  thumbnail_url: string | null;
  title: string | null;
  prompt: string | null;
  source: string;
  tags: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
};

const PRODUCTS = Object.keys(PRODUCT_LABEL) as MarketingProduct[];
const TYPES: { value: MediaType | "all"; label: string }[] = [
  { value: "all", label: "All Media" },
  { value: "image", label: "Images" },
  { value: "video", label: "Reels" },
];

function AdminMarketingMedia() {
  const { role, user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState<MarketingProduct | "all">("all");
  const [typeFilter, setTypeFilter] = useState<MediaType | "all">("all");
  const [uploading, setUploading] = useState(false);
  const [uploadProduct, setUploadProduct] = useState<MarketingProduct>("personal_loan");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("product_images").select("*").order("product").order("display_order");
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setItems((data ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  if (authLoading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith("video/");
        const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "png");
        const path = `${uploadProduct}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("marketing-images").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from("marketing-images").getPublicUrl(path);
        const tags = uploadTags.split(",").map((t) => t.trim()).filter(Boolean);
        const maxOrder = Math.max(0, ...items.filter((i) => i.product === uploadProduct).map((i) => i.display_order));
        const { error: insErr } = await supabase.from("product_images").insert({
          product: uploadProduct,
          media_type: isVideo ? "video" : "image",
          image_url: pub.publicUrl,
          title: uploadTitle || file.name,
          source: "upload",
          tags,
          display_order: maxOrder + 1,
          created_by: user.id,
          is_active: true,
        });
        if (insErr) {
          toast.error(`DB insert failed: ${insErr.message}`);
        }
      }
      toast.success("Media uploaded");
      setUploadTitle("");
      setUploadTags("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (item: Item) => {
    const { error } = await supabase
      .from("product_images")
      .update({ is_active: !item.is_active })
      .eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: !i.is_active } : i)));
  };

  const updateField = async (id: string, patch: Partial<Item>) => {
    const { error } = await supabase.from("product_images").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const reorder = async (item: Item, dir: "up" | "down") => {
    const sameProduct = items
      .filter((i) => i.product === item.product)
      .sort((a, b) => a.display_order - b.display_order);
    const idx = sameProduct.findIndex((i) => i.id === item.id);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sameProduct.length) return;
    const swap = sameProduct[swapIdx];
    await Promise.all([
      supabase.from("product_images").update({ display_order: swap.display_order }).eq("id", item.id),
      supabase.from("product_images").update({ display_order: item.display_order }).eq("id", swap.id),
    ]);
    load();
  };

  const remove = async (item: Item) => {
    if (!confirm(`Delete this ${item.media_type}? This cannot be undone.`)) return;
    // Best-effort storage cleanup if hosted in our bucket
    try {
      const url = new URL(item.image_url);
      const marker = "/marketing-images/";
      const i = url.pathname.indexOf(marker);
      if (i >= 0) {
        const path = url.pathname.slice(i + marker.length);
        await supabase.storage.from("marketing-images").remove([path]);
      }
    } catch {
      /* ignore url parsing errors */
    }
    const { error } = await supabase.from("product_images").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const filtered = items.filter((i) => {
    if (productFilter !== "all" && i.product !== productFilter) return false;
    if (typeFilter !== "all" && i.media_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">Marketing Media Library</h1>
        <p className="text-sm text-muted-foreground">
          Upload product-specific images and reel videos. Tag, reorder, or disable per product category.
        </p>
      </div>

      {/* Upload card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <Upload className="size-4 text-primary" /> Upload New Media
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Product category</Label>
              <Select value={uploadProduct} onValueChange={(v) => setUploadProduct(v as MarketingProduct)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRODUCTS.map((p) => (
                    <SelectItem key={p} value={p}>{PRODUCT_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title (optional)</Label>
              <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Diwali Home Loan" />
            </div>
            <div>
              <Label className="text-xs">Tags (comma separated)</Label>
              <Input value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} placeholder="festival, diwali, family" />
            </div>
          </div>
          <div>
            <Input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={handleUpload}
              disabled={uploading}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Accepts images (JPG/PNG/WebP) and videos (MP4/WebM) for reels. Multiple files supported.
            </p>
          </div>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Uploading…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as MediaType | "all")}>
          <TabsList>
            {TYPES.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto w-56">
          <Select value={productFilter} onValueChange={(v) => setProductFilter(v as MarketingProduct | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {PRODUCTS.map((p) => (
                <SelectItem key={p} value={p}>{PRODUCT_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No media yet for this filter. Upload some above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onToggle={() => toggleActive(item)}
              onRemove={() => remove(item)}
              onReorder={(dir) => reorder(item, dir)}
              onSave={(patch) => updateField(item.id, patch)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaCard({
  item,
  onToggle,
  onRemove,
  onReorder,
  onSave,
}: {
  item: Item;
  onToggle: () => void;
  onRemove: () => void;
  onReorder: (dir: "up" | "down") => void;
  onSave: (patch: Partial<Item>) => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const dirty = title !== (item.title ?? "") || tags !== item.tags.join(", ");

  return (
    <Card className={item.is_active ? "" : "opacity-60"}>
      <CardContent className="p-3 space-y-2">
        <div className="relative rounded-md overflow-hidden bg-muted aspect-video">
          {item.media_type === "video" ? (
            <video src={item.image_url} controls className="w-full h-full object-cover" preload="metadata" />
          ) : (
            <img src={item.image_url} alt={item.title ?? ""} className="w-full h-full object-cover" />
          )}
          <Badge className="absolute top-2 left-2 gap-1" variant="secondary">
            {item.media_type === "video" ? <Video className="size-3" /> : <ImageIcon className="size-3" />}
            {item.media_type}
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">{PRODUCT_LABEL[item.product]}</Badge>
          <div className="flex items-center gap-1.5">
            <Switch checked={item.is_active} onCheckedChange={onToggle} />
            <span className="text-[11px] text-muted-foreground">{item.is_active ? "Active" : "Hidden"}</span>
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Tags</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="festival, diwali" className="h-8 text-sm" />
        </div>
        <div className="flex items-center gap-1 pt-1">
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => onReorder("up")} title="Move up">
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => onReorder("down")} title="Move down">
            <ArrowDown className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant={dirty ? "default" : "outline"}
            className="h-8 flex-1 gap-1.5"
            disabled={!dirty}
            onClick={() => onSave({ title: title || null, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) })}
          >
            <Save className="size-3.5" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-8 px-2 text-destructive" onClick={onRemove} title="Delete">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
