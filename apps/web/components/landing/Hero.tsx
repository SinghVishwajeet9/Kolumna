import { ButtonLink, pad } from "./Frame";
import { ProductFilm } from "./film/ProductFilm";

// The landing hero. Two layouts are kept so they can be compared; `Hero` is
// the one the page uses.
//   HeroStacked  the headline, then the product film across the full screen
//                width, then one short line and the buttons under the film.
//   HeroSplit    the full screen width in two halves: text centred in the
//                left half, the film filling the right, a fading line between.
// Film design: DESIGN-FILM.md.
export const Hero = HeroSplit;

export function HeroStacked() {
  return (
    <section className="hero-section relative">
      <div className={`mx-auto w-full max-w-[1280px] pb-8 pt-16 md:pb-10 md:pt-20 ${pad}`}>
        <p className="mb-4 text-[13px] font-medium text-[var(--l-faint)]">For teams that work with AI agents</p>
        <h1 className="max-w-[20ch] text-[clamp(36px,4.6vw,60px)] font-medium leading-[1.08] tracking-[-0.025em] text-[var(--l-fg)] md:max-w-none">
          Let AI agents work on your board, safely.
        </h1>
      </div>

      {/* The film, edge to edge. */}
      <div className="hero-stack-film relative">
        <ProductFilm />
      </div>

      {/* The rest, shorter, under the film: one line on the left, the buttons on the right. */}
      <div
        className={`mx-auto flex w-full max-w-[1280px] flex-col gap-6 pb-14 pt-8 md:flex-row md:items-center md:justify-between md:pb-16 md:pt-10 ${pad}`}
      >
        <p className="max-w-[62ch] text-[16px] leading-6 text-[var(--l-muted)]">
          Approvals, budgets and a full audit trail for Claude Code, Cursor and any MCP agent.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2.5">
          <ButtonLink href="/signup" primary large>
            Start free
          </ButtonLink>
          <ButtonLink href="#how" large>
            See how it works
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export function HeroSplit() {
  return (
    <section className="hero-section relative">
      <div className="hero-grid">
        <div className={`flex flex-col justify-center pb-12 pt-20 md:py-20 ${pad}`}>
          {/* Centred in the left half of the screen, text left-aligned. */}
          <div className="hero-text">
            {/* A square-cornered label framed by two fading crosses: lines meet past the
                top-left and bottom-right corners and fade out along the edges. */}
            <p className="hero-tag relative mb-8 inline-flex h-10 items-center px-4 text-[15px] font-medium text-[var(--l-muted)]">
              <span aria-hidden="true" className="hero-tag-line hero-tag-top" />
              <span aria-hidden="true" className="hero-tag-line hero-tag-left" />
              <span aria-hidden="true" className="hero-tag-line hero-tag-bottom" />
              <span aria-hidden="true" className="hero-tag-line hero-tag-right" />
              For teams that work with AI agents
            </p>
            <h1 className="max-w-[17ch] text-[clamp(38px,4.3vw,56px)] font-medium leading-[1.1] tracking-[-0.025em] text-[var(--l-fg)]">
              Let AI agents work on your board, safely.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[16px] leading-6 text-[var(--l-muted)]">
              Approvals, budgets and a full audit trail for Claude Code, Cursor and any MCP agent. They pick up
              tickets like teammates; you decide how far they can go.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <ButtonLink href="/signup" primary large hero>
                Start free
              </ButtonLink>
              <ButtonLink href="#how" large hero>
                See how it works
              </ButtonLink>
            </div>
          </div>
        </div>
        {/* The film fills the right half of the screen. */}
        <div className="hero-film relative">
          <ProductFilm />
        </div>
      </div>
          </section>
  );
}
