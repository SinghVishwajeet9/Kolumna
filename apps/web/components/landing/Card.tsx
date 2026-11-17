"use client";

// The landing page's feature card (design: apps/web/DESIGN-CARDS.md).
// One surface, one header, one scene. Modelled on the agent cards on
// linear.app: a dark panel with a hairline border, a soft shadow, a second
// hairline that only shows near the pointer, and content that fades out at
// the bottom instead of ending at a hard edge.
//
// The scene inside plays once, the first time the card is 35% in view:
// children with `lc-in` fade up in order of their --d delay (globals.css,
// "Landing cards"). With reduced motion they're simply there.

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const Played = createContext(false);
/** Whether this card's scene has started, for scenes with their own timeline (a status that changes). */
export const usePlayed = () => useContext(Played);

/** Inline style for an item's entry delay, in milliseconds. */
export const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function LandingCard({
  icon,
  name,
  chip,
  variant = "chat",
  children,
}: {
  /** A small mark before the name: an icon, or a dot. */
  icon?: ReactNode;
  name: string;
  /** Short neutral text after the name, e.g. "acts with approval". */
  chip?: ReactNode;
  /** "chat": Linear's agent-card look. "panel": a textured property sheet that fades out. */
  variant?: "chat" | "panel";
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setPlayed(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The highlight follows the pointer. Written straight to the element so a
  // moving pointer never re-renders the card.
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      data-played={played}
      onPointerMove={track}
      className={`lcard app-ui relative flex h-[300px] flex-col overflow-hidden md:h-[316px] ${variant === "panel" ? "lcard-panel" : ""}`}
    >
      {/* As measured on linear.app: 14px 14px 14px 20px padding, a 16px round avatar
          with a hairline ring, the name at 13px/500 in the secondary grey. */}
      <header className="relative z-[1] flex shrink-0 items-center gap-2 py-3.5 pl-5 pr-3.5 text-[13px] leading-5">
        {icon && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center text-[#d0d6e0]"
            style={{ borderRadius: 999, backgroundColor: "#0f1011", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.14)" }}
          >
            {icon}
          </span>
        )}
        <span className="truncate font-medium text-[#d0d6e0]">{name}</span>
        {chip && (
          <span
            className="truncate px-1.5 text-[12px] leading-[18px] text-[#8a8f98]"
            style={{ borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {chip}
          </span>
        )}
        {/* Window controls, as in an app window. Decoration only. */}
        <span aria-hidden="true" className="ml-auto flex shrink-0 items-center gap-2.5 text-[#8a8f98] opacity-60">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6 2h2v2M4 8H2V6M8 2 5.5 4.5M2 8l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="m2.5 2.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </span>
      </header>
      {/* The scene. Its bottom 30% fades into the card. */}
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col px-3.5 pb-4 text-[13px] leading-5 text-[#f7f8f8]"
        style={{
          // The panel look fades sooner, so the sheet dissolves into the card.
          maskImage: `linear-gradient(to bottom, black ${variant === "panel" ? 75 : 70}%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, black ${variant === "panel" ? 75 : 70}%, transparent 100%)`,
        }}
      >
        <Played.Provider value={played}>{children}</Played.Provider>
      </div>
    </div>
  );
}

// --- Pieces scenes are built from ------------------------------------------------

/** What was asked: a slightly lighter block. */
export function Bubble({ children, d = 0, className = "" }: { children: ReactNode; d?: number; className?: string }) {
  return (
    <div
      className={`lc-in p-2.5 text-[13px] leading-5 text-[#f7f8f8] ${className}`}
      style={{
        ...at(d),
        borderRadius: 8,
        background: "linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04)), #0f1011",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

/**
 * What is happening. Shows `before` (with pulsing dots) until `after` ms after
 * the scene starts, then swaps to `done`. Without `done` it's a plain line.
 */
export function Status({
  before,
  done,
  d = 0,
  after = 1400,
  icon,
}: {
  before: ReactNode;
  done?: ReactNode;
  d?: number;
  after?: number;
  icon?: ReactNode;
}) {
  const played = usePlayed();
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!played || !done) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setFinished(true));
      return;
    }
    const t = setTimeout(() => setFinished(true), after);
    return () => clearTimeout(t);
  }, [played, done, after]);

  const showDone = Boolean(done) && finished;
  return (
    <div className="lc-in relative flex h-5 items-center gap-1.5 text-[13px] text-[#8a8f98]" style={at(d)}>
      {icon}
      <span className="relative block min-w-0 flex-1">
        <span className={`lc-swap block truncate ${showDone ? "lc-out" : ""}`}>
          {before}
          {done && <span className="lc-dots" aria-hidden="true" />}
        </span>
        {done && <span className={`lc-swap absolute inset-0 block truncate ${showDone ? "" : "lc-under"}`}>{done}</span>}
      </span>
    </div>
  );
}

/** A list row inside a card: one line, separated from the next by a hairline. */
export function Row({ children, d = 0, faint = false }: { children: ReactNode; d?: number; faint?: boolean }) {
  return (
    <div
      className={`lc-in flex h-9 items-center gap-2.5 border-t border-white/[0.06] px-2.5 text-[13px] first:border-t-0 ${
        faint ? "text-[#8a8f98]" : "text-[#f7f8f8]"
      }`}
      style={at(d)}
    >
      {children}
    </div>
  );
}

/** A group of rows: the only box allowed inside a card (a 4% fill, no border). */
export function Rows({ children, d = 0 }: { children: ReactNode; d?: number }) {
  return (
    <div className="lc-in overflow-hidden" style={{ ...at(d), borderRadius: 8, backgroundColor: "rgba(255,255,255,0.03)" }}>
      {children}
    </div>
  );
}

// --- Linear's agent-card pieces: a short conversation -------------------------------
// Colours are Linear's text ramp: primary #f7f8f8, secondary #d0d6e0,
// tertiary #8a8f98, quaternary #62666d.

/** What was asked: a bubble on the right, as a message you sent. */
export function Prompt({ children, d = 0 }: { children: ReactNode; d?: number }) {
  return (
    <div className="lc-in pl-10" style={at(d)}>
      <p
        className="p-2.5 text-[13px] leading-5 tracking-[-0.003em] text-[#f7f8f8]"
        style={{ borderRadius: 8, background: "linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04)), #0f1011", boxShadow: "0 0 0 1px rgba(0,0,0,0.2)" }}
      >
        {children}
      </p>
    </div>
  );
}

/** "KOL-14 added to context", right-aligned under the prompt. */
export function Context({ id, note, icon, d = 0 }: { id: string; note: string; icon?: ReactNode; d?: number }) {
  return (
    <div className="lc-in mt-2 flex items-center justify-end gap-1.5 pr-2.5 text-[12px] leading-[14px]" style={at(d)}>
      {icon}
      <span className="tabular-nums text-[#8a8f98]">{id}</span>
      <span className="text-[#62666d]">{note}</span>
    </div>
  );
}

/** "Thinking… ▸", shimmering, then "Worked for N sec ▸" once the scene has run. */
export function Thinking({ done, d = 0, after = 1500 }: { done: string; d?: number; after?: number }) {
  const played = usePlayed();
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!played) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setFinished(true));
      return;
    }
    const t = setTimeout(() => setFinished(true), after);
    return () => clearTimeout(t);
  }, [played, after]);
  return (
    <div className="lc-in mt-3 flex h-8 items-center gap-1.5 text-[13px] text-[#62666d]" style={at(d)}>
      <span className={finished ? "" : "lc-shimmer"}>{finished ? done : "Thinking…"}</span>
      <svg width="6" height="8" viewBox="0 0 6 8" aria-hidden="true">
        <path d="M1 1l4 3-4 3z" fill="currentColor" />
      </svg>
    </div>
  );
}

