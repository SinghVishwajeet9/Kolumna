import { Robot } from "@phosphor-icons/react";
import type { ActorRef } from "./types";

// The compact assignee marker for card faces. Agents are told apart by a
// robot glyph rather than colour, so the board stays quiet; the full name is
// in the tooltip.
export function Avatar({ actor }: { actor: ActorRef | null }) {
  // leading-none + a block-level icon: an inline SVG (or text) keeps room for
  // descenders below it, which pushes it off the circle's centre.
  const base = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] leading-none";
  if (!actor) {
    return (
      <span className={`${base} border border-dashed border-line-bright text-faint`} title="Unassigned" />
    );
  }
  if (actor.type === "AGENT") {
    return (
      <span className={`${base} border border-line-bright bg-surface text-fg`} title={`${actor.displayName} (AI agent)`}>
        <Robot size={13} weight="fill" className="block" />
      </span>
    );
  }
  const initials = actor.displayName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className={`${base} border border-line-bright bg-[#3a3a3d] text-fg`} title={actor.displayName}>
      {initials}
    </span>
  );
}
