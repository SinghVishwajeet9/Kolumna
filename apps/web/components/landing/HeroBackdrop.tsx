import Image from "next/image";

// Behind the hero's left side: the grainy white crescent
// (public/hero-glow.webp, 1536×1024, free to use per the user, 2026-11-11),
// mirrored so its light faces in from the left edge of the screen, and faded
// out toward the right so it stays on the left only.
//
// Knobs to adjust it:
//   WIDTH    how far from the left edge it reaches
//   OPACITY  how bright it is
//   POSITION which part of the picture shows (x% y%)
//   SHIFT    moves the whole picture up and left
//   FADE     where it fades out toward the right (as % of WIDTH)
const WIDTH = "62%";
const OPACITY = 0.4;
const POSITION = "38% 40%";
/** Moves the whole picture: up (y) and left (x), as % of the area. */
const SHIFT = { x: 0, y: 0 };
const FADE = 72;

export function HeroBackdrop() {
  const mask = `linear-gradient(to right, black 0%, black ${FADE - 30}%, transparent ${FADE}%), linear-gradient(to bottom, transparent 0%, black 12%, black 85%, transparent 100%)`;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden"
      style={{
        width: WIDTH,
        maskImage: mask,
        WebkitMaskImage: mask,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    >
      <div
        className="absolute"
        style={{ top: `-${SHIFT.y}%`, bottom: `${SHIFT.y}%`, left: `-${SHIFT.x}%`, right: `${SHIFT.x}%` }}
      >
      <Image
        src="/hero-glow.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 62vw, 100vw"
        // Mirrored: the picture's light sits right of centre, so flipping it puts the light on the left.
        className="-scale-x-100 object-cover"
        style={{ opacity: OPACITY, objectPosition: POSITION }}
      />
      </div>
    </div>
  );
}
