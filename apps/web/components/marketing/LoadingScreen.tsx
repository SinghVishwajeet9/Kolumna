"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Intro overlay. Sequence (~5.8s, every visit):
//   1. "LOADING" types out char-by-char (caps, Departure Mono, blinking caret).
//   2. Product vocabulary fades in across the whole screen one by one — big,
//      varied sizes, white, slow and smooth.
//   3. Only near the END does "chaos" appear, already sitting in the hero's
//      real position (green).
//   4. The scattered words fade out; "chaos" stays put.
//   5. The overlay fades away, revealing the site, which cross-fades with our
//      copy of "chaos" so the word looks like it was there all along.
//
// The seam-free hand-off relies on measuring the hero's own #hero-chaos and
// dropping our copy onto the exact same coordinates.

type Phase = "loading" | "scatter" | "chaos" | "fadeWords" | "reveal" | "done";

const LABEL = "LOADING";
const TYPE_SPEED = 150; // ms per character

// Timeline (ms from mount). Deliberately unhurried.
const T_SCATTER = 1500;
const T_CHAOS = 3600; // chaos shows up toward the end, not the start
const T_FADE_WORDS = 4600;
const T_REVEAL = 5300;
const REVEAL_MS = 950; // fade of the overlay = fade-in of the hero — quick + smooth
const T_DONE = T_REVEAL + REVEAL_MS + 200;

const WORD_STAGGER = 130; // between each scattered word appearing

// All board/product vocabulary — the intro previews what the site is about.
// Positions and sizes are hand-placed (not random) so server and client
// render the same thing and hydration stays happy. size = rem at desktop.
const SCATTER: {
  text: string;
  x: number;
  y: number;
  size: number;
  color?: string;
}[] = [
  { text: "sprints", x: 18, y: 20, size: 2.4 },
  { text: "backlog", x: 76, y: 15, size: 1.5 },
  { text: "roadmap", x: 32, y: 72, size: 2.0 },
  { text: "columns", x: 64, y: 78, size: 1.7 },
  { text: "drag", x: 22, y: 44, size: 2.8 },
  { text: "drop", x: 85, y: 48, size: 1.4 },
  { text: "boards", x: 12, y: 64, size: 2.1 },
  { text: "cards", x: 88, y: 32, size: 1.5 },
  { text: "epics", x: 46, y: 12, size: 2.5 },
  { text: "workspace", x: 26, y: 33, size: 1.6 },
  { text: "review", x: 15, y: 84, size: 1.5 },
  { text: "ship it", x: 80, y: 85, size: 2.2 },
  { text: "tenants", x: 52, y: 89, size: 1.7 },
  { text: "rank", x: 74, y: 64, size: 2.4 },
  { text: "sync", x: 62, y: 50, size: 1.9 },
  // Brand name, treated as just another scattered word — but pure white so
  // it reads as the label among the vocabulary. Comes before chaos (which
  // still lands last, in its hero spot).
  { text: "kolumna", x: 42, y: 56, size: 2.6, color: "#ffffff" },
];

// Responsive: full size on desktop, scaled down on narrow screens.
const sz = (s: number) =>
  `clamp(${(s * 0.5).toFixed(2)}rem, ${(s * 1.7).toFixed(1)}vw, ${s}rem)`;

type ChaosBox = {
  left: number;
  top: number;
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
};

