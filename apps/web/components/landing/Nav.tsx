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
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-8 px-5 md:px-8">
        <Link href="/" className="text-[var(--l-fg)]" aria-label="Kolumna home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[13px] text-[var(--l-muted)] transition-colors hover:text-[var(--l-fg)]">
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
