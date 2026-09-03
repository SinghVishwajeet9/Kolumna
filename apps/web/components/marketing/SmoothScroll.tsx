"use client";

import { useEffect } from "react";
import Lenis from "lenis";

// Eased momentum scrolling for the landing page. Lenis moves the real scroll
// position (not a transform), so native scroll events still fire and the
// ScrollProgress bar keeps tracking. In-page anchor links (#how, #ai, …) are
// routed through Lenis so they glide instead of jumping. Disabled entirely
// for reduced-motion users, who get plain native scrolling.
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      duration: 1.1, // gentle, not floaty
      smoothWheel: true,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Route same-page anchor clicks through Lenis for a smooth glide.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest?.('a[href^="#"]');
      const href = link?.getAttribute("href");
      if (!href || href === "#") return;
      const el = document.querySelector(href);
      if (el) {
        e.preventDefault();
        lenis.scrollTo(el as HTMLElement);
      }
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
