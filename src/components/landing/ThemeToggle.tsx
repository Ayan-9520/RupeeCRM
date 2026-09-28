import { useEffect } from "react";

/** RupeeDial One — light mode only (matches rupeedial.com) */
export function ThemeToggle({ className = "" }: { className?: string }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

  return null;
}
