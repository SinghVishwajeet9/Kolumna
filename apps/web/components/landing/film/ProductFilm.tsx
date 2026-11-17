"use client";

// The product film: a slow, dim, tilted close-up of Kolumna's own screens on a
// loop. Design and rules: apps/web/DESIGN-FILM.md.
//
// How it's put together, back to front:
//   stage   fills the space it is given, clips, and pauses the film when it can't be seen
//   world   the film's fixed 1280 × 720 space, scaled to fit the stage
//   planes  one per shot: a flat scene whose transform is the camera
//   bands   static blur strips above and below a sharp middle (tilt-shift)
//   vignette
// Only the planes' transform and opacity animate (keyframes "filmShot" in
// globals.css). Every plane runs the same 28 s cycle, started together and
// offset by a delay, so the shots can't drift out of step.

import { useEffect, useRef, type CSSProperties } from "react";
import { DISSOLVE_SECONDS, SHOTS, SHOT_SECONDS, toTransform } from "./camera";
import { SCENES, STILL_SHOT } from "./shots";

const W = 1280;
const H = 720;

const band = (side: "top" | "bottom", size: string, blur: number): CSSProperties => {
  const fade = `linear-gradient(to ${side === "top" ? "bottom" : "top"}, black 0%, black 35%, transparent 100%)`;
  return {
    [side]: 0,
    height: size,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    maskImage: fade,
    WebkitMaskImage: fade,
  };
};

export function ProductFilm() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    // Fit the film's 1280 × 720 space to the stage. On a tall stage (phones)
    // the framing gets tighter rather than smaller, but only up to the point
    // where the subject's words still fit across the stage (width / 960).
    const fit = () => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--k", String(Math.max(r.width / W, Math.min(r.height / H, r.width / 960))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    // Don't run while nobody can see it.
    let onScreen = true;
    const sync = () => el.classList.toggle("film-paused", !onScreen || document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);

    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div
      ref={stage}
      aria-hidden="true"
      // Phones: a 4:5 block under the text. Wider: it fills the hero's right half, whatever its shape.
      className="film relative aspect-[4/5] w-full select-none overflow-hidden bg-[var(--l-bg)] md:aspect-auto md:h-full"
      style={
        {
          "--k": 1,
          "--film-loop": `${SHOTS.length * SHOT_SECONDS}s`,
        } as CSSProperties
      }
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{
          width: W,
          height: H,
          perspective: 1600,
          transform: "translate(-50%, -50%) scale(var(--k))",
        }}
      >
        {SCENES.map((Scene, i) => (
          <div
            key={i}
            className="film-plane absolute left-1/2 top-1/2"
            data-still={i === STILL_SHOT ? "" : undefined}
            style={
              {
                "--from": toTransform(SHOTS[i]!.from),
                "--to": toTransform(SHOTS[i]!.to),
                // Read by the plane and by every piece inside it (globals.css).
                "--shot": `${i * SHOT_SECONDS}s`,
                "--ex": `${SHOTS[i]!.enter?.x ?? 0}px`,
                "--ey": `${SHOTS[i]!.enter?.y ?? 0}px`,
              } as CSSProperties
            }
          >
            <Scene />
          </div>
        ))}
      </div>

      {/* Tilt-shift: only the middle band is sharp. Static, so the browser can cache them. */}
      <div className="pointer-events-none absolute inset-x-0" style={band("top", "46%", 2.5)} />
      <div className="pointer-events-none absolute inset-x-0" style={band("top", "30%", 9)} />
      <div className="pointer-events-none absolute inset-x-0" style={band("bottom", "46%", 2.5)} />
      <div className="pointer-events-none absolute inset-x-0" style={band("bottom", "30%", 9)} />

      {/* The edges dissolve into the page. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 70% at 50% 50%, transparent 42%, var(--l-bg) 96%), linear-gradient(to right, var(--l-bg) 0%, transparent 16%, transparent 84%, var(--l-bg) 100%)",
        }}
      />
    </div>
  );
}

// Timing, as percentages of the loop, for the "filmShot" keyframes in
// globals.css. Kept here so the two stay in step if the numbers change.
export const FILM_TIMING = {
  loop: SHOTS.length * SHOT_SECONDS,
  fadeInEnd: (DISSOLVE_SECONDS / (SHOTS.length * SHOT_SECONDS)) * 100, // 3.93%
  holdEnd: (SHOT_SECONDS / (SHOTS.length * SHOT_SECONDS)) * 100, // 25%
  fadeOutEnd: ((SHOT_SECONDS + DISSOLVE_SECONDS) / (SHOTS.length * SHOT_SECONDS)) * 100, // 28.93%
};
