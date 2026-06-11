import { useEffect, useRef } from "react";

type SaveFn<T> = (patch: Partial<T>) => Promise<{ error?: string | null }>;

/**
 * Queues partial patches per row id and flushes to Supabase after debounce.
 */
export function useDebouncedRowSave<T extends { id: string }>(saveFn: SaveFn<T>, delayMs = 650) {
  const queues = useRef(new Map<string, Partial<T>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saveFnRef = useRef(saveFn);

  useEffect(() => {
    saveFnRef.current = saveFn;
  }, [saveFn]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  const flush = (id: string) => {
    const patch = queues.current.get(id);
    queues.current.delete(id);
    timers.current.delete(id);
    if (!patch || Object.keys(patch).length === 0) return;
    void saveFnRef.current(patch);
  };

  const schedule = (id: string, patch: Partial<T>) => {
    const prev = queues.current.get(id) ?? {};
    queues.current.set(id, { ...prev, ...patch });
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(
      id,
      setTimeout(() => flush(id), delayMs),
    );
  };

  const flushNow = (id: string) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    flush(id);
  };

  return { schedule, flushNow };
}
