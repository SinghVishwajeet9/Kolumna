import { BoardPreview } from "./BoardPreview";
import { LogoMark } from "@/components/Logo";

// The layered product panel: grid field, angled slab, ghost outline, the
// board itself, floating AI chip, logo tile, and cursor. Extracted from Hero
// so the CTA section can reuse the same composition.
export function BoardPanel() {
  return (
    <div className="relative">
      {/* Layer 1 — grid field behind everything, so the panel reads as
          sitting ON something rather than floating in flat black. */}
      <div
        className="pointer-events-none absolute -inset-x-10 -inset-y-12 hidden lg:block"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--color-line) 1px, transparent 0), linear-gradient(var(--color-line) 1px, transparent 0)",
          backgroundSize: "96px 96px",
          maskImage:
            "radial-gradient(ellipse 80% 70% at 60% 45%, black, transparent)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 70% at 60% 45%, black, transparent)",
        }}
      />

      {/* Layer 2 — the angled slab. Clipped with a notched polygon so it
          reads as a cut sheet of material rather than a plain rectangle,
          with the logo mark watermarked into it. */}
      <div
        className="pointer-events-none absolute -right-6 -top-10 hidden h-[62%] w-[86%] lg:block"
        aria-hidden="true"
        style={{
          // Flat #5af7b3 fading out, rather than a gradient between two
          // opacities — that was muddying the hue toward grey-green.
          background:
            "linear-gradient(200deg, #5af7b3 0%, rgba(90,247,179,0.35) 45%, transparent 85%)",
          opacity: 0.5,
          clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0 100%, 0 26%)",
        }}
      >
        <LogoMark
          className="absolute left-[26%] top-6 w-16 text-bg/25"
          style={{ height: "auto" }}
        />
      </div>

      {/* Layer 2b — a second panel outline offset behind the real one.
          In the reference this is the strongest depth cue: you see a
          faint rounded edge peeking out to the right and below, which
          reads as a stack of surfaces rather than one flat card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden translate-x-4 translate-y-4 border-2 border-accent/20 lg:block"
        style={{ borderRadius: "18px" }}
      />

      {/* Layer 3 — the panel. Rounded and accent-bordered, sitting on a
          deep shadow.

          Radius and shadow are inline: Tailwind kept dropping the
          arbitrary shadow-[...] / rounded-[...] utilities in this
          project, and both are load-bearing here. */}
      <div
        className="relative overflow-x-auto border-2 border-accent/50 bg-surface p-5 lg:overflow-visible"
        style={{
          borderRadius: "18px",
          boxShadow:
            "0 40px 90px -24px rgba(0,0,0,0.95), 0 0 60px -20px rgba(90,247,179,0.25)",
        }}
      >
        <div className="mb-4 flex items-center gap-3 border-b border-line-soft pb-3">
          <span className="text-[13px] font-medium tracking-wide text-muted">
            ACME / Product Roadmap
          </span>

          {/* Toggle, styled as "on" — a small live control that makes the
              panel read as an application rather than a screenshot. */}
          <span className="ml-auto flex items-center gap-3">
            <span className="flex -space-x-1.5">
              {["bg-accent/70", "bg-white/25"].map((tone, i) => (
                <span
                  key={i}
                  className={`h-5 w-5 rounded-full border border-bg ${tone}`}
                />
              ))}
            </span>
            <span
              className="relative flex h-[22px] w-[40px] items-center bg-accent"
              style={{ borderRadius: "999px" }}
            >
              <span
                className="absolute right-[3px] h-4 w-4 rounded-full bg-bg"
                aria-hidden="true"
              />
            </span>
          </span>
        </div>
        <BoardPreview />

        {/* Fade at the panel's bottom edge — the board dissolves into
            the surface instead of ending on a hard line. An overlay
            rather than a mask, so the panel's border and radius survive. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-32"
          style={{
            background:
              "linear-gradient(to bottom, transparent, var(--color-surface) 88%)",
            borderBottomLeftRadius: "18px",
            borderBottomRightRadius: "18px",
          }}
        />

        {/* Small sparkle in the panel's bottom-right dead space */}
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute bottom-4 right-5 hidden h-5 w-5 text-white/15 lg:block"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
        </svg>
      </div>

      {/* Layer 4 — floating AI chip, half off the panel's top edge.
          Gives the composition a focal point and states the product's
          differentiator without another line of copy. */}
      <div
        className="pointer-events-none absolute -top-7 right-20 hidden items-center gap-2.5 border border-accent/50 bg-surface-2 px-5 py-3.5 lg:flex"
        style={{
          borderRadius: "12px",
          boxShadow:
            "0 18px 45px -8px rgba(90,247,179,0.45), inset 0 0 24px -10px rgba(90,247,179,0.6)",
        }}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-accent" fill="currentColor" aria-hidden="true">
          <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4z" />
          <path d="M18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" opacity="0.7" />
        </svg>
        <span className="text-[15px] font-medium text-fg">Split with AI</span>
      </div>

      {/* Layer 4b — logo tile straddling the panel's left edge. In the
          reference this is what stops the composition being a plain
          rectangle: an object breaking the frame on the opposite side
          from the badge, so the eye travels across the whole card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-7 top-[38%] hidden lg:grid"
        style={{ placeItems: "center" }}
      >
        <div
          className="grid border-2 border-accent/60 bg-surface-2"
          style={{
            width: "72px",
            aspectRatio: "1 / 1",
            borderRadius: "16px",
            placeItems: "center",
            boxShadow:
              "0 18px 40px -10px rgba(0,0,0,0.9), 0 0 34px -12px rgba(90,247,179,0.55)",
          }}
        >
          <LogoMark className="text-accent" style={{ width: "56%" }} />
        </div>
      </div>

      {/* Layer 5 — cursor, pointing at the chip. Sells it as something
          you click rather than a static label. */}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute -top-1 right-[5.25rem] hidden h-6 w-6 lg:block"
        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))" }}
        aria-hidden="true"
      >
        <path
          d="M5 2l14 9-6.2 1.2L10 19z"
          fill="#ffffff"
          stroke="var(--color-bg)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
