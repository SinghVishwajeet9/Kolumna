import { RotatingWord } from "./RotatingWord";
import { BoardPreview } from "./BoardPreview";
import { GooeyButton } from "./GooeyButton";

export function Hero() {
  return (
    // Solid, full-bleed, with a rule along the bottom to close it off
    // against the grid that starts underneath.
    <section className="relative overflow-hidden border-b border-line bg-bg">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-accent/[0.07] blur-[120px]" />

      {/* Same one-column side padding as the framed blocks below, so the
          headline still lines up with them even though the section itself
          runs edge to edge. */}
      {/* A full 100svh rather than (100svh − nav): the hero runs slightly
          past the fold, so the grid below peeks in as a scroll cue.
          svh (not vh) so mobile browser chrome doesn't clip it. */}
      {/* grid-cols-[minmax(0,1fr)] on the base, not just `grid`: a grid
          column defaults to min-width:auto, so the 760px-wide board preview
          was stretching the single mobile column to 766px. Everything else
          in the column then laid out against that phantom width and got
          clipped by the section's overflow-hidden. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-16 px-6 py-24 lg:min-h-[100svh] lg:grid-cols-[1fr_minmax(0,760px)] lg:px-[calc(100%/16)] lg:py-36">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 border border-line bg-surface/60 px-3 py-1.5">
            <span className="h-1.5 w-1.5 bg-accent" />
            <span className="text-[13.5px] text-muted">
              Now with AI epic decomposition
            </span>
          </div>

          <h1 className="text-[clamp(2.75rem,6vw,4.5rem)] font-medium leading-[1.03] tracking-[-0.03em]">
            Structure for
            <br />
            your team&rsquo;s <RotatingWord />
          </h1>

          <p className="mt-7 max-w-[440px] text-[18px] leading-relaxed text-muted">
            A multi-tenant project board built for teams that move fast. Drag,
            drop, and let AI break the big things into small ones.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {/* Pure white, same as the nav CTA and the outlined button
                beside it — bg-fg (#f4f4f4) would be a shade off. */}
            <GooeyButton
              href="/signup"
              className="group bg-[#ffffff] px-8 py-5 text-[18px] font-medium text-bg"
              labelClassName="flex items-center gap-2.5"
            >
              Start for free
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </GooeyButton>
            {/* Pure-white outline, matching the filled button beside it.
                Arbitrary value rather than `border-white` — see Nav.tsx.
                goo--white: blobs are white here, not accent green. */}
            <GooeyButton
              href="#how"
              className="goo--white border border-[#ffffff] px-8 py-5 text-[18px] font-medium text-fg"
            >
              See how it works
            </GooeyButton>
          </div>
        </div>

        {/* Bleeds off the right edge on large screens, like Render's hero panel */}
        <div className="relative lg:-mr-24 xl:-mr-40">
          {/* The board is wider than a phone; let it scroll inside its panel
              rather than pushing the layout out. */}
          <div className="overflow-x-auto border border-line bg-surface/40 p-5 backdrop-blur-sm lg:overflow-visible">
            <div className="mb-4 flex items-center gap-2 border-b border-line-soft pb-3">
              <span className="text-[13px] font-medium tracking-wide text-muted">
                ACME / Product Roadmap
              </span>
              <span className="ml-auto flex -space-x-1.5">
                {["bg-accent/70", "bg-white/25", "bg-white/15"].map((tone, i) => (
                  <span
                    key={i}
                    className={`h-5 w-5 rounded-full border border-bg ${tone}`}
                  />
                ))}
              </span>
            </div>
            <BoardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
