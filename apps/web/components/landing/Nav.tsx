import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ButtonLink } from "./Frame";

// Sticky, quiet: logo, three in-page links, sign in and the one primary action.
// Every link points at a section that exists on this page.
const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#audit", label: "Audit trail" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--l-line)] bg-[rgba(11,11,12,0.8)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-4 px-5 md:gap-10 md:px-8">
        <Link href="/" className="shrink-0 text-[var(--l-fg)]" aria-label="Kolumna home">
          {/* Full size from tablets up; the regular size on phones so the buttons fit. */}
          <Logo size="lg" className="max-md:hidden" />
          <Logo className="md:hidden" />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[15px] text-[var(--l-muted)] transition-colors hover:text-[var(--l-fg)]">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink href="/login">Sign in</ButtonLink>
          <ButtonLink href="/signup" primary>
            Start free
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
