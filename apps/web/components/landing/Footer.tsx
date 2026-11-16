import Link from "next/link";
import { Logo } from "@/components/Logo";
import { pad } from "./Frame";
import { grain } from "./grain";

// Only links that go somewhere real: sections on this page, the app's own
// pages, and the source.
const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Features", href: "#features" },
      { label: "Audit trail", href: "#audit" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Start free", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Project",
    links: [{ label: "GitHub", href: "https://github.com/SinghVishwajeet9/Kolumna" }],
  },
];

const FINE = grain(220, 1.15, 18, -12.2);
const SPARSE = grain(320, 0.75, 30, -24);

// Grainy white dust rising from the bottom of the footer: densest at the very
// bottom, thinning out as it rises (echoing the particles in the hero and CTA
// pictures). CSS only, no image.
function FooterDust() {
  // A straight fade upward from the bottom edge (no glow, no rounded shape).
  const fade = (height: string) => {
    const m = `linear-gradient(to top, black, transparent ${height})`;
    return { maskImage: m, WebkitMaskImage: m };
  };
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[140px] overflow-hidden">
      {/* fine, dense grain near the bottom */}
      <div className="absolute inset-0 opacity-25" style={{ backgroundImage: FINE, ...fade("70%") }} />
      {/* sparser specks drifting higher */}
      <div className="absolute inset-0 opacity-35" style={{ backgroundImage: SPARSE, ...fade("100%") }} />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative">
      <FooterDust />
    <div className={`relative grid gap-10 pt-12 pb-20 md:grid-cols-[1.4fr_repeat(3,1fr)] md:pt-14 md:pb-24 ${pad}`}>
      <div>
        <Logo className="text-[var(--l-fg)]" />
        <p className="mt-4 max-w-[30ch] text-[14px] leading-[22px] text-[var(--l-faint)]">
          Let AI agents work on your board, safely.
        </p>
      </div>
      {COLUMNS.map((col) => (
        <div key={col.title}>
          <p className="mb-3 text-[13px] font-medium text-[var(--l-fg)]">{col.title}</p>
          <ul className="flex flex-col">
            {col.links.map((l) => (
              <li key={l.label}>
                {l.href.startsWith("/") ? (
                  <Link href={l.href} className="inline-block py-2 text-[14px] text-[var(--l-muted)] hover:text-[var(--l-fg)]">
                    {l.label}
                  </Link>
                ) : (
                  <a
                    href={l.href}
                    {...(l.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="inline-block py-2 text-[14px] text-[var(--l-muted)] hover:text-[var(--l-fg)]"
                  >
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-[12px] text-[var(--l-faint)] md:col-span-4">© 2026 Kolumna · Beta</p>
    </div>
    </footer>
  );
}
