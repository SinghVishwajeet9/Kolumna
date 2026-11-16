"use client";

import { useEffect, useRef, useState } from "react";

// A heading that fades in letter by letter, left to right, out of a soft blur.
// While each letter is arriving it's tinted along a colour gradient; once it
// has settled it turns the heading's normal colour (white). So the colour is
// a wave sweeping across, not the resting look. Plays once, the first time it
// scrolls into view.
//
// Each letter gets its own colour, interpolated across the whole line, so the
// gradient survives the per-letter opacity animation (a single background-clip
// gradient on the parent can't fade letters individually). Words are kept
// whole so lines never break mid-word.

// Kolumna's palette: mint → sky → lavender (same family as the colour-run).
const DEFAULT_STOPS = ["#5af7b3", "#7dd3fc", "#c4b5fd"];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colourAt(stops: string[], t: number): string {
  if (stops.length === 1) return stops[0]!;
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const local = t * (stops.length - 1) - seg;
  const a = hexToRgb(stops[seg]!);
  const b = hexToRgb(stops[seg + 1]!);
  const mix = a.map((v, i) => Math.round(v + (b[i]! - v) * local));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export function RevealText({
  text,
  as: Tag = "h2",
  className,
  stops = DEFAULT_STOPS,
  finalColor = "var(--color-fg)",
  stagger = 28,
  duration = 900,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  /** Gradient colours, left to right, shown only while letters fade in. */
  stops?: string[];
  /** The colour every letter settles on. */
  finalColor?: string;
  /** ms between consecutive letters starting. */
  stagger?: number;
  /** ms each letter takes to settle. */
  duration?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      // Show at once: no animation for motion-sensitive users.
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const words = text.split(" ");
  const total = Math.max(1, text.replace(/ /g, "").length - 1);
  let index = 0;

  return (
    // Screen readers get the plain sentence; the per-letter spans are hidden.
    <Tag ref={ref as never} className={className} aria-label={text}>
      {words.map((word, w) => (
        // A real space BETWEEN word blocks, so long headings still wrap.
        <span key={w}>
        {w > 0 && " "}
        <span aria-hidden="true" className="inline-block whitespace-nowrap">
          {[...word].map((ch) => {
            const i = index++;
            return (
              <span
                key={i}
                className="inline-block"
                style={{
                  color: shown ? finalColor : colourAt(stops, i / total),
                  opacity: shown ? 1 : 0,
                  filter: shown ? "blur(0)" : "blur(10px)",
                  transform: shown ? "none" : "translateY(0.12em)",
                  // Each letter appears in its gradient colour; the colour
                  // only starts fading to white halfway through its entrance.
                  transition: [
                    `opacity ${duration}ms ease-out ${i * stagger}ms`,
                    `filter ${duration}ms ease-out ${i * stagger}ms`,
                    `transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * stagger}ms`,
                    `color ${duration * 1.2}ms ease-in-out ${i * stagger + duration * 0.5}ms`,
                  ].join(", "),
                  willChange: "opacity, filter, transform",
                }}
              >
                {ch}
              </span>
            );
          })}
        </span>
        </span>
      ))}
    </Tag>
  );
}
