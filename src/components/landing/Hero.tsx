import type { ReactNode } from "react";
import { ArrowRight, CheckCheck, ShieldCheck, Zap, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

function ChatBubble({
  out,
  time,
  children,
}: {
  out?: boolean;
  time: string;
  children: ReactNode;
}) {
  return (
    <div className={`max-w-[88%] ${out ? "ml-auto" : ""}`}>
      <div className={`px-3.5 py-2.5 text-[13px] leading-relaxed ${out ? "wa-bubble-out" : "wa-bubble-in"}`}>
        {children}
        <div className={`flex items-center justify-end gap-1 mt-1 ${out ? "text-[var(--wa-muted)]" : "text-[var(--wa-muted)]"}`}>
          <span className="text-[10px]">{time}</span>
          {out && <CheckCheck className="size-3.5 text-[var(--wa-tick)]" />}
        </div>
      </div>
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="wa-phone relative mx-auto w-full max-w-[340px] overflow-hidden bg-[var(--wa-chat-light)]">
      {/* Status bar */}
      <div className="wa-header-bar px-4 py-3 flex items-center gap-3">
        <div className="size-9 rounded-full bg-white/20 grid place-items-center text-white text-xs font-bold">LM</div>
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold text-sm truncate">LeadMines Bot</div>
          <div className="text-white/70 text-[11px]">online · AI verified leads</div>
        </div>
        <div className="flex gap-3 text-white/80">
          <span className="text-xs">📞</span>
          <span className="text-xs">⋮</span>
        </div>
      </div>

      {/* Chat area */}
      <div className="wa-pattern px-3 py-4 space-y-3 min-h-[380px]">
        <div className="text-center">
          <span className="inline-block px-3 py-1 rounded-lg bg-black/5 dark:bg-white/10 text-[10px] text-[var(--wa-muted)] font-medium">
            Today
          </span>
        </div>

        <ChatBubble time="10:24 AM">
          <span className="font-semibold text-[var(--wa-teal)] dark:text-[var(--wa-green)]">🔥 Hot Lead Alert</span>
          <br />
          Personal Loan · ₹8,00,000
          <br />
          Mumbai · CIBIL 782
          <br />
          <span className="text-[var(--wa-green)] font-medium">Score 92 · Verified ✓</span>
        </ChatBubble>

        <ChatBubble out time="10:25 AM">
          Buy this lead now — only ₹199
        </ChatBubble>

        <ChatBubble time="10:25 AM">
          ✅ Lead purchased! CRM profile auto-created.
          <br />
          <span className="text-[var(--wa-muted)]">Tap to open workspace →</span>
        </ChatBubble>

        <ChatBubble out time="10:26 AM">
          Customer called. Docs pending — PAN & salary slip 📎
        </ChatBubble>

        <ChatBubble time="10:28 AM">
          📊 Eligibility: <span className="font-semibold text-[var(--wa-green)]">Strong</span>
          <br />
          FOIR 38% · Approved for HDFC login
        </ChatBubble>
      </div>

      {/* Input bar */}
      <div className="px-2 py-2 bg-secondary/80 border-t border-border flex items-center gap-2">
        <div className="flex-1 rounded-full bg-card border border-border px-4 py-2 text-xs text-muted-foreground">
          Type a message
        </div>
        <div className="size-9 rounded-full bg-[var(--wa-green)] grid place-items-center text-white shrink-0">
          <ArrowRight className="size-4" />
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative pt-28 lg:pt-36 pb-20 lg:pb-28 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 wa-pattern" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--wa-teal)]/8 via-transparent to-[var(--wa-green)]/5 dark:from-[var(--wa-teal)]/15 dark:to-[var(--wa-green)]/8" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[var(--wa-green)]/10 blur-[120px] -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[var(--wa-teal)]/10 blur-[100px] translate-y-1/3 -translate-x-1/4" />

      <div className="relative max-w-7xl mx-auto px-5 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full wa-glass border border-[var(--wa-green)]/30 text-xs font-semibold text-[var(--wa-teal)] dark:text-[var(--wa-green)]">
            <span className="size-2 rounded-full bg-[var(--wa-green)] animate-pulse" />
            India's #1 Lead Marketplace + DSA CRM
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl xl:text-[3.5rem] font-bold leading-[1.08] tracking-tight text-foreground">
            Mine high-intent{" "}
            <span className="text-gradient">financial leads</span>.
            <br />
            Close on WhatsApp.
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
            AI-verified leads for Loans, Credit Cards, Insurance & Mutual Funds — with a premium DSA CRM,
            WhatsApp alerts, partner community, and affiliate earnings. From click to disbursal.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white font-semibold shadow-mint hover:scale-[1.02] transition-smooth"
            >
              Start earning today
              <ArrowRight className="size-4 group-hover:translate-x-1 transition-smooth" />
            </Link>
            <a
              href="#flow"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full wa-glass border border-border text-foreground font-medium hover:border-[var(--wa-green)]/40 transition-smooth"
            >
              See how it works
            </a>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3 max-w-lg">
            {[
              { icon: ShieldCheck, label: "AI Verified", value: "98%" },
              { icon: Zap, label: "Avg. Close", value: "3.2 days" },
              { icon: Users, label: "Active DSAs", value: "12,400+" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl bg-card border border-border p-4 hover:border-[var(--wa-green)]/30 hover:shadow-card transition-smooth"
              >
                <s.icon className="size-4 text-[var(--wa-green)]" />
                <div className="mt-2 text-2xl font-display font-bold text-foreground">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-fade-up flex justify-center lg:justify-end" style={{ animationDelay: "150ms" }}>
          <div className="absolute -inset-8 bg-[var(--wa-green)]/15 blur-3xl rounded-full" />
          <div className="relative animate-float">
            <PhoneMockup />
          </div>
          {/* Floating notification */}
          <div className="absolute -bottom-4 -left-2 sm:left-4 hidden sm:block rounded-2xl wa-glass border border-[var(--wa-green)]/25 shadow-elevated px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-[var(--wa-green)] grid place-items-center text-white text-xs">✓</div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--wa-green)] font-bold">New message</div>
                <div className="font-semibold text-sm text-foreground">Sanction approved · ₹8L</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
