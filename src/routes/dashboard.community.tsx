import { FormEvent, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Loader2, PenLine, Send, Tags } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getRoleLabel } from "@/lib/role-access";
import {
  createCommunityPost,
  listCommunityPosts,
  toggleCommunityLike,
  type CommunityPost,
} from "@/lib/python-api";

export const Route = createFileRoute("/dashboard/community")({
  head: () => ({ meta: [{ title: "Community — RupeeOne" }] }),
  component: Community,
});

const CAN_POST = new Set(["ceo", "super_admin", "admin", "dsa", "affiliate"]);
const CAN_LIKE = new Set(["ceo", "super_admin", "admin", "dsa", "affiliate", "caller"]);
const TOPICS = ["Home loan", "Personal loan", "Credit card", "Insurance", "City update", "Partner tip"];

const TOPIC_STYLE: Record<string, { bar: string; chip: string }> = {
  "Home loan": { bar: "from-[#10662A] to-[#3dae62]", chip: "bg-[#E8F7EC] text-[#0e4d28]" },
  "Personal loan": { bar: "from-[#390A5D] to-[#7a3eab]", chip: "bg-[#F4F0FA] text-[#390A5D]" },
  "Credit card": { bar: "from-[#0f6e8c] to-[#3aa7c4]", chip: "bg-[#E7F6FA] text-[#0f6e8c]" },
  Insurance: { bar: "from-[#8a5a12] to-[#d4a017]", chip: "bg-[#FBF4E4] text-[#8a5a12]" },
  "City update": { bar: "from-[#1d4ed8] to-[#60a5fa]", chip: "bg-[#EAF1FF] text-[#1d4ed8]" },
  "Partner tip": { bar: "from-[#10662A] to-[#390A5D]", chip: "bg-[#F4F0FA] text-[#390A5D]" },
};

function postedAt(iso: string) {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Community() {
  const { role, user } = useAuth();
  const canPost = role ? CAN_POST.has(role) : false;
  const canLike = role ? CAN_LIKE.has(role) : false;
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [topic, setTopic] = useState("Partner tip");
  const [filter, setFilter] = useState("All");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [liking, setLiking] = useState<string | null>(null);

  const load = async () => setPosts(await listCommunityPosts());

  useEffect(() => {
    load()
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load posts"))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => (filter === "All" ? posts : posts.filter((post) => post.topic === filter)),
    [posts, filter],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    try {
      const post = await createCommunityPost(body.trim(), topic);
      setPosts((current) => [post, ...current]);
      setBody("");
      setFilter("All");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish");
    } finally {
      setSending(false);
    }
  };

  const like = async (post: CommunityPost) => {
    if (!canLike) return;
    setLiking(post.id);
    try {
      const result = await toggleCommunityLike(post.id);
      setPosts((current) => current.map((item) => (item.id === post.id ? { ...item, ...result } : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not like");
    } finally {
      setLiking(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#10662A]">{role ? getRoleLabel(role) : "Community"}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#390A5D]">Community</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5c4d72]">
          {canPost
            ? `${posts.length} posts on the public board. A partner or admin writes a tip. A like stays on this login.`
            : `${posts.length} posts. This login can read the board. Posting is open to partners and admins.`}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { n: "1", title: "Pick a topic", detail: "Home loan, personal loan, cards, insurance, a city, or a partner tip.", icon: Tags },
          { n: "2", title: "Write what you know", detail: "One useful note. Do not put a customer’s phone or PAN here.", icon: PenLine },
          { n: "3", title: "Others can like it", detail: "The count is saved. It is not a lead and it does not pay a commission.", icon: Heart },
        ].map((step) => (
          <div key={step.n} className="flex gap-3 rounded-2xl border border-[#d8ecdd] bg-white p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#E8F7EC] text-[#10662A]">
              <step.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold text-[#10662A]">Step {step.n}</p>
              <p className="mt-0.5 font-semibold text-[#390A5D]">{step.title}</p>
              <p className="mt-1 text-sm leading-5 text-[#5c4d72]">{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {canPost ? (
        <form onSubmit={submit} className="rounded-3xl border border-[#d7eadb] bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-[#14281c]">Posting as {user?.full_name || "you"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {TOPICS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTopic(item)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  topic === item ? "bg-[#10662A] text-white" : "bg-[#F4FBF6] text-[#0e4d28]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={600}
            required
            placeholder="Share a product tip or a city update."
            className="mt-3 w-full rounded-2xl border border-[#d7eadb] px-3 py-3 text-sm leading-6 text-[#14281c]"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-full bg-[#10662A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Publish
            </button>
          </div>
        </form>
      ) : (
        <p className="rounded-2xl border border-[#d7eadb] bg-white px-4 py-3 text-sm text-[#5c4d72]">
          You can read and like posts. Publishing is for admin and partners.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...TOPICS].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === item ? "bg-[#390A5D] text-white" : "bg-white text-[#390A5D]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="size-6 animate-spin text-[#10662A]" />
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-[#d7eadb] bg-white px-5 py-10 text-center text-sm text-[#5c4d72]">
          No posts in {filter}.
        </p>
      ) : (
        visible.map((post) => {
          const tone = TOPIC_STYLE[post.topic] ?? TOPIC_STYLE["Partner tip"];
          return (
            <article key={post.id} className="overflow-hidden rounded-[28px] border border-[#e7f0ea] bg-white shadow-[0_16px_36px_rgba(57,10,93,0.06)]">
              <div className={`h-1.5 bg-gradient-to-r ${tone.bar}`} />
              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${tone.chip}`}>
                    {post.topic || "Update"}
                  </span>
                  <span className="text-xs font-medium text-[#7a6d88]">{postedAt(post.created_at)}</span>
                </div>
                <p className="mt-4 font-display text-[16px] font-medium leading-8 text-[#1a1428]">{post.body}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#f0f2f4] pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#10662A] to-[#0b4d1f] font-display text-lg font-bold text-white">
                      {post.author_name.slice(0, 1).toUpperCase()}
                    </span>
                    <p className="truncate text-sm font-semibold text-[#14281c]">{post.author_name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => like(post)}
                    disabled={!canLike || liking === post.id}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold ${
                      post.liked ? "border-[#b7e4c4] bg-[#E8F7EC] text-[#10662A]" : "border-[#d7eadb] bg-[#F7FCF8] text-[#10662A]"
                    }`}
                  >
                    <Heart className={`size-4 ${post.liked ? "fill-[#10662A]" : ""}`} />
                    {post.like_count > 0 ? post.like_count : "Like"}
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}
    </div>
  );
}
