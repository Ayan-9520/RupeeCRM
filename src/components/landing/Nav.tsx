import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Sparkles } from "lucide-react";

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
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="size-9 rounded-xl bg-mint-gradient grid place-items-center shadow-mint group-hover:scale-105 transition-smooth">
            <Sparkles className="size-5 text-primary" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-foreground tracking-tight">LeadMines</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground -mt-0.5">by MoneyMines</div>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-smooth">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-3">
          <Link to="/auth" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-smooth">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-smooth shadow-card"
          >
            Get started
          </Link>
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 -mr-2 text-foreground" aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden border-t border-border bg-background">
          <div className="px-5 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-2.5 text-sm text-foreground/80"
              >
                {l.label}
              </a>
            ))}
            <Link to="/auth" className="mt-3 py-2.5 text-center rounded-full bg-foreground text-background text-sm font-medium">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
