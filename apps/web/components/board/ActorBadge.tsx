import { Robot } from "@phosphor-icons/react";
import type { ActorRef } from "./types";

// Humans get an initials dot; agents get a chip with a robot mark, so it's
// obvious at a glance whose hands a card is in. Chips follow Linear's rule:
// the chip itself is neutral (faint fill, hairline border, grey text) and
// colour lives only in the small icon.
export function ActorBadge({ actor, size = "sm" }: { actor: ActorRef; size?: "sm" | "md" }) {
  const isAgent = actor.type === "AGENT";
  const text = size === "sm" ? "text-[12px]" : "text-[12.5px]";
  if (isAgent) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-[#d0d6e0] ${size === "sm" ? "h-[22px]" : "h-6"} ${text}`}
        style={{
          padding: "0 8px 0 6px",
          borderRadius: 6,
          backgroundColor: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        title={`${actor.displayName} (AI agent)`}
      >
        <Robot size={13} weight="fill" className="shrink-0 text-accent" aria-hidden="true" />
        {actor.displayName}
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
    <span className={`inline-flex items-center gap-1.5 text-muted ${text}`} title={actor.displayName}>
      <span
        className="flex items-center justify-center bg-surface-2 text-[10px] text-fg"
        style={{ width: 20, height: 20, borderRadius: 999, border: "1px solid var(--color-line)" }}
      >
        {initials}
      </span>
      {size === "md" && actor.displayName}
    </span>
  );
}
