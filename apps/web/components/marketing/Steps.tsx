const steps = [
  {
    n: "1",
    title: "Spin up a workspace",
    body: "Invite your team in one click. Every workspace is isolated at the database layer — nobody sees what isn't theirs.",
  },
  {
    n: "2",
    title: "Break work into columns",
    body: "Drag cards between lists. Reordering writes a single row, so it stays instant even when two people move the same card.",
  },
  {
    n: "3",
    title: "Let AI do the tedious part",
    body: "Hand it a vague epic. Get back concrete subtasks — you pick which ones become real cards.",
  },
];

export function Steps() {
  return (
    <section id="how" className="bg-bg">
      <div className="px-6 py-24 md:px-10 lg:py-32">
        <h2 className="mb-16 max-w-[16ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Create, drag, ship.
        </h2>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.n}>
              <span className="mb-5 flex h-7 w-7 items-center justify-center bg-accent text-[14px] font-semibold text-bg">
                {step.n}
              </span>
              <h3 className="mb-3 text-[21px] font-medium tracking-[-0.01em]">
                {step.title}
              </h3>
              <p className="max-w-[38ch] text-[16px] leading-relaxed text-muted">
                {step.body}
              </p>

              <StepVisual step={step.n} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepVisual({ step }: { step: string }) {
  return (
    <div className="mt-8 border border-line-soft bg-surface p-4">
      {step === "1" && (
        <div className="flex flex-col gap-2">
          {[
            { name: "Acme Inc", active: true },
            { name: "Globex", active: false },
          ].map((ws) => (
            <div
              key={ws.name}
              className={`flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] ${
                ws.active ? "bg-accent/[0.08] text-fg" : "text-muted"
              }`}
            >
              <span
                className={`h-4 w-4 ${ws.active ? "bg-accent" : "bg-white/15"}`}
              />
              {ws.name}
              {ws.active && <span className="ml-auto text-accent">✓</span>}
            </div>
          ))}
        </div>
      )}

      {step === "2" && (
        // Column bars in the logo's alternating rhythm
        <div className="flex h-[76px] items-end justify-center gap-2.5">
          {[
            { h: "h-[46px]", tone: "bg-white/12" },
            { h: "h-[64px]", tone: "bg-white/20" },
            { h: "h-[46px]", tone: "bg-accent" },
            { h: "h-[64px]", tone: "bg-white/20" },
            { h: "h-[46px]", tone: "bg-white/12" },
          ].map((bar, i) => (
            <span key={i} className={`w-6 ${bar.h} ${bar.tone}`} />
          ))}
        </div>
      )}

      {step === "3" && (
        <div className="flex flex-col gap-1.5">
          <p className="mb-1 text-[12px] uppercase tracking-wider text-faint">
            Suggested subtasks
          </p>
          {["Set up auth provider", "Build session store", "Add logout flow"].map(
            (task, i) => (
              <div
                key={task}
                className="flex items-center gap-2.5 border border-line-soft px-2.5 py-1.5 text-[13.5px] text-fg/85"
              >
                <span
                  className={`h-3.5 w-3.5 border ${
                    i < 2 ? "border-accent bg-accent/20" : "border-line"
                  }`}
                />
                {task}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