/** The agent's reply: secondary-grey text, which can hold <Issue /> pills. */
export function Reply({ children, d = 0 }: { children: ReactNode; d?: number }) {
  return (
    <p className="lc-in text-[13px] leading-[22px] text-[#d0d6e0]" style={at(d)}>
      {children}
    </p>
  );
}

/** An issue mentioned inline: status icon, key, title, on a faint chip. */
export function Issue({ id, title, status }: { id: string; title: string; status: ReactNode }) {
  return (
    <span
      className="mx-0.5 inline-flex h-[22px] items-center gap-1.5 px-1.5 align-middle text-[13px]"
      style={{ borderRadius: 5, backgroundColor: "rgba(255,255,255,0.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)" }}
    >
      {status}
      <span className="font-mono text-[12px] text-[#8a8f98]">{id}</span>
      <span className="text-[#f7f8f8]">{title}</span>
    </span>
  );
}

/** Linear's working indicator: a 3x3 grid of dots pulsing in a diagonal wave. */
export function DotGrid() {
  return (
    <span aria-hidden="true" className="grid shrink-0 grid-cols-3 gap-[2px]">
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className="lc-dot block h-[3px] w-[3px] rounded-full bg-[#8a8f98]"
          style={{ animationDelay: `${((i % 3) + Math.floor(i / 3)) * 0.14}s` }}
        />
      ))}
    </span>
  );
}

/** A running task: the dot grid, what's happening, and a timer that counts up while it plays. */
export function Task({ label, d = 0, from = 0 }: { label: string; d?: number; from?: number }) {
  const played = usePlayed();
  const [secs, setSecs] = useState(from);
  useEffect(() => {
    if (!played) return;
    const start = Date.now();
    const t = setInterval(() => {
      const n = from + Math.floor((Date.now() - start) / 1000);
      setSecs(Math.min(n, 59));
      if (n >= 59) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [played, from]);
  return (
    <div
      className="lc-in mt-3 flex h-11 items-center gap-3 px-3 text-[13px]"
      style={{ ...at(d), borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <DotGrid />
      <span className="min-w-0 flex-1 truncate text-[#8a8f98]">{label}</span>
      <span className="tabular-nums text-[#8a8f98]">00:{String(secs).padStart(2, "0")}</span>
    </div>
  );
}

// --- The "panel" look: a property sheet --------------------------------------------
// Small grey section labels, clean icon-and-text rows under each, every row a
// little dimmer than the one above, the whole sheet fading out at the bottom.

/** A section: a small grey label, then its rows. */
export function Section({ label, d = 0, children }: { label: string; d?: number; children: ReactNode }) {
  return (
    <div className="lc-in mt-5 first:mt-1" style={at(d)}>
      <p className="mb-2 text-[12.5px] text-[#62666d]">{label}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

/** One row: an icon, the text, and something on the right. `tone` dims it: 0 bright to 2 faint. */
export function Item({
  icon,
  children,
  right,
  tone = 1,
}: {
  icon?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  tone?: 0 | 1 | 2;
}) {
  const color = ["#f7f8f8", "#d0d6e0", "#8a8f98"][tone];
  return (
    <div className="flex min-h-[22px] items-center gap-2.5 text-[14px] leading-[22px]" style={{ color }}>
      {icon && <span className="flex w-4 shrink-0 items-center justify-center">{icon}</span>}
      <span className="min-w-0 truncate">{children}</span>
      {right && <span className="ml-auto shrink-0">{right}</span>}
    </div>
  );
}

/** A small neutral tag on the right of a row, like Linear's "Current". */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="px-2 text-[12px] leading-[20px] text-[#8a8f98]" style={{ borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)" }}>
      {children}
    </span>
  );
}
