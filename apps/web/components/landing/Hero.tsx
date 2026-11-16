import { ButtonLink, pad } from "./Frame";
import { ProductTabs } from "./ProductTabs";
import { HeroBackdrop } from "./HeroBackdrop";

// Left-aligned: eyebrow, the one sentence, one supporting line, two actions.
// Then the product itself, five tabs over real screens.
export function Hero() {
  return (
    <section>
      <div className={`relative pt-20 pb-12 md:pt-36 md:pb-16 ${pad}`}>
        <HeroBackdrop />
        <div className="relative">
        <p className="mb-5 text-[13px] font-medium text-[var(--l-faint)]">For teams that work with AI agents</p>
        <h1 className="max-w-[18ch] text-[clamp(40px,5.6vw,64px)] font-medium leading-[1.12] tracking-[-0.025em] text-[var(--l-fg)]">
          Let AI agents work on your board, safely.
        </h1>
        <p className="mt-5 max-w-[58ch] text-[16px] leading-6 text-[var(--l-muted)]">
          Approvals, budgets and a full audit trail for Claude Code, Cursor and any MCP agent. They pick up
          tickets like teammates; you decide how far they can go.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <ButtonLink href="/signup" primary large>
            Start free
          </ButtonLink>
          <ButtonLink href="#how" large>
            See how it works
          </ButtonLink>
        </div>
        </div>
      </div>
      <ProductTabs />
    </section>
  );
}
