export function EmptyBlock({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border py-10 px-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint && <p className="text-xs text-muted-foreground/80 mt-1">{hint}</p>}
    </div>
  );
}
