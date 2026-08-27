import { RotatingWord } from "./RotatingWord";
import { GooeyButton } from "./GooeyButton";
import { DitheringVisual } from "./DitheringVisual";

export function Hero() {
  return (
    // Solid, full-bleed, with a rule along the bottom to close it off
    // against the grid that starts underneath.
    <section className="relative overflow-hidden border-b border-line bg-bg">
      {/* The dithering wave + edge scatter lives in a band along the
          bottom of the section, behind the copy above it. */}
      <DitheringVisual />

      {/* Top-aligned rather than vertically centered: centering would
          have pushed the copy down into the dithering band below.
          A full 100svh rather than (100svh − nav): the hero runs slightly
          past the fold, so the grid below peeks in as a scroll cue.
          svh (not vh) so mobile browser chrome doesn't clip it. */}
      <div className="relative mx-auto flex max-w-[720px] flex-col items-center px-6 pb-24 pt-24 text-center lg:min-h-[100svh] lg:pb-40 lg:pt-36">
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

        <div className="mt-10 flex flex-wrap justify-center gap-3">
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
    </section>
  );
}
