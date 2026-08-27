// Render's "zero ops" section: a headline, then a two-column split where the
// left side is one long sentence whose nouns are each a different colour and
// fade out at the bottom (implying "…and plenty more"), and the right side is
// a single feature with a visual.
//
// The palette below stays deliberately close to the brand mint — it drifts
// through teal/sky/lime/lavender rather than going full rainbow, so it still
// reads as one family instead of confetti.

const things = [
  { label: "product roadmaps", color: "text-[#5af7b3]" },
  { label: "sprint backlogs", color: "text-[#7dd3fc]" },
  { label: "bug queues", color: "text-[#c4b5fd]" },
  { label: "design reviews", color: "text-[#fcd34d]" },
  { label: "launch checklists", color: "text-[#86efac]" },
  { label: "content calendars", color: "text-[#f9a8d4]" },
  { label: "hiring pipelines", color: "text-[#67e8f9]" },
  { label: "OKRs", color: "text-[#d9f99d]" },
  { label: "incident logs", color: "text-[#fca5a5]" },
  { label: "research notes", color: "text-[#a5b4fc]" },
  { label: "onboarding plans", color: "text-[#5eead4]" },
  { label: "retros", color: "text-[#e9d5ff]" },
];

export function Breadth() {
  return (
    <section className="bg-bg">
      <div className="px-6 py-24 md:px-10 lg:py-32">
        <h2 className="mb-16 max-w-[18ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Every kind of work with <span className="text-accent">zero ceremony</span>
        </h2>

        <div className="grid border border-line-soft md:grid-cols-2">
          {/* Left: the colour-run */}
          <div className="border-b border-line-soft p-8 md:border-b-0 md:border-r md:p-12">
            <div
              className="max-h-[340px] overflow-hidden text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.35] tracking-[-0.02em]"
              style={{
                maskImage:
                  "linear-gradient(to bottom, black 62%, transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black 62%, transparent 100%)",
              }}
            >
              <span className="text-fg">One board, properly structured, for </span>
              {things.map((thing, i) => (
                <span key={thing.label} className={thing.color}>
                  {thing.label}
                  {i < things.length - 1 && <span className="text-fg">, </span>}
                </span>
              ))}
            </div>
          </div>

          {/* Right: one feature, with a visual.
              overflow-hidden because the grid backdrop below bleeds 40px
              past the card on every side — without clipping here that bleed
              escapes the panel on narrow screens and gives the whole page a
              horizontal scrollbar. */}
          <div className="overflow-hidden p-8 md:p-12">
            <h3 className="mb-4 max-w-[18ch] text-[clamp(1.5rem,2.6vw,2rem)] font-medium leading-[1.15] tracking-[-0.02em]">
              Live on every screen watching the board
            </h3>
            <p className="mb-6 max-w-[44ch] text-[16px] leading-relaxed text-muted">
              Move a card and it lands for everyone instantly. No refresh, no
              stale state, no &ldquo;can you reload?&rdquo;
            </p>
            <a
              href="#ai"
              className="mb-10 inline-flex items-center gap-1.5 text-[15px] text-accent transition-opacity hover:opacity-80"
            >
              See what else it does →
            </a>

            {/* Fine green grid bleeding out past the card on every side,
                radially masked so it fades before it reaches the panel edge.
                The card itself is opaque, so the grid only shows in the
                margin around it — which is what makes the card read as
                floating above a surface rather than sitting on flat black. */}
            <div className="relative">
              {/* Green wash sitting under the grid, so the whole area reads
                  as tinted rather than just having green lines drawn on
                  black. Blurred and low-opacity — it's a glow, not a shape. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-10"
                style={{
                  background:
                    "radial-gradient(ellipse 60% 55% at 50% 50%, rgba(90,247,179,0.14), transparent 72%)",
                  filter: "blur(14px)",
                }}
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-10"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, rgba(90,247,179,0.26) 1px, transparent 0), linear-gradient(rgba(90,247,179,0.26) 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                  maskImage:
                    "radial-gradient(ellipse 68% 62% at 50% 50%, black 35%, transparent 78%)",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 68% 62% at 50% 50%, black 35%, transparent 78%)",
                }}
              />

              <div className="relative border border-line-soft bg-surface">
                <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
                <span className="flex -space-x-1.5">
                  {["bg-[#5af7b3]", "bg-[#7dd3fc]", "bg-[#c4b5fd]"].map((tone, i) => (
                    <span
                      key={i}
                      className={`h-6 w-6 rounded-full border-2 border-surface ${tone}`}
                    />
                  ))}
                </span>
                <span className="text-[14px] text-muted">
                  <span className="text-fg">3 people</span> on this board
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[13px] text-accent">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  synced
                </span>
              </div>

              <div className="flex flex-col gap-2 p-4">
                {[
                  { who: "Ada", what: "moved", card: "Rank rebalancing", tone: "bg-[#5af7b3]" },
                  { who: "Kai", what: "added", card: "Spike: offline mode", tone: "bg-[#7dd3fc]" },
                  { who: "Ivo", what: "closed", card: "Session auth", tone: "bg-[#c4b5fd]" },
                ].map((row) => (
                  <div key={row.card} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className={`h-4 w-4 shrink-0 rounded-full ${row.tone}`} />
                    <span className="text-fg">{row.who}</span>
                    <span className="text-faint">{row.what}</span>
                    <span className="truncate text-muted">{row.card}</span>
                  </div>
                ))}
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
