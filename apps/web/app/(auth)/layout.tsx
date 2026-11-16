import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

// Shared chrome for /login, /signup and /invite: one rectangle in the centre
// of the page with the picture as its background and the form on top (no
// card). Hairline guide lines run along the rectangle's edges right across the
// page, crossing at its corners, like the landing page's frame. The page uses
// the picture's own black (#070707, sampled from it) so the two blend.
// public/auth-glow.webp: 2000×1176, free to use per the user (2026-11-11).
const PAGE_BLACK = "#070707";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  // Drawn on top of the picture so they also frame it.
  const line = "pointer-events-none absolute z-10 bg-white/[0.14]";
  return (
    <div
      className="landing app-ui relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-20"
      style={{ background: PAGE_BLACK }}
    >
      <Link
        href="/"
        className="absolute left-5 top-5 z-20 flex items-center gap-1.5 text-[13px] text-[var(--l-muted)] transition-colors hover:text-[var(--l-fg)] md:left-8 md:top-7"
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="relative w-full max-w-[1100px]">
        {/* Guide lines along the top, bottom, left and right edges, extended past the page edges. */}
        <span aria-hidden="true" className={`${line} -left-[100vw] -right-[100vw] top-0 h-px`} />
        <span aria-hidden="true" className={`${line} -left-[100vw] -right-[100vw] bottom-0 h-px`} />
        <span aria-hidden="true" className={`${line} -top-[100vh] -bottom-[100vh] left-0 w-px`} />
        <span aria-hidden="true" className={`${line} -top-[100vh] -bottom-[100vh] right-0 w-px`} />

        <div
          className="relative flex min-h-[640px] w-full items-center justify-center overflow-hidden px-5 py-14"
          style={{ background: PAGE_BLACK }}
        >
          <Image
            src="/auth-glow.webp"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="(min-width: 1100px) 1100px, 100vw"
            className="pointer-events-none select-none object-cover object-center"
          />
          {/* A soft darkening in the middle so the form always reads cleanly. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse 38% 60% at 50% 50%, rgba(0,0,0,0.6), transparent 80%)" }}
          />
          <div className="relative w-full max-w-[380px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
