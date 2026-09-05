import Image from "next/image";
import { BoardPanel } from "./BoardPanel";
import { GooeyButton } from "./GooeyButton";

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-bg">
      {/* Decorative pixel-torus in the section's bottom-left. */}
      <Image
        src="/tri.png"
        alt=""
        aria-hidden="true"
        width={360}
        height={360}
        className="pointer-events-none absolute select-none"
        style={{ bottom: "28px", left: "40px", width: "190px", height: "auto" }}
      />
      {/* Two columns now: the pitch on the left, the product shot on the
          right. Left-aligned rather than centred — a centred column next to
          a right-hand visual reads as two unrelated things. */}
      {/* KNOBS:
          - paddingBottom = the section's LOWER boundary (reduce it to pull
            the bottom edge up / shrink the section).
          - the left column's paddingLeft = space from the left. */}
      <div
        className="relative grid grid-cols-[minmax(0,1fr)] items-start gap-16 px-6 pt-24 md:px-10 lg:grid-cols-[1fr_minmax(0,720px)] lg:pt-32"
        style={{ paddingBottom: "218px" }}
      >
        <div style={{ paddingLeft: "40px" }}>
          <h2
            className="mb-6 max-w-[16ch] text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-mono)", color: "#5af7b3" }}
          >
            Put your work in columns.
          </h2>
          <p className="mb-10 max-w-[44ch] text-[22px] leading-relaxed text-muted">
            Free while you&rsquo;re getting started. No card, no sales call.
          </p>

          {/* Same gooey-fill button as the hero. inline-flex so it sizes to
              its content in this block context (the hero's is inside a flex
              row, which is what made it lay out there). */}
          <GooeyButton
            href="/signup"
            className="group inline-flex bg-[#ffffff] px-8 py-5 text-[18px] font-medium text-bg"
            labelClassName="flex items-center gap-2.5"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Start for free
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </GooeyButton>
        </div>

        <BoardPanel />
      </div>
    </section>
  );
}
