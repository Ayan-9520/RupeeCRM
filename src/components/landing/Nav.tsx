import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, MessageCircle, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const links = [
  { label: "Platform", href: "#platform" },
  { label: "Modules", href: "#modules" },
  { label: "Products", href: "#products" },
  { label: "How it works", href: "#flow" },
  { label: "Pricing", href: "#pricing" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 inset-x-0 z-50 wa-glass border-b border-border/60">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="size-9 rounded-full bg-[var(--wa-green)] grid place-items-center shadow-mint group-hover:scale-105 transition-smooth">
            <MessageCircle className="size-5 text-white" strokeWidth={2.5} fill="white" fillOpacity={0.2} />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-foreground tracking-tight">LeadMines</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--wa-green)] font-semibold -mt-0.5">
              by MoneyMines
            </div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground hover:text-[var(--wa-teal)] dark:hover:text-[var(--wa-green)] transition-smooth font-medium"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/learn-earn"
            className="text-sm text-muted-foreground hover:text-[var(--wa-teal)] dark:hover:text-[var(--wa-green)] transition-smooth inline-flex items-center gap-1.5 font-medium"
          >
            Learn & Earn
            <span className="px-1.5 py-0.5 rounded-full bg-[var(--wa-green)]/15 text-[var(--wa-green)] text-[9px] font-bold">
              NEW
            </span>
          </Link>
        </nav>

        <div className="hidden lg:flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            to="/become-partner"
            className="text-sm font-semibold text-[var(--wa-teal)] dark:text-[var(--wa-green)] hover:opacity-80 transition-smooth px-2"
          >
            Become a Partner
          </Link>
          <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-smooth px-2">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--wa-green)] hover:bg-[var(--wa-green-dark)] text-white text-sm font-semibold transition-smooth shadow-mint"
          >
            Get started
          </Link>
        </div>

        <div className="flex lg:hidden items-center gap-2">
          <ThemeToggle />
          <button onClick={() => setOpen(!open)} className="p-2 -mr-2 text-foreground" aria-label="Menu">
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-xl">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-foreground/80 font-medium"
              >
                {l.label}
              </a>
            ))}
            <Link to="/learn-earn" onClick={() => setOpen(false)} className="py-2.5 text-sm text-foreground/80 inline-flex items-center gap-2">
              Learn & Earn
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--wa-green)]/15 text-[var(--wa-green)] text-[9px] font-bold">
                NEW
              </span>
            </Link>
            <Link
              to="/become-partner"
              onClick={() => setOpen(false)}
              className="mt-3 py-2.5 text-center rounded-full border-2 border-[var(--wa-green)] text-[var(--wa-green)] text-sm font-semibold"
            >
              Become a Partner
            </Link>
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="mt-2 py-2.5 text-center rounded-full bg-[var(--wa-green)] text-white text-sm font-semibold"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
