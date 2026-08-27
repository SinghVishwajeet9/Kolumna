import Link from "next/link";
import { BoardPanel } from "./BoardPanel";

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-bg">
      {/* Two columns now: the pitch on the left, the product shot on the
          right. Left-aligned rather than centred — a centred column next to
          a right-hand visual reads as two unrelated things. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-16 px-6 py-24 md:px-10 lg:grid-cols-[1fr_minmax(0,620px)] lg:py-32">
        <div>
          {/* The logo rhythm, blown up as decoration */}
          <div className="mb-10 flex items-end gap-3">
            {[
              "h-10 bg-white/8",
              "h-16 bg-white/14",
              "h-10 bg-accent",
              "h-16 bg-white/14",
              "h-10 bg-white/8",
            ].map((bar, i) => (
              <span key={i} className={`w-8 ${bar}`} />
            ))}
          </div>

          <h2 className="mb-6 max-w-[16ch] text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.03em]">
            Put your work in columns.
          </h2>
          <p className="mb-10 max-w-[44ch] text-[18px] leading-relaxed text-muted">
            Free while you&rsquo;re getting started. No card, no sales call.
          </p>

          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 bg-accent px-7 py-4 text-[17px] font-medium text-bg transition-opacity hover:opacity-90"
          >
            Start for free
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <BoardPanel />
      </div>
    </section>
  );
}
