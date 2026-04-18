import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Megaphone, Loader2, Heart, MessageCircle, Share2, Plus, Send, X } from "lucide-react";

export const Route = createFileRoute("/dashboard/community")({
  head: () => ({ meta: [{ title: "Community — LeadMines" }] }),
  component: Community,
});

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "success_story", label: "🏆 Wins" },
  { key: "tip", label: "💡 Tips" },
  { key: "motivation", label: "🔥 Motivation" },
  { key: "sales_hack", label: "⚡ Hacks" },
  { key: "question", label: "❓ Questions" },
] as const;

type Post = {
  id: string;
  author_id: string;
  title: string;
  body: string;
  category: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: { full_name: string | null; avatar_url: string | null; dsa_tier: string };
};

type Comment = { id: string; author_id: string; body: string; created_at: string; author?: { full_name: string | null } };

function Community() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [composerOpen, setComposerOpen] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("community_posts").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
    if (filter !== "all") q = q.eq("category", filter as "tip");
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const ids = (data ?? []).map((p) => p.author_id);
    const profilesRes = ids.length ? await supabase.from("profiles").select("id,full_name,avatar_url,dsa_tier").in("id", ids) : { data: [] };
    const profileMap = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p]));
    setPosts((data ?? []).map((p) => ({ ...p, author: profileMap[p.author_id] })) as Post[]);
    if (user) {
      const likesRes = await supabase.from("community_post_likes").select("post_id").eq("user_id", user.id);
      setLiked(Object.fromEntries((likesRes.data ?? []).map((l) => [l.post_id, true])));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, user]);

  const toggleLike = async (post: Post) => {
    if (!user) { toast.error("Please sign in to like"); return; }
    const isLiked = liked[post.id];
    setLiked((l) => ({ ...l, [post.id]: !isLiked }));
    setPosts((ps) => ps.map((p) => p.id === post.id ? { ...p, likes_count: p.likes_count + (isLiked ? -1 : 1) } : p));
    if (isLiked) {
      await supabase.from("community_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      await supabase.from("community_post_likes").insert({ post_id: post.id, user_id: user.id });
    }
  };

  const share = async (post: Post) => {
    const url = `${window.location.origin}/dashboard/community#${post.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: post.title, text: post.body.slice(0, 140), url }); return; } catch { /* fallthrough */ }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">DSA Community</h1>
          <p className="text-muted-foreground mt-1">Tips, wins, and motivation from 12K+ partners across India.</p>
        </div>
        <button onClick={() => setComposerOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-accent-foreground font-semibold text-sm hover:opacity-90">
          <Plus className="size-4" /> New post
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-smooth ${filter === c.key ? "bg-accent text-accent-foreground" : "bg-card border border-border hover:bg-secondary"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-accent" /></div>
      ) : posts.length === 0 ? (
        <div className="rounded-3xl bg-card border border-dashed border-border p-12 text-center">
          <div className="size-14 mx-auto rounded-2xl bg-accent/15 grid place-items-center"><Megaphone className="size-6 text-accent" /></div>
          <h2 className="font-display text-xl font-bold mt-4">Be the first to post</h2>
          <p className="text-muted-foreground mt-2">Share a win, drop a tip, or ask the community a question.</p>
          <button onClick={() => setComposerOpen(true)} className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-full bg-accent text-accent-foreground font-semibold hover:opacity-90">
            <Plus className="size-4" /> Create post
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} liked={!!liked[p.id]} onLike={toggleLike} onShare={share} onOpen={() => setOpenPost(p)} />
          ))}
        </div>
      )}

      {composerOpen && <Composer onClose={() => setComposerOpen(false)} onCreated={() => { setComposerOpen(false); load(); }} />}
      {openPost && <PostModal post={openPost} liked={!!liked[openPost.id]} onLike={toggleLike} onShare={share} onClose={() => setOpenPost(null)} />}
    </div>
  );
}

function PostCard({ post, liked, onLike, onShare, onOpen }: { post: Post; liked: boolean; onLike: (p: Post) => void; onShare: (p: Post) => void; onOpen: () => void }) {
  const initials = (post.author?.full_name ?? "DSA").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return (
    <article className="rounded-2xl bg-card border border-border p-5 shadow-card hover:border-accent/40 transition-smooth">
      <header className="flex items-center gap-3 mb-3">
        <div className="size-10 rounded-full bg-mint-gradient grid place-items-center font-display font-bold text-primary">{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm flex items-center gap-2">
            {post.author?.full_name ?? "DSA Partner"}
            {post.author?.dsa_tier && post.author.dsa_tier !== "bronze" && (
              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">{post.author.dsa_tier}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{relativeTime(post.created_at)}</div>
        </div>
      </header>
      <button onClick={onOpen} className="text-left w-full">
        <h2 className="font-display font-bold text-lg leading-tight hover:text-accent transition-smooth">{post.title}</h2>
        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3 whitespace-pre-line">{post.body}</p>
      </button>
      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {post.tags.slice(0, 4).map((t) => <span key={t} className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">#{t}</span>)}
        </div>
      )}
      <footer className="flex items-center gap-1 mt-4 pt-3 border-t border-border">
        <button onClick={() => onLike(post)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-smooth ${liked ? "text-rose-500" : "hover:bg-secondary"}`}>
          <Heart className={`size-4 ${liked ? "fill-current" : ""}`} /> {post.likes_count}
        </button>
        <button onClick={onOpen} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-secondary">
          <MessageCircle className="size-4" /> {post.comments_count}
        </button>
        <button onClick={() => onShare(post)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-secondary ml-auto">
          <Share2 className="size-4" />
        </button>
      </footer>
    </article>
  );
}

