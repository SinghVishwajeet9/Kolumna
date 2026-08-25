import Link from "next/link";
import { LogoMark } from "@/components/Logo";

// Every href points at a real section or page — no links to things that
// don't exist.
const groups = [
  {
    heading: "Product",
    links: [
      { label: "Boards", href: "#product" },
      { label: "Workspaces", href: "#product" },
      { label: "Real-time", href: "#how" },
      { label: "Ordering", href: "#product" },
    ],
  },
  {
    heading: "AI",
    links: [
      { label: "Epic decomposition", href: "#ai" },
      { label: "Duplicate detection", href: "#ai" },
      { label: "How it works", href: "#how" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/signup" },
    ],
  },
];

export function Footer() {
  return (
    // Full-bleed and overflow-hidden — the giant wordmark below is meant to
    // run past the bottom edge and get clipped.
    <footer className="relative overflow-hidden border-t border-line bg-bg">
      <div className="px-6 pt-20 lg:px-[calc(100%/16)] lg:pt-24">
        <div className="grid gap-14 lg:grid-cols-[1fr_auto] lg:gap-24">
          {/* Left: the pitch */}
          <div>
            <h2 className="max-w-[16ch] text-[clamp(1.5rem,2.6vw,2rem)] font-semibold leading-[1.15] tracking-[-0.02em]">
              Structure for your team&rsquo;s chaos.
            </h2>
            <p className="mt-4 max-w-[42ch] text-[16px] leading-relaxed text-muted">
              A multi-tenant project board with AI that pulls its weight.
            </p>
          </div>

          {/* Right: link columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:gap-16">
            {groups.map((group) => (
              <div key={group.heading}>
                <p className="mb-5 font-mono text-[12px] uppercase tracking-[0.14em] text-accent">
                  {group.heading}
                </p>
                <ul className="flex flex-col gap-3">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[15px] text-muted transition-colors hover:text-fg"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-16 font-mono text-[12px] uppercase tracking-[0.14em] text-faint lg:text-right">
          © {new Date().getFullYear()} &middot; Kolumna &middot; All rights reserved
        </p>
      </div>

      {/* Oversized wordmark with the logo tile sitting on top of it. */}
      <div className="relative mt-14 lg:mt-20">
        <p
          aria-hidden="true"
          className="select-none text-center text-[19vw] font-semibold leading-[0.78] tracking-[0.01em] text-accent/[0.13]"
        >
          Kolumna.
        </p>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          {/* Square, app-icon shaped. Sized with an inline style rather than
              Tailwind utilities — `aspect-square` and `w-[clamp(...)]` both
              silently generated no CSS here, collapsing the tile to 0x0. */}
          {/* Clicking the tile returns to the top of the page. html has
              scroll-behavior: smooth, so the jump is animated.

              The boundary is an outer ring (box-shadow), not a border: a
              white border on a white tile would be invisible, so it has to
              sit outside the tile where it reads against the dark ground.
              Inline styles because Tailwind kept dropping these utilities. */}
          <a
            href="#top"
            aria-label="Back to top"
            className="grid place-items-center rounded-[22%] bg-[#ffffff] transition-transform duration-300 hover:scale-[1.04]"
            style={{
              width: "clamp(6rem, 12.5vw, 11rem)",
              aspectRatio: "1 / 1",
              boxShadow:
                "0 0 0 8px rgba(255,255,255,0.10), 0 28px 80px -12px rgba(0,0,0,0.7)",
            }}
          >
            {/* The mark is 5:3, so it's sized by width and centred in the
                square rather than filling it. */}
            <LogoMark className="text-bg" style={{ width: "58%" }} />
          </a>
        </div>
      </div>
    </footer>
  );
}
