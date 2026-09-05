export function AISection() {
  return (
    <section id="ai" className="relative overflow-hidden bg-bg">
      {/* Dual corner wash — green bleeding in from the left, pink from the
          right — for a soft two-tone glow behind the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-32 h-[560px] w-[560px] rounded-full blur-[140px]"
        style={{ background: "rgba(90,247,179,0.10)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-32 h-[560px] w-[560px] rounded-full blur-[140px]"
        style={{ background: "rgba(249,168,212,0.10)" }}
      />

      <div className="relative grid items-center gap-16 px-6 py-24 md:px-10 lg:grid-cols-2 lg:py-32">
        <div>
          <span className="mb-6 inline-block bg-accent/12 px-2.5 py-1 text-[13px] font-medium tracking-wide text-accent">
            AI
          </span>
          <h2 className="mb-6 max-w-[15ch] text-[clamp(2.25rem,4.5vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.03em]">
            Stop writing the same five subtasks.
          </h2>
          <p className="mb-8 max-w-[46ch] text-[18px] leading-relaxed text-muted">
            Point Kolumna at a card that&rsquo;s too big to start. It returns
            concrete, ordered subtasks — and you decide which ones become real.
            Nothing is written to your board without a click.
          </p>

          <ul className="flex flex-col gap-3">
            {[
              "Structured output, validated before it touches your data",
              "You approve every suggestion — no silent writes",
              "Duplicate detection catches work you already logged",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-[16px] text-muted">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* before → after */}
        <div className="flex flex-col gap-3">
          <div className="border border-line bg-surface p-5">
            <p className="mb-2 text-[12px] uppercase tracking-wider text-faint">
              The card you actually wrote
            </p>
            <p className="text-[17px] text-fg">Redo authentication</p>
          </div>

          <div className="flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[13px] text-accent">decompose ↓</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="border border-accent/25 bg-surface p-5 shadow-[0_24px_60px_-24px_rgba(90,247,179,0.2)]">
            <p className="mb-3 text-[12px] uppercase tracking-wider text-accent">
              6 suggested subtasks
            </p>
            <div className="flex flex-col gap-2">
              {[
                "Replace JWT with server-side sessions",
                "Hash tokens before storing them",
                "Add sliding-window session renewal",
                "Build logout + revocation path",
                "Rate-limit the login route",
                "Write auth integration tests",
              ].map((task, i) => (
                <label
                  key={task}
                  className="flex cursor-default items-center gap-2.5 text-[14.5px] text-fg/85"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] ${
                      i < 4
                        ? "border-accent bg-accent text-bg"
                        : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  {task}
                </label>
              ))}
            </div>
            <button className="mt-4 w-full bg-accent py-2 text-[14px] font-medium text-bg">
              Add 4 cards
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
