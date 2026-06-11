import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RepeatableBlock({
  title,
  index,
  onRemove,
  children,
  defaultOpen = true,
}: {
  title: string;
  index: number;
  onRemove: () => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border">
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-semibold min-w-0"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
          <span className="truncate">
            {title} #{index + 1}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-destructive hover:text-destructive h-8 shrink-0"
        >
          <Trash2 className="size-3.5 mr-1" /> Remove
        </Button>
      </div>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
}
