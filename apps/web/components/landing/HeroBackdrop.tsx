import Image from "next/image";

// The hero's backdrop: a soft, grainy white crescent glowing out of black
// (public/hero-glow.webp, 1536×1024, free to use per the user, 2026-11-11).
//
// The picture is already dark and its light sits right of centre, so the white
// headline on the left reads without a heavy scrim: just a light darkening on
// the far left and a fade into the page at the bottom.
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden bg-black">
      <Image
        src="/hero-glow.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 1280px) 1280px, 100vw"
        className="object-cover object-[60%_35%]"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 45%, transparent 70%)" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to bottom, transparent 65%, var(--l-bg) 100%)" }}
      />
    </div>
  );
}
