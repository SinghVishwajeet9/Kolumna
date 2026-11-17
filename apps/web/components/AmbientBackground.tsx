"use client";

// ASCII creatures drifting behind a page (boards list, board). Decorative: the
// page's content sits above it, and clicking an empty spot startles the ones
// nearby.
//   <AmbientBackground />  the canvas, placed first inside a `relative` page
//   <AmbientPicker />      a labelled control for the page header: pick a
//                          creature or turn the background off
// The choice is shared between the two and remembered in this browser.
// Engine: components/ascii (vendored from DesignerStephen1/ascii-animals, MIT).

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import { AsciiAnimals } from "@/components/ascii/react";
import { ANIMALS, ANIMAL_KEYS, type AnimalKey } from "@/components/ascii/animals";

const KEY = "kolumna:ambient";
const EVENT = "kolumna:ambient-change";
type Choice = AnimalKey | "off";
const DEFAULT: Choice = "koi";

function read(): Choice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "off" || (v && (ANIMAL_KEYS as string[]).includes(v))) return v as Choice;
  } catch {}
  return DEFAULT;
}
function write(next: Choice) {
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
/** The saved choice; null on the server and for the first paint, so nothing flashes. */
function useChoice(): Choice | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

const rgb = (c: readonly number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export function AmbientBackground({
  strength = "normal",
}: {
  /** "soft" for pages with a lot on top (a board full of cards). */
  strength?: "normal" | "soft";
}) {
  const choice = useChoice();
  if (!choice || choice === "off") return null;
  return (
    <div
      aria-hidden="true"
      className={`animate-fade absolute inset-0 z-0 overflow-hidden ${strength === "soft" ? "opacity-[0.4]" : "opacity-[0.7]"}`}
      style={{
        // The canvas takes its glyph font from here. A real monospace, not the app's --font-mono (Satoshi).
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        // Fade the top, where the page heading sits, so text always reads.
        maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0, black 240px)",
        WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0, black 240px)",
      }}
    >
      {/* key: a fresh canvas per creature, so each starts with its own defaults */}
      <AsciiAnimals key={choice} animal={choice} theme="dark" className="sticky top-0 block h-screen w-full" />
    </div>
  );
}

export function AmbientPicker({ className = "" }: { className?: string }) {
  const choice = useChoice();
  const [open, setOpen] = useState(false);
  // Which side the menu opens to: under the button's right edge, unless that
  // would push it off the left of the screen (phones), then its left edge.
  const [alignLeft, setAlignLeft] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = () => {
    const r = root.current?.getBoundingClientRect();
    if (r) setAlignLeft(r.right < 200);
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  const label = !choice ? "Background" : choice === "off" ? "Off" : ANIMALS[choice].label;
  const pick = (next: Choice) => {
    write(next);
    setOpen(false);
  };
  const row = (active: boolean) =>
    `flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-white/[0.06] ${
      active ? "text-fg" : "text-muted"
    }`;

  return (
    <div ref={root} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Change or turn off the background animation"
        className="glass pressable flex h-9 items-center gap-2 px-3 text-[13px] text-muted hover:text-fg"
        style={{ borderRadius: 9 }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={
            choice && choice !== "off"
              ? { background: rgb(ANIMALS[choice].swatch) }
              : { border: "1px solid rgba(255,255,255,0.35)" }
          }
        />
        <span className="text-faint max-sm:hidden">Background</span>
        <span className="text-fg">{label}</span>
        <CaretDown size={11} className={`text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul
          role="menu"
          aria-label="Background animation"
          className={`animate-in absolute top-[calc(100%+6px)] z-30 min-w-[180px] ${alignLeft ? "left-0" : "right-0"} bg-[#1c1c1e] p-1 shadow-[inset_0_0_0_1px_var(--color-line),0_16px_40px_-12px_rgba(0,0,0,0.9)]`}
          style={{ borderRadius: 10 }}
        >
          {ANIMAL_KEYS.map((k) => (
            <li key={k} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={choice === k}
                onClick={() => pick(k)}
                className={row(choice === k)}
                style={{ borderRadius: 7 }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: rgb(ANIMALS[k].swatch) }} />
                {ANIMALS[k].label}
                {choice === k && <Check size={13} className="ml-auto" />}
              </button>
            </li>
          ))}
          <li role="none" className="mt-1 border-t border-line pt-1">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={choice === "off"}
              onClick={() => pick("off")}
              className={row(choice === "off")}
              style={{ borderRadius: 7 }}
            >
              <span className="h-2 w-2 rounded-full border border-white/30" />
              Turn off
              {choice === "off" && <Check size={13} className="ml-auto" />}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
