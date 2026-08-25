import Link from "next/link";

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-bg">
      <div className="relative px-6 py-28 text-center md:px-10 lg:py-36">
        {/* The logo rhythm, blown up as decoration */}
        <div className="mb-12 flex items-end justify-center gap-3">
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

        <h2 className="mx-auto mb-6 max-w-[18ch] text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.05] tracking-[-0.03em]">
          Put your work in columns.
        </h2>
        <p className="mx-auto mb-10 max-w-[44ch] text-[18px] leading-relaxed text-muted">
          Free while you&rsquo;re getting started. No card, no sales call.
        </p>

        <Link
          href="/signup"
          className="group inline-flex items-center gap-2 bg-accent px-7 py-3.5 text-[16px] font-medium text-bg transition-opacity hover:opacity-90"
        >
          Start for free
          <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </section>
  );
}
