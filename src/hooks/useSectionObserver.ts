import { useEffect, useState, type RefObject } from "react";

/** Highlights nav item for whichever section is most visible in the scroll container. */
export function useSectionObserver(
  sectionIds: string[],
  refs: RefObject<Record<string, HTMLElement | null>>,
  scrollRoot?: RefObject<HTMLElement | null>,
) {
  const [active, setActive] = useState(sectionIds[0] ?? "");

  useEffect(() => {
    const root = scrollRoot?.current ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));
        if (visible[0]?.target.id) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );
    for (const id of sectionIds) {
      const el = refs.current?.[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sectionIds, refs, scrollRoot]);

  return active;
}
