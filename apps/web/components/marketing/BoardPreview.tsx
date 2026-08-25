// A static mock of the real product. Column heights vary on purpose —
// that's the logo's alternating-bar rhythm showing up as actual UI.

type Card = { title: string; tag?: string; tagTone?: "accent" | "plain"; dragging?: boolean };
type Column = { title: string; cards: Card[] };

const columns: Column[] = [
  {
    title: "Backlog",
    cards: [
      { title: "Draft Q4 launch brief", tag: "Design" },
      { title: "Audit onboarding funnel" },
      { title: "Spike: offline mode", tag: "Research" },
    ],
  },
  {
    title: "In progress",
    cards: [
      { title: "Board drag + drop", tag: "AI split", tagTone: "accent", dragging: true },
      { title: "Workspace invites" },
    ],
  },
  {
    title: "Review",
    cards: [{ title: "Tenant isolation tests", tag: "Backend" }, { title: "Rank rebalancing" }],
  },
  {
    title: "Done",
    cards: [{ title: "Session auth" }],
  },
];

export function BoardPreview() {
  return (
    <div className="flex gap-3 select-none">
      {columns.map((column) => (
        <div key={column.title} className="w-[172px] shrink-0">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-muted">{column.title}</span>
            <span className="text-[12px] text-faint">{column.cards.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {column.cards.map((card) => (
              <div
                key={card.title}
                className={
                  card.dragging
                    ? "rotate-[-1.5deg] border border-accent/40 bg-surface-2 p-3 shadow-[0_16px_40px_-12px_rgba(90,247,179,0.25)]"
                    : "border border-line-soft bg-surface p-3"
                }
              >
                <p className="text-[13.5px] leading-snug text-fg/90">{card.title}</p>

                {card.tag && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <span
                      className={
                        card.tagTone === "accent"
                          ? "bg-accent/12 px-1.5 py-0.5 text-[11px] font-medium text-accent"
                          : "bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-muted"
                      }
                    >
                      {card.tag}
                    </span>
                    <span className="ml-auto h-4 w-4 rounded-full bg-white/10" />
                  </div>
                )}
              </div>
            ))}

            {/* Ghost slot showing where the dragged card would land */}
            {column.title === "In progress" && (
              <div className="h-[52px] border border-dashed border-accent/25 bg-accent/[0.04]" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
