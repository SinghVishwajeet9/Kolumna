import { Nav } from "@/components/marketing/Nav";
import { Hero } from "@/components/marketing/Hero";
import { CrowdScene } from "@/components/marketing/CrowdScene";
import { Steps } from "@/components/marketing/Steps";
import { Breadth } from "@/components/marketing/Breadth";
import { Features } from "@/components/marketing/Features";
import { StatusBoard } from "@/components/marketing/StatusBoard";
import { AISection } from "@/components/marketing/AISection";
import { CTA } from "@/components/marketing/CTA";
import { Footer } from "@/components/marketing/Footer";
import { GooFilter } from "@/components/marketing/GooFilter";

// Each framed section is its own bordered, OPAQUE block. The grid lives on
// the page wrapper behind them, so it shows only in the one-column side
// margins and in the gaps between blocks — never behind content.
function Block({ children }: { children: React.ReactNode }) {
  return <div className="border border-line bg-bg">{children}</div>;
}

export default function LandingPage() {
  return (
    // id="top" is the scroll target for the footer's logo tile.
    <div id="top" className="grid-field">
      {/* Defines filter#goo, referenced by every gooey button on the page. */}
      <GooFilter />
      <Nav />

      <main>
        {/* Full-bleed: no frame, no side margins, no grid around it. The
            framed grid only begins at the sections below. */}
        <Hero />

        {/* Also full-bleed — the illustration needs the whole width. */}
        <CrowdScene />

        {/* Full-bleed too, immediately below the crowd — no gap, no
            frame, no side margins. Its own internal padding handles the
            content inset. */}
        <Steps />

        {/* Side padding is calc(100%/16), matching the grid's
            background-size, so each block's left AND right edge lands on a
            grid line. (A percentage resolves against the containing block's
            width — the same width the grid is painted across. Using
            100vw here would drift by the scrollbar width.) */}
        <div className="flex flex-col gap-[var(--column-size)] px-6 pt-[var(--column-size)] lg:px-[calc(100%/16)]">
          <Block>
            <Breadth />
          </Block>
          <Block>
            <Features />
          </Block>
          <Block>
            <StatusBoard />
          </Block>
          <Block>
            <AISection />
          </Block>
          <Block>
            <CTA />
          </Block>
        </div>
      </main>

      {/* Full-bleed like the hero — the giant wordmark needs the whole
          width, so no frame and no side margins here. */}
      <div className="mt-[var(--column-size)]">
        <Footer />
      </div>
    </div>
  );
}
