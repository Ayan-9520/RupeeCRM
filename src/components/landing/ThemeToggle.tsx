import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`relative size-9 rounded-full border border-border bg-card hover:bg-secondary transition-smooth grid place-items-center ${className}`}
    >
      <Sun className={`size-4 text-[var(--wa-green)] transition-all ${dark ? "scale-0 opacity-0" : "scale-100 opacity-100"}`} />
      <Moon className={`size-4 text-[var(--wa-green)] absolute transition-all ${dark ? "scale-100 opacity-100" : "scale-0 opacity-0"}`} />
    </button>
  );
}
