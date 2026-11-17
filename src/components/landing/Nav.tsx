import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Phone } from "lucide-react";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[#d8ecdd] bg-white/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link to="/learn-earn" className="flex items-center gap-2.5 min-w-0">
          <span className="size-8 rounded-full bg-[#10662A] grid place-items-center text-white font-display font-bold text-sm shrink-0">
            R
          </span>
          <span className="font-display font-bold text-lg tracking-tight text-[#10662A] truncate">
            RupeeOne
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="tel:+917982953129"
            className="hidden lg:inline-flex items-center gap-1.5 text-xs font-semibold text-[#10662A]"
          >
            <Phone className="size-3.5" />
            +91 79829 53129
          </a>
          <Link to="/auth" className="rd-btn-outline rounded-xl px-4 py-2 text-sm font-semibold transition-all">
            Login
          </Link>
          <Link to="/auth" className="rd-btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold transition-all">
            Open One
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 -mr-2 text-[#10662A]"
          aria-label="Menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[#d8ecdd] bg-white px-5 py-4 flex flex-col gap-1">
          <Link
            to="/auth"
            onClick={() => setOpen(false)}
            className="mt-3 py-2.5 text-center rounded-xl rd-btn-primary text-sm font-semibold"
          >
            Open One
          </Link>
        </div>
      )}
    </header>
  );
}
