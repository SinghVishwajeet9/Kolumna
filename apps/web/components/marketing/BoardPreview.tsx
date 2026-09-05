// A static mock of the real product. Column heights vary on purpose —
// that's the logo's alternating-bar rhythm showing up as actual UI.

type Card = {
  title: string;
  color: string;
  tag?: string;
  tagTone?: "accent" | "plain";
  dragging?: boolean;
  spark?: boolean;
  avatar?: boolean;
};
type Column = { title: string; cards: Card[]; active?: boolean };

const columns: Column[] = [
  {
    title: "Backlog",
    cards: [
      { title: "Draft Q4 launch brief", color: "#5af7b3", tag: "Design", spark: true, avatar: true },
      { title: "Audit onboarding funnel", color: "#7dd3fc" },
      { title: "Spike: offline mode", color: "#c4b5fd", tag: "Research", spark: true, avatar: true },
    ],
  },
  {
    title: "In progress",
    active: true,
    cards: [
      {
        title: "Board drag + drop",
        color: "#fcd34d",
        tag: "AI split",
        tagTone: "accent",
        dragging: true,
        spark: true,
        avatar: true,
      },
      { title: "Workspace invites", color: "#86efac" },
    ],
  },
  {
    title: "Review",
    cards: [
      { title: "Tenant isolation tests", color: "#f9a8d4", tag: "Backend", spark: true, avatar: true },
      { title: "Rank rebalancing", color: "#67e8f9" },
    ],
  },
  { title: "Done", cards: [{ title: "Session auth", color: "#d9f99d" }] },
];

// Tiny activity graph. Decorative — it reads as "this card has history"
// without claiming any particular number.
function Sparkline({ dim = false }: { dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 14"
      className={`h-3.5 w-12 shrink-0 ${dim ? "text-accent/45" : "text-accent/75"}`}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M0 10 L6 8 L12 11 L18 5 L24 7 L30 3 L36 6 L42 2 L48 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BoardPreview() {
  return (
    <div className="flex select-none gap-3">
      {columns.map((column) => (
        // Narrower columns, taller cards — the panel is deliberately more
        // portrait than before, so width is the thing that gives.
        <div key={column.title} className="relative w-[143px] shrink-0">
          <div className="relative mb-3.5 flex items-center justify-between px-1">
            <span className="text-[14px] font-medium text-muted">{column.title}</span>
            <span className="text-[13px] text-faint">{column.cards.length}</span>
          </div>

          <div className="relative flex flex-col gap-3">
            {column.cards.map((card) => (
              <div
                key={card.title}
                className={card.dragging ? "rotate-[-1.5deg] border p-4" : "border p-4"}
                style={{
                  borderRadius: "10px",
                  // Border and fill tinted with the card's own colour (8-digit
                  // hex = colour + alpha), over the dark panel surface.
                  borderColor: card.dragging ? card.color : `${card.color}80`,
                  // Lit from above rather than a flat fill — the reference's
                  // cards are all subtly brighter along their top edge, which
                  // is what makes them look like physical panels.
                  backgroundImage:
                    "linear-gradient(to bottom, rgba(255,255,255,0.055), rgba(255,255,255,0) 60%)",
                  backgroundColor: `${card.color}12`,
                  boxShadow: "0 2px 10px -4px rgba(0,0,0,0.7)",
                }}
              >
                <p className="text-[14.5px] leading-snug text-fg/90">{card.title}</p>

                {(card.tag || card.spark || card.avatar) && (
                  <div className="mt-3.5 flex items-center gap-2">
                    {card.tag && (
                      <span
                        className={
                          card.tagTone === "accent"
                            ? "bg-accent/15 px-2 py-1 text-[12px] font-medium text-accent"
                            : "bg-white/[0.06] px-2 py-1 text-[12px] text-muted"
                        }
                        style={{ borderRadius: "5px" }}
                      >
                        {card.tag}
                      </span>
                    )}
                    {card.spark && <Sparkline dim={!card.dragging} />}
                    {card.avatar && (
                      <span className="ml-auto h-5 w-5 rounded-full bg-white/15" />
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Ghost slot showing where the dragged card would land */}
            {column.active && (
              <div
                className="h-[72px] border border-dashed border-accent/35 bg-accent/[0.05]"
                style={{ borderRadius: "10px" }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