export function LoadingScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [typed, setTyped] = useState(0);
  const [box, setBox] = useState<ChaosBox | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevBody = useRef<{ overflow: string; paddingRight: string } | null>(null);

  const restoreBody = () => {
    const prev = prevBody.current;
    if (!prev) return;
    document.body.style.overflow = prev.overflow;
    document.body.style.paddingRight = prev.paddingRight;
  };

  useLayoutEffect(() => {
    // Motion-sensitive users skip the whole thing — useLayoutEffect runs
    // before paint, so the overlay is never actually shown to them.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setPhase("done");
      return;
    }

    // Lock scroll BEFORE measuring. Hiding overflow removes the vertical
    // scrollbar, which would widen the page and shift the centered hero
    // right by ~half the scrollbar width. Reserve that width as padding so
    // nothing moves — otherwise our measured clone ends up offset from where
    // the real "chaos" sits during the reveal.
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    prevBody.current = {
      overflow: document.body.style.overflow,
      paddingRight: document.body.style.paddingRight,
    };
    document.body.style.overflow = "hidden";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;

    // Now measure the hero's real "chaos" and copy its exact box, so our
    // overlay copy lands right on top of it for the cross-fade.
    const target = document.getElementById("hero-chaos");
    if (target) {
      const r = target.getBoundingClientRect();
      const cs = getComputedStyle(target);
      setBox({
        left: r.left,
        top: r.top,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        fontWeight: cs.fontWeight,
        letterSpacing: cs.letterSpacing,
      });
    }

    // Typewriter for LOADING.
    const typer = setInterval(() => {
      setTyped((n) => {
        if (n >= LABEL.length) {
          clearInterval(typer);
          return n;
        }
        return n + 1;
      });
    }, TYPE_SPEED);

    const at = (ms: number, p: Phase) =>
      timers.current.push(setTimeout(() => setPhase(p), ms));
    at(T_SCATTER, "scatter");
    at(T_CHAOS, "chaos");
    at(T_FADE_WORDS, "fadeWords");
    at(T_REVEAL, "reveal");
    at(T_DONE, "done");

    const running = timers.current;
    return () => {
      clearInterval(typer);
      running.forEach(clearTimeout);
      restoreBody();
    };
  }, []);

  // This component never unmounts (it renders null when finished), so the
  // effect cleanup above won't fire on completion — restore scroll here the
  // moment the intro is done.
  useEffect(() => {
    if (phase === "done") restoreBody();
  }, [phase]);

  if (phase === "done") return null;

  const wordsVisible = phase === "scatter" || phase === "chaos";
  const chaosVisible =
    phase === "chaos" || phase === "fadeWords" || phase === "reveal";
  const revealing = phase === "reveal";

  const smooth = "cubic-bezier(0.16, 1, 0.3, 1)";

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{
        backgroundColor: "#0d0d0d",
        fontFamily: "var(--font-mono)",
        opacity: revealing ? 0 : 1,
        // ease-in-out (not the snappy ease-out used elsewhere) so the fade
        // is evenly gradual rather than front-loaded — reads as genuinely slow.
        transition: `opacity ${REVEAL_MS}ms ease-in-out`,
        pointerEvents: revealing ? "none" : "auto",
      }}
    >
      {/* "LOADING" — typed out char by char with a blinking block caret */}
      <span
        className="absolute left-1/2 top-1/2 flex items-center"
        style={{
          transform: "translate(-50%, -50%)",
          color: "var(--color-muted)",
          fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
          letterSpacing: "0.12em",
          whiteSpace: "pre",
          opacity: phase === "loading" ? 1 : 0,
          transition: `opacity 450ms ${smooth}`,
        }}
      >
        {LABEL.slice(0, typed)}
        <span
          className="animate-pulse"
          style={{
            display: "inline-block",
            width: "0.5em",
            height: "1em",
            marginLeft: "0.12em",
            background: "var(--color-muted)",
            verticalAlign: "-0.1em",
          }}
        />
      </span>

      {/* Product vocabulary scattered everywhere — big, varied, white,
          fading in one by one, slow and smooth */}
      {SCATTER.map((w, i) => (
        <span
          key={w.text}
          className="absolute"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            color: w.color ?? "rgba(255,255,255,0.85)",
            fontSize: sz(w.size),
            whiteSpace: "nowrap",
            opacity: wordsVisible ? 1 : 0,
            transform: wordsVisible
              ? "translate(-50%, -50%) scale(1)"
              : "translate(-50%, -50%) scale(0.9)",
            transition: `opacity 600ms ${smooth} ${
              wordsVisible ? i * WORD_STAGGER : 0
            }ms, transform 600ms ${smooth} ${wordsVisible ? i * WORD_STAGGER : 0}ms`,
          }}
        >
          {w.text}
        </span>
      ))}

      {/* The word that stays — positioned exactly over the hero's own
          "chaos". Falls back to center if the measurement ever fails. */}
      {box ? (
        <span
          className="absolute"
          style={{
            left: box.left,
            top: box.top,
            color: "var(--color-accent)",
            fontSize: box.fontSize,
            lineHeight: box.lineHeight,
            fontWeight: box.fontWeight,
            letterSpacing: box.letterSpacing,
            opacity: chaosVisible ? 1 : 0,
            transition: `opacity 500ms ${smooth}`,
          }}
        >
          chaos
        </span>
      ) : (
        <span
          className="absolute left-1/2"
          style={{
            top: "40%",
            transform: "translate(-50%, -50%)",
            color: "var(--color-accent)",
            fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
            opacity: chaosVisible ? 1 : 0,
            transition: `opacity 500ms ${smooth}`,
          }}
        >
          chaos
        </span>
      )}
    </div>
  );
}
