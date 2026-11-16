// Small pieces shared by the board, the card panel and the backlog: the
// priority glyph, story-point chip, epic chip and card key.

import { CaretDoubleUp, CaretUp, CaretDown, Equals, Minus } from "@phosphor-icons/react";
import type { EpicRef, Priority } from "./types";

const mono = { fontFamily: "var(--font-mono)" };

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  URGENT: { label: "Urgent", color: "#f87171" },
  HIGH: { label: "High", color: "#fb923c" },
  MEDIUM: { label: "Medium", color: "#fcd34d" },
  LOW: { label: "Low", color: "#7dd3fc" },
  NONE: { label: "No priority", color: "#6b6b6b" },
};

export function PriorityIcon({ priority, size = 14 }: { priority: Priority; size?: number }) {
  const { color, label } = PRIORITY_META[priority];
  const Glyph = { URGENT: CaretDoubleUp, HIGH: CaretUp, MEDIUM: Equals, LOW: CaretDown, NONE: Minus }[priority];
  return (
    <span title={label} className="flex shrink-0 items-center" style={{ color }}>
      <Glyph size={size} weight="bold" className="block" />
    </span>
  );
}

export function CardKey({ boardKey, number }: { boardKey: string; number: number }) {
  return (
    <span className="shrink-0 text-[12px] text-faint" style={mono}>
      {boardKey}-{number}
    </span>
  );
}

export function PointsChip({ points }: { points: number | null }) {
  if (points === null) return null;
  return (
    <span
      title={`${points} story points`}
      className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center bg-white/[0.08] px-1.5 text-[11px] leading-none text-muted"
      style={{ borderRadius: 999, ...mono }}
    >
      {points}
    </span>
  );
}

export function EpicChip({ epic }: { epic: EpicRef | null }) {
  if (!epic) return null;
  return (
    // Linear-style label: a neutral outlined pill; the epic's colour is only the dot.
    <span
      title={`Epic: ${epic.title}`}
      className="inline-flex h-[20px] max-w-[150px] items-center gap-1.5 text-[11.5px] text-[#d0d6e0]"
      style={{ padding: "0 8px 0 7px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.09)" }}
    >
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: epic.color }} />
      <span className="truncate">{epic.title}</span>
    </span>
  );
}
