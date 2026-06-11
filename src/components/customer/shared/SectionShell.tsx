import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function SectionShell({
  title,
  description,
  icon: Icon,
  completion,
  children,
  action,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  completion?: number;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-border bg-gradient-to-r from-secondary/40 to-transparent">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0">
            <Icon className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold">{title}</h2>
            {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {completion != null && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/10 text-accent">
              {completion}% complete
            </span>
          )}
          {action}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

