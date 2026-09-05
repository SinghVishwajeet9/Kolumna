import { BoardPreview } from "./BoardPreview";
import { LogoMark } from "@/components/Logo";

// The layered product panel: grid field, angled slab, ghost outline, the
// board itself, floating AI chip, logo tile, and cursor. Extracted from Hero
// so the CTA section can reuse the same composition.
export function BoardPanel() {
  return (
    <div className="relative">
      {/* Layer 2b — a second panel outline offset behind the real one, for
          a faint "stack of surfaces" depth cue. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden translate-x-4 translate-y-4 border-2 lg:block"
        style={{ borderRadius: "18px", borderColor: "rgba(255,255,255,0.2)" }}
      />

      {/* Layer 3 — the panel. Rounded and accent-bordered, sitting on a
          deep shadow.

          Radius and shadow are inline: Tailwind kept dropping the
          arbitrary shadow-[...] / rounded-[...] utilities in this
          project, and both are load-bearing here. */}
      <div
        className="relative overflow-x-auto border-2 bg-surface p-5 lg:overflow-visible"
        style={{
          borderRadius: "18px",
          borderColor: "#ffffff",
          boxShadow: "0 40px 90px -24px rgba(0,0,0,0.95)",
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
          className="grid border-2 bg-surface-2"
          style={{
            width: "72px",
            aspectRatio: "1 / 1",
            borderRadius: "16px",
            borderColor: "#ffffff",
            placeItems: "center",
            boxShadow: "0 18px 40px -10px rgba(0,0,0,0.9)",
          }}
        >
          <LogoMark className="text-accent" style={{ width: "56%" }} />
        </div>
      </div>

    </div>
  );
}
