import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, RefreshCw, BookOpen, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { COURSES } from "@/lib/courses";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED_PROMPTS = [
  "Customer earns ₹45k/month, CIBIL 720, wants ₹3L for wedding — best product?",
  "Self-employed shopkeeper, 3-yr GST, ₹25L turnover — pitch BL or LAP?",
  "Customer says: 'Your interest rate is too high.' Give me a counter.",
  "What documents do I need for a home loan balance transfer?",
  "Difference between family floater and individual health policy?",
  "Daily call discipline — give me a 30-minute morning routine.",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-trainer`;

// Strip [[cite: ...]] from rendered text and return slugs separately
function parseCitations(raw: string): { body: string; slugs: string[] } {
  const match = raw.match(/\[\[cite:\s*([^\]]+)\]\]/i);
  if (!match) return { body: raw, slugs: [] };
  const slugs = match[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { body: raw.replace(match[0], "").trim(), slugs };
}

export function AITrainerChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || isStreaming) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m,
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const errBody = await resp.json().catch(() => ({ error: "Failed to start chat" }));
        if (resp.status === 429) toast.error("Trainer is busy — try again in a minute.");
        else if (resp.status === 402) toast.error("AI credits exhausted. Top up in workspace settings.");
        else toast.error(errBody.error || "Trainer is unavailable. Please retry.");
        setMessages((prev) => prev.slice(0, -1));
        setIsStreaming(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      console.error(e);
      toast.error("Connection lost. Try again.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }

  return (
    <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden flex flex-col h-[640px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-border bg-gradient-to-r from-accent/10 via-transparent to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-10 rounded-2xl bg-foreground text-background grid place-items-center shrink-0">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold leading-tight">Trainer AI</div>
            <div className="text-xs text-muted-foreground truncate">
              Loans · Insurance · Pitch scripts · Objection handling
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="size-3.5" /> New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-2">
            <div className="size-14 rounded-3xl bg-mint-gradient text-primary grid place-items-center mb-4 shadow-mint">
              <Bot className="size-7" strokeWidth={2.2} />
            </div>
            <h3 className="font-display text-lg font-bold">Ask anything about the products you sell.</h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
              I'll suggest the best product for any customer, write a pitch, or counter an objection — and link the course module that goes deeper.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="text-left text-xs sm:text-sm p-3 rounded-xl border border-border bg-background hover:border-accent hover:bg-accent/5 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} msg={m} />)
        )}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Trainer is thinking…
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 sm:p-4 border-t border-border bg-background"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 focus-within:border-accent transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            disabled={isStreaming}
            placeholder="Ask about a product, pitch or objection…"
            className="flex-1 resize-none bg-transparent outline-none text-sm py-1.5 placeholder:text-muted-foreground max-h-32"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="shrink-0 size-9 rounded-xl bg-foreground text-background grid place-items-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform"
            aria-label="Send"
          >
            {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          Trainer AI gives general guidance — always confirm rates & rules in the lender's grid.
        </div>
      </form>
    </div>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <div className="flex gap-3 justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-foreground text-background px-4 py-2.5 text-sm whitespace-pre-wrap">
          {msg.content}
        </div>
        <div className="size-8 rounded-full bg-muted text-muted-foreground grid place-items-center shrink-0">
          <User className="size-4" />
        </div>
      </div>
    );
  }

  const { body, slugs } = parseCitations(msg.content);
  const cited = slugs
    .map((s) => COURSES.find((c) => c.slug === s))
    .filter((c): c is (typeof COURSES)[number] => Boolean(c));

  return (
    <div className="flex gap-3">
      <div className="size-8 rounded-full bg-mint-gradient text-primary grid place-items-center shrink-0 shadow-mint">
        <Sparkles className="size-4" />
      </div>
      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-sm bg-muted/60 px-4 py-3 text-sm prose prose-sm max-w-none dark:prose-invert prose-headings:font-display prose-headings:mt-2 prose-headings:mb-1.5 prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-strong:text-foreground">
          <ReactMarkdown>{body || "…"}</ReactMarkdown>
        </div>
        {cited.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pr-1">
              <BookOpen className="size-3" /> Learn more
            </span>
            {cited.map((c) => (
              <Link
                key={c.slug}
                to="/learn-earn/$slug"
                params={{ slug: c.slug }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent-foreground border border-accent/30 text-[11px] font-semibold hover:bg-accent/20 transition-colors"
              >
                {c.title}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
