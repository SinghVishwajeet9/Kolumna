"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/Logo";
import { GooeyButton } from "@/components/marketing/GooeyButton";

// App chrome for the authenticated pages. Same language as the marketing
// nav: dark, thick white bottom rule, LogoMark + wordmark, gooey actions.
export function Header() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-[#ffffff] bg-bg/85 backdrop-blur-xl">
      <div className="flex h-[64px] items-center gap-6 px-6 lg:px-8">
        <Link href="/" className="text-fg">
          <Logo />
        </Link>

        {!loading && (
          <div className="ml-auto flex items-center gap-5">
            {user ? (
              <>
                <span
                  className="hidden text-[14px] text-muted sm:block"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {user.name}
                </span>
                <GooeyButton
                  onClick={() => logout()}
                  className="goo--white flex items-center border border-[#ffffff] px-5 py-2.5 text-[14px] font-medium text-fg"
                  style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
                >
                  Log out
                </GooeyButton>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[15px] text-fg transition-opacity hover:opacity-70"
                >
                  Sign in
                </Link>
                <GooeyButton
                  href="/signup"
                  className="flex items-center bg-[#ffffff] px-6 py-2.5 text-[14px] font-medium text-bg"
                  style={{ borderRadius: "8px", fontFamily: "var(--font-mono)" }}
                >
                  Get started
                </GooeyButton>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
