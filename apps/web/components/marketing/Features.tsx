export function Features() {
  return (
    <section id="product" className="bg-bg">
      <div className="px-6 py-24 md:px-10 lg:py-32">
        <h2 className="mb-4 max-w-[20ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          One board. <span className="text-accent">Zero friction.</span>
        </h2>
        <p className="mb-16 max-w-[52ch] text-[18px] leading-relaxed text-muted">
          The boring parts done properly — so the interesting parts stay fast.
        </p>

        <div className="grid gap-px bg-line-soft md:grid-cols-3">
          {/* Wide cell */}
          <div className="bg-bg p-8 md:col-span-2">
            <h3 className="mb-3 text-[20px] font-medium">Isolated by default</h3>
            <p className="mb-8 max-w-[46ch] text-[16px] leading-relaxed text-muted">
              Every row carries its workspace, and queries that forget it
              don&rsquo;t compile. Tenant leaks aren&rsquo;t something you have
              to remember to prevent.
            </p>

            <div className="border border-line-soft bg-surface p-4 font-mono text-[13.5px] leading-relaxed">
              <span className="text-faint">prisma.board.findMany(</span>
              <br />
              <span className="pl-4 text-faint">where: &#123; </span>
              <span className="text-accent">workspaceId: ctx.workspaceId</span>
              <span className="text-faint"> &#125;</span>
              <br />
              <span className="text-faint">)</span>
            </div>
          </div>

          {/* Narrow cell */}
          <div className="bg-bg p-8">
            <h3 className="mb-3 text-[20px] font-medium">Ordering that scales</h3>
            <p className="text-[16px] leading-relaxed text-muted">
              Fractional ranking means one row changes per drag — not the whole
              list, and not a race when two people move at once.
            </p>
          </div>

          {/* Bottom row */}
          {[
            {
              title: "Cards with substance",
              body: "Descriptions, due dates, assignees, labels. Everything a real task needs, nothing it doesn't.",
            },
            {
              title: "Built on Postgres",
              body: "Real relations, real constraints, real transactions. Your data keeps its shape.",
            },
            {
              title: "Yours to run",
              body: "Postgres, Node, and React. No proprietary lock-in, no black boxes.",
            },
          ].map((cell) => (
            <div key={cell.title} className="bg-bg p-8">
              <h3 className="mb-3 text-[20px] font-medium">{cell.title}</h3>
              <p className="text-[16px] leading-relaxed text-muted">{cell.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