function PostModal({ post, liked, onLike, onShare, onClose }: { post: Post; liked: boolean; onLike: (p: Post) => void; onShare: (p: Post) => void; onClose: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("community_post_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
      const ids = (data ?? []).map((c) => c.author_id);
      const profilesRes = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
      const map = Object.fromEntries((profilesRes.data ?? []).map((p) => [p.id, p]));
      setComments((data ?? []).map((c) => ({ ...c, author: map[c.author_id] })) as Comment[]);
      setLoading(false);
    })();
  }, [post.id]);

  const submit = async () => {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { data, error } = await supabase.from("community_post_comments").insert({ post_id: post.id, author_id: user.id, body }).select().single();
    if (error) { toast.error(error.message); return; }
    setComments((cs) => [...cs, { ...data, author: { full_name: user.email ?? null } } as Comment]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">{post.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{post.author?.full_name ?? "DSA Partner"} · {relativeTime(post.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none"><X className="size-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="whitespace-pre-line">{post.body}</p>
          <div className="flex items-center gap-1 pt-2 border-t border-border">
            <button onClick={() => onLike(post)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${liked ? "text-rose-500" : "hover:bg-secondary"}`}>
              <Heart className={`size-4 ${liked ? "fill-current" : ""}`} /> {post.likes_count}
            </button>
            <button onClick={() => onShare(post)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-secondary ml-auto"><Share2 className="size-4" /> Share</button>
          </div>
          <div>
            <div className="text-xs uppercase font-bold text-muted-foreground tracking-wide mb-3">Comments ({post.comments_count})</div>
            {loading ? (
              <Loader2 className="size-4 animate-spin text-accent" />
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet — be the first.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <div className="font-semibold text-xs">{c.author?.full_name ?? "DSA"} <span className="text-muted-foreground font-normal ml-1">{relativeTime(c.created_at)}</span></div>
                    <div className="mt-0.5">{c.body}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {user && (
            <div className="flex gap-2 pt-3 border-t border-border">
              <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Add a comment…" className="input-base flex-1" />
              <button onClick={submit} disabled={!text.trim()} className="px-4 rounded-md bg-accent text-accent-foreground font-bold disabled:opacity-50"><Send className="size-4" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("tip");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) { toast.error("Please sign in"); return; }
    if (!title.trim() || !body.trim()) { toast.error("Title and body are required"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("community_posts").insert({
      author_id: user.id, title: title.trim(), body: body.trim(), category: category as never,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Posted!");
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-3xl border border-border shadow-xl w-full max-w-xl">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Share with the community</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-base w-full">
            <option value="tip">💡 Tip</option>
            <option value="success_story">🏆 Success story</option>
            <option value="motivation">🔥 Motivation</option>
            <option value="sales_hack">⚡ Sales hack</option>
            <option value="question">❓ Question</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-base w-full" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Share your story, tip, or question…" rows={6} className="input-base w-full !h-auto resize-y" />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-md border border-border font-semibold text-sm">Cancel</button>
            <button onClick={submit} disabled={submitting} className="px-5 py-2 rounded-md bg-accent text-accent-foreground font-bold text-sm disabled:opacity-60">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
