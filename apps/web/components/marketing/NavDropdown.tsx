"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Item = { label: string; description?: string; href: string };

// Driven by state rather than CSS :hover, for three reasons: it works on
// touch (where :hover doesn't exist), it can close on Escape and on
// outside-click, and it can expose aria-expanded properly.
export function NavDropdown({ label, items }: { label: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative flex h-full items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        // Mouse users are already served by onMouseEnter/Leave on the
        // wrapper — letting click ALSO toggle would immediately close a
        // menu that hover just opened. So only touch/pen taps toggle here.
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        className={`flex items-center gap-1.5 text-[17px] text-fg transition-opacity ${
          open ? "opacity-100" : "hover:opacity-70"
        }`}
      >
        {label}
        <svg
          viewBox="0 0 10 6"
          className={`h-[5px] w-[9px] transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>

      {open && (
        // border-line-bright is deliberately brighter than every other
        // border on the page — it's what makes the panel read as floating
        // above the grid rather than sitting in it.
        // Same 2px pure-white rule as the navbar's bottom border, so the
        // panel reads as an extension of the nav rather than a separate
        // floating card. (Arbitrary value, not `border-white` — see Nav.tsx.)
        //
        // No entrance animation on purpose: a menu that fades in feels
        // laggy, and an element whose visibility depends on an animation
        // completing is invisible if that animation never runs.
        <div className="absolute left-0 top-full z-50 min-w-[240px] border-2 border-[#ffffff] bg-bg shadow-[0_28px_70px_-12px_rgba(0,0,0,0.85)]">
          <div className="flex flex-col py-2">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="block text-[15px] text-fg">{item.label}</span>
                {item.description && (
                  <span className="mt-0.5 block text-[13.5px] text-faint">
                    {item.description}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
