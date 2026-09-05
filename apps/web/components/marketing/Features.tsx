// Small squares sitting on the corners of a bordered region — the
// registration/crop-mark device that gives technical-drawing UIs their
// "spec sheet" feel. Purely decorative; the parent needs `relative`.
function CornerMarks({ accent = false }: { accent?: boolean }) {
  const tone = accent ? "border-accent" : "border-faint";
  return (
    <>
      {[
        "-left-[7px] -top-[7px]",
        "-right-[7px] -top-[7px]",
        "-left-[7px] -bottom-[7px]",
        "-right-[7px] -bottom-[7px]",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`pointer-events-none absolute h-[13px] w-[13px] border bg-bg ${tone} ${pos}`}
          style={{ borderRadius: "3px" }}
        />
      ))}
    </>
  );
}

// Big value, small caption. The value colour comes from the caller so each
// card can carry a different hue — same palette as the Breadth colour-run.
// Every figure is a real property of the system, not a marketing number.
function Stat({
  value,
  caption,
  color,
}: {
  value: string;
  caption: string;
  color: string;
}) {
  return (
    // Border and fill are tinted with the value's own colour (8-digit hex =
    // colour + alpha): ~50% on the dashed border, ~8% on the fill.
    <div
      className="border border-dashed p-7"
      style={{
        borderRadius: "8px",
        borderColor: `${color}80`,
        backgroundColor: `${color}14`,
        fontFamily: "var(--font-mono)",
      }}
    >
      <p
        className="text-[30px] font-medium leading-none tracking-[-0.02em]"
        style={{ color }}
      >
        {value}
      </p>
      <p className="mt-3 text-[15px] text-muted">{caption}</p>
    </div>
  );
}

export function Features() {
  return (
    <section id="product" className="bg-bg">
      <div className="px-6 pt-14 pb-24 md:px-10 lg:pb-32 lg:pt-16">
        <h2 className="mb-4 max-w-[20ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          One board. <span className="text-accent">Zero friction.</span>
        </h2>
        <p className="mb-16 max-w-[52ch] text-[18px] leading-relaxed text-muted">
          The boring parts done properly — so the interesting parts stay fast.
        </p>

        {/* Outer plate — no corner marks of its own; those live on the
            inner plates. */}
        <div className="relative border border-line">
          {/* Row 1 — explainer on the left, the actual query on the right,
              mirroring the reference's "text + diagram" band. */}
          <div className="grid border-b border-line lg:grid-cols-2">
            <div className="border-b border-line p-8 lg:border-b-0 lg:border-r lg:p-10">
              <p className="mb-4 font-mono text-[12px] uppercase tracking-[0.16em] text-accent">
                Isolation
              </p>
              <h3 className="mb-3 text-[22px] font-medium">Isolated by default</h3>
              <p className="max-w-[46ch] text-[16px] leading-relaxed text-muted">
                Every row carries its workspace, and queries that forget it
                don&rsquo;t compile. Tenant leaks aren&rsquo;t something you
                have to remember to prevent.
              </p>
            </div>

            <div className="flex items-center p-8 lg:p-10">
              <div className="relative w-full border border-dashed border-line bg-surface/60 p-6 font-mono text-[13.5px] leading-relaxed">
                <CornerMarks accent />
                <span className="text-faint">prisma.board.findMany(</span>
                <br />
                <span className="pl-4 text-faint">where: &#123; </span>
                <span className="text-accent">workspaceId: ctx.workspaceId</span>
                <span className="text-faint"> &#125;</span>
                <br />
                <span className="text-faint">)</span>
              </div>
            </div>
          </div>

          {/* Row 2 — two halves, each a heading and a nested plate of stat
              cards. Values use the multicolour Breadth palette. */}
          <div className="grid lg:grid-cols-2">
            <div className="border-b border-line p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div className="mb-7">
                <h3
                  className="text-[26px] font-medium"
                  style={{ color: "#5af7b3" }}
                >
                  Ordering
                </h3>
                <p className="mt-1 text-[15px] text-muted">
                  Fractional ranking, not renumbering
                </p>
              </div>

              <div className="relative border border-line p-5">
                <CornerMarks />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Stat value="1" caption="/ row written per drag" color="#5af7b3" />
                  <Stat value="O(1)" caption="/ cost at any list size" color="#7dd3fc" />
                  <Stat value="0" caption="/ renumbering passes" color="#c4b5fd" />
                  <Stat value="Float" caption="/ rank column type" color="#fcd34d" />
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <div className="mb-7">
                <h3
                  className="text-[26px] font-medium"
                  style={{ color: "#f9a8d4" }}
                >
                  Tenancy
                </h3>
                <p className="mt-1 text-[15px] text-muted">
                  Enforced at the query layer
                </p>
              </div>

              <div className="relative border border-line p-5">
                <CornerMarks />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Stat value="0" caption="/ joins to filter by tenant" color="#86efac" />
                  <Stat value="1" caption="/ query to hydrate a board" color="#f9a8d4" />
                  <Stat value="9" caption="/ tables, all scoped" color="#67e8f9" />
                  <Stat value="2" caption="/ auth gates per request" color="#d9f99d" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
