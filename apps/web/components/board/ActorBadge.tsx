import type { ActorRef } from "./types";

// Humans get an initials dot; agents get a filled accent chip marked "AI" —
// the board must make it obvious at a glance whose hands a card is in.
export function ActorBadge({ actor, size = "sm" }: { actor: ActorRef; size?: "sm" | "md" }) {
  const isAgent = actor.type === "AGENT";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";
  if (isAgent) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 ${text}`}
        style={{
          borderRadius: "6px",
          backgroundColor: "rgba(90,247,179,0.12)",
          border: "1px solid rgba(90,247,179,0.35)",
          color: "#5af7b3",
          fontFamily: "var(--font-mono)",
        }}
        title={`${actor.displayName} (AI agent)`}
      >
        <span className="text-[10px] opacity-80">AI</span>
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
