import Link from "next/link";
import { Logo } from "@/components/Logo";
import { NavDropdown } from "./NavDropdown";
import { GooeyButton } from "./GooeyButton";

// Every href here points at a real section on this page — no dead links to
// pages that don't exist yet.
const productItems = [
  { label: "Boards", description: "Lists, cards, and drag-and-drop", href: "#product" },
  { label: "Workspaces", description: "Isolated per team, by default", href: "#product" },
  { label: "Real-time", description: "Live on every open screen", href: "#how" },
  { label: "Ordering", description: "Fractional ranking that scales", href: "#product" },
];

const aiItems = [
  { label: "Epic decomposition", description: "Big card in, subtasks out", href: "#ai" },
  { label: "Duplicate detection", description: "Catches work already logged", href: "#ai" },
];

export function Nav() {
  return (
    // border-[#fff] rather than border-white: Tailwind wasn't emitting a
    // bare `.border-white` rule here, so the border silently fell back to
    // currentColor (#f4f4f4) and looked off-white. An arbitrary value is
    // always generated.
    <header className="sticky top-0 z-50 border-b-2 border-[#ffffff] bg-bg/85 backdrop-blur-xl">
      {/* Left padding only. The CTA has to reach the viewport's right edge,
          so the container can't have right padding to hold it off. */}
      {/* Logo sits near the viewport edge rather than aligned to the content
          frame — same as Render, where the mark hugs the corner. */}
      {/* Bigger gap after the logo than between the nav links themselves, so
          the mark reads as separate from the menu rather than as its first
          item. */}
      <div className="flex h-[76px] items-center gap-14 pl-6 lg:gap-20 lg:pl-8">
        <Link href="/" className="text-fg">
          <Logo />
        </Link>

        <nav className="hidden h-full items-center gap-9 md:flex">
          <NavDropdown label="Product" items={productItems} />
          <a
            href="#how"
            className="text-[17px] text-fg transition-opacity hover:opacity-70"
          >
            How it works
          </a>
          <NavDropdown label="AI" items={aiItems} />
        </nav>

        <div className="ml-auto flex h-full items-center">
          {/* Hidden on the narrowest screens — logo + both actions overflow
              375px, and signup already links to login. */}
          <Link
            href="/login"
            className="hidden px-6 text-[17px] text-fg transition-opacity hover:opacity-70 sm:block sm:leading-[74px]"
          >
            Sign in
          </Link>
          {/* Full nav height + flush right + no radius. That's what turns a
              button into the thick white block anchoring the corner. */}
          <GooeyButton
            href="/signup"
            className="flex h-full items-center bg-[#ffffff] px-5 text-[17px] font-medium text-bg lg:px-8"
          >
            Get started
          </GooeyButton>
        </div>
      </div>
    </header>
  );
}
