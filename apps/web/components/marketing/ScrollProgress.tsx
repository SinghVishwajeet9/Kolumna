"use client";

import { useLayoutEffect, useRef } from "react";

// Replaces the native scrollbar with a thin green bar pinned to the right
// edge that fills top-to-bottom as you scroll — a page-scroll progress
// meter. It hides the native scrollbar (scoped to <html> via a class it
// toggles) so the two don't compete, which also means the page is always
// full-width: no scrollbar appearing/disappearing to shift centered content.
export function ScrollProgress() {
  const fillRef = useRef<HTMLDivElement>(null);

  // useLayoutEffect (not useEffect) so the native scrollbar is hidden before
  // the first paint — and, since this renders before LoadingScreen, before
  // the loader measures the hero, keeping every layout stage the same width.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add("kolumna-hide-scrollbar");

    let raf = 0;
    const update = () => {
      raf = 0;
      const max = root.scrollHeight - root.clientHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${p})`;
    };
    // Coalesce scroll events onto one rAF — the transform is the only work.
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      root.classList.remove("kolumna-hide-scrollbar");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed"
      style={{
        top: 0,
        right: 0,
        bottom: 0,
        width: "5px",
        zIndex: 9998, // below the loading overlay (9999)
        background: "rgba(255,255,255,0.05)",
      }}
    >
      <div
        ref={fillRef}
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "top",
          transform: "scaleY(0)",
          background: "var(--color-accent)",
          boxShadow: "0 0 12px rgba(90,247,179,0.55)",
          transition: "transform 90ms linear",
        }}
      />
    </div>
  );
}
