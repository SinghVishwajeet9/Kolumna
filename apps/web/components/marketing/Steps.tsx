import Image from "next/image";

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
    <section
      id="how"
      className="overflow-hidden bg-bg"
      style={{ borderTop: "2px solid var(--color-line)", borderBottom: "2px solid var(--color-line)" }}
    >
      <div className="relative mx-auto px-6 py-24 md:px-10 lg:py-32" style={{ maxWidth: "1360px" }}>
        <h2 className="mb-16 max-w-[20ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Create, drag, ship.
        </h2>

        {/* Bottom-right of the section, tucked near the third box —
            rotated 135° counter-clockwise from its original
            right-pointing orientation. */}
        <Image
          src="/arrow.png"
          alt=""
          width={180}
          height={180}
          className="pointer-events-none absolute"
          style={{
            width: "clamp(5.5rem,11vw,8.5rem)",
            height: "auto",
            right: "-150px",
            bottom: "60px",
            transform: "rotate(-135deg)",
          }}
        />

        <div className="grid md:grid-cols-3" style={{ gap: "72px" }}>
          {steps.map((step) => (
            <div key={step.n} className="p-9" style={{ border: "1.5px solid #ffffff" }}>
              <span
                className="mb-6 flex items-center justify-center bg-accent text-[19px] font-semibold text-bg"
                style={{
                  height: "42px",
                  width: "42px",
                  borderRadius: "6px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {step.n}
              </span>
              <h3 className="mb-3 text-[24px] font-medium tracking-[-0.01em]">
                {step.title}
              </h3>
              <p className="max-w-[40ch] text-[17.5px] leading-relaxed text-muted">
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
    <div
      className="mt-10 border border-line-soft p-5"
      style={{
        borderRadius: "10px",
        // Lit from above rather than a flat fill — same treatment as the
        // board preview cards, so every mock UI on the page reads as one
        // material.
        backgroundImage:
          "linear-gradient(to bottom, rgba(255,255,255,0.035), transparent 60%)",
        backgroundColor: "var(--color-surface)",
      }}
    >
      {step === "1" && (
        <div className="flex flex-col gap-2">
          {[
            { name: "Acme Inc", active: true },
            { name: "Globex", active: false },
          ].map((ws) => (
            <div
              key={ws.name}
              className={`flex items-center gap-3 px-3 py-2.5 text-[15px] ${
                ws.active ? "bg-accent/[0.08] text-fg" : "text-muted"
              }`}
              style={{ borderRadius: "6px" }}
            >
              <span
                className={`h-5 w-5 ${ws.active ? "bg-accent" : "bg-white/15"}`}
                style={{ borderRadius: "4px" }}
              />
              {ws.name}
              {ws.active && <span className="ml-auto text-accent">✓</span>}
            </div>
          ))}
        </div>
      )}

      {step === "2" && (
        // Column bars in the logo's alternating rhythm
        <div className="flex h-[92px] items-end justify-center gap-3">
          {[
            { h: "h-[56px]", tone: "bg-white/12" },
            { h: "h-[78px]", tone: "bg-white/20" },
            { h: "h-[56px]", tone: "bg-accent" },
            { h: "h-[78px]", tone: "bg-white/20" },
            { h: "h-[56px]", tone: "bg-white/12" },
          ].map((bar, i) => (
            <span
              key={i}
              className={`w-7 ${bar.h} ${bar.tone}`}
              style={{ borderRadius: "3px 3px 0 0" }}
            />
          ))}
        </div>
      )}

      {step === "3" && (
        <div className="flex flex-col gap-2">
          <p className="mb-1 text-[13px] uppercase tracking-wider text-faint">
            Suggested subtasks
          </p>
          {["Set up auth provider", "Build session store", "Add logout flow"].map(
            (task, i) => (
              <div
                key={task}
                className="flex items-center gap-3 border border-line-soft px-3 py-2 text-[15px] text-fg/85"
                style={{ borderRadius: "6px" }}
              >
                <span
                  className={`h-4 w-4 border ${
                    i < 2 ? "border-accent bg-accent/20" : "border-line"
                  }`}
                  style={{ borderRadius: "3px" }}
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
