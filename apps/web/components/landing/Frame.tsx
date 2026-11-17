// Layout primitives for the landing page (see apps/web/DESIGN.md).
//
// The page is one 1280px column with a hairline down each side (Frame).
// Sections inside it are separated by full-width hairlines (Rule) and empty
// 64px strips (Spacer). Grids divide their cells with hairlines, not gaps.

import Link from "next/link";
import { grain } from "./grain";

export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] border-x border-[var(--l-line)]">{children}</div>
  );
}

/** A horizontal hairline that runs past the frame to both edges of the screen. */
export function Rule() {
  return <div aria-hidden="true" className="relative left-1/2 h-px w-screen -translate-x-1/2 bg-[var(--l-line)]" />;
}

// Faint grain that drifts in from the left and right edges of each spacer
// strip and fades out toward the middle (same grain as the panel and footer).
const EDGE_GRAIN = grain(240, 1.25, 16, -10.6);

/** Faint grain drifting in from the left and right edges, fading toward the
 * middle. `reach` = how far in from each edge it fades out (in %). */
export function EdgeGrain({ reach = 16 }: { reach?: number }) {
  const fade = `linear-gradient(to right, black 0%, transparent ${reach}%, transparent ${100 - reach}%, black 100%)`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-30"
      style={{ backgroundImage: EDGE_GRAIN, maskImage: fade, WebkitMaskImage: fade }}
    />
  );
}

/** An empty strip between sections, bounded by hairlines: the page's rhythm.
 * `grain` adds faint edge grain; it's used on some strips, not all. */
export function Spacer({ grain = false, hatch = false }: { grain?: boolean; hatch?: boolean }) {
  return (
    <>
      <Rule />
      <div aria-hidden="true" className="relative h-12 md:h-16">
        {grain && <EdgeGrain />}
        {hatch && <MarginHatch />}
      </div>
      <Rule />
    </>
  );
}

// Fine diagonal lines in the two margins outside the 1280px frame (screen
// edge to frame line), on one spacer strip only. Nothing inside the frame.
// 1px diagonal lines in exactly the frame lines' colour (--l-line, white at 8%).
// Drawn as a repeating 8px SVG tile, not a CSS gradient: a gradient at 45°
// lands each line on the pixel grid differently, so some came out lighter
// than others. In a tile every line is the same pixels, so they all match.
const HATCH_TILE = `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><path d='M-1 1l2-2M0 8l8-8M7 9l2-2' stroke='rgb(255,255,255)' stroke-opacity='0.08' stroke-width='1' shape-rendering='crispEdges'/></svg>`;
const HATCH = `url("data:image/svg+xml,${encodeURIComponent(HATCH_TILE)}")`;

function MarginHatch() {
  // The strip is the frame's width; each margin is half of what's left of the screen.
  const margin = "calc(50vw - 50%)";
  return (
    <>
      <span className="pointer-events-none absolute inset-y-0" style={{ right: "100%", width: margin, backgroundImage: HATCH }} />
      <span className="pointer-events-none absolute inset-y-0" style={{ left: "100%", width: margin, backgroundImage: HATCH }} />
    </>
  );
}

export const pad = "px-5 md:px-8";

/** H2 on the left half, a supporting sentence on the right half. */
export function SectionHeader({
  id,
  title,
  aside,
  children,
}: {
  id?: string;
  title: React.ReactNode;
  aside: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className={`grid scroll-mt-20 gap-6 py-12 md:grid-cols-2 md:gap-8 md:py-16 ${pad}`}>
      <div>{title}</div>
      <div>
        <p className="text-[clamp(18px,2vw,22px)] leading-[1.4] text-[var(--l-muted)]">{aside}</p>
        {children}
      </div>
    </div>
  );
}

export const h2Class = "max-w-[16ch] text-[clamp(30px,3.4vw,40px)] font-medium leading-[1.15] tracking-[-0.016em] text-[var(--l-fg)]";

/** A grid whose cells are separated by hairlines. */
export function Cells({ cols = 3, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const grid = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-4" }[cols];
  return (
    <div className={`grid ${grid} [&>*]:border-[var(--l-line)] max-md:[&>*+*]:border-t md:[&>*+*]:border-l`}>
      {children}
    </div>
  );
}

/** One grid cell: visual on top, then title, text and an optional link. */
export function Cell({
  visual,
  title,
  body,
  href,
  linkLabel,
}: {
  visual?: React.ReactNode;
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    // Medusa-style: the visual fills the cell with a thin inset; short text below.
    // iso-card: hovering anywhere on the card animates an isometric figure inside it.
    <div className="iso-card flex flex-col">
      {visual && <div className="p-2">{visual}</div>}
      <div className="px-5 pt-5 pb-8 md:px-6 md:pt-6 md:pb-10">
        <h3 className="text-[16px] font-medium leading-6 text-[var(--l-fg)]">{title}</h3>
        <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--l-muted)]">{body}</p>
        {href && linkLabel && (
          <a href={href} className="mt-4 inline-block text-[13px] font-medium text-[var(--l-fg)] hover:text-[var(--l-muted)]">
            {linkLabel} <span aria-hidden="true">▸</span>
          </a>
        )}
      </div>
    </div>
  );
}

/** The soft rounded panel product screens sit in. */
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden border border-[var(--l-line)] bg-[var(--l-panel)] ${className}`}
      style={{ borderRadius: 8 }}
    >
      {children}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  primary = false,
  large = false,
  hero = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
  large?: boolean;
  /** The hero's buttons: a size up from large, to balance the headline. */
  hero?: boolean;
}) {
  const size = hero ? "h-10 px-5 text-[15px]" : large ? "h-9 px-4 text-[14px]" : "h-8 px-3 text-[13px]";
  const look = primary
    ? "bg-[#fafafa] text-[#09090b] hover:bg-[#e4e4e7]"
    : "border border-[var(--l-line-strong)] text-[var(--l-fg)] hover:bg-white/[0.05]";
  const cls = `inline-flex shrink-0 items-center whitespace-nowrap font-medium transition-colors ${size} ${look}`;
  const style = { borderRadius: 6 };
  return href.startsWith("#") ? (
    <a href={href} className={cls} style={style}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls} style={style}>
      {children}
    </Link>
  );
}
