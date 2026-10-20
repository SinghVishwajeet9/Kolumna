"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";

// A themed replacement for <select>: the native dropdown is drawn by the OS
// (bright blue highlight, system font) and can't be styled to match.
export type SelectOption = {
  value: string | null;
  label: string;
  icon?: React.ReactNode;
  note?: string;
  disabled?: boolean;
};

export function Select({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  compact?: boolean; // smaller trigger for the card panel's field grid
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0]!;

  // Close on any click outside the control.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  function choose(o: SelectOption) {
    if (o.disabled) return;
    setOpen(false);
    if (o.value !== value) onChange(o.value);
  }

  function step(from: number, dir: 1 | -1) {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i]!.disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setHighlight(Math.max(0, options.indexOf(current)));
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation(); // don't also close the card panel
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => step(h, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => step(h, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(options[highlight]!);
    }
  }

  return (
    <div ref={rootRef} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setHighlight(Math.max(0, options.indexOf(current)));
          setOpen((o) => !o);
        }}
        className={`flex w-full items-center gap-2.5 bg-surface-2 text-left text-fg transition-shadow ${
          compact ? "px-2.5 py-1.5 text-[13px]" : "px-3 py-2 text-[14px]"
        } ${
          open
            ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]"
            : "shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
        }`}
        style={{ borderRadius: 8 }}
      >
        {current.icon}
        <span className={`truncate ${current.value === null ? "text-faint" : ""}`}>{current.label}</span>
        <CaretDown size={14} className={`ml-auto shrink-0 text-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="animate-rise absolute top-[calc(100%+6px)] right-0 left-0 z-10 max-h-64 min-w-[180px] overflow-y-auto bg-[#1c1c1e] p-1 shadow-[inset_0_0_0_1px_var(--color-line),0_16px_40px_-12px_rgba(0,0,0,0.9)]"
          style={{ borderRadius: 10 }}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value ?? "none"}
                role="option"
                aria-selected={selected}
                aria-disabled={o.disabled}
                onMouseEnter={() => !o.disabled && setHighlight(i)}
                onClick={() => choose(o)}
                className={`flex items-center gap-2.5 px-2.5 py-2 text-[14px] ${
                  o.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                } ${i === highlight && !o.disabled ? "bg-white/[0.06]" : ""}`}
                style={{ borderRadius: 7 }}
              >
                {o.icon}
                <span className={`truncate ${o.value === null ? "text-faint" : "text-fg"}`}>{o.label}</span>
                {o.note && <span className="shrink-0 text-[12px] text-faint">· {o.note}</span>}
                {selected && <Check size={14} weight="bold" className="ml-auto shrink-0 text-fg" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
