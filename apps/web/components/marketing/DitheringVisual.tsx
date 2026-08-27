"use client";

import { useEffect, useState } from "react";
import { Dithering } from "@paper-design/shaders-react";

// A full-bleed background layer for the hero, not a boxed panel: an
// animated dither wave along the bottom edge that fades upward into it.
// The hero's copy flows above it in normal document order, so nothing
// fights for space.
export function DitheringVisual() {
  // A WebGL shader animating forever is a real battery cost, and motion
  // like this is exactly what prefers-reduced-motion is for. Freeze it
  // rather than removing it, so the composition still holds.
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* The band itself: bottom-anchored, fading to transparent as it
          rises, so it reads as emerging from the bottom edge of the
          section rather than a discrete shape sitting mid-page. */}
      <div
        className="absolute inset-x-0 bottom-0 overflow-hidden"
        style={{
          height: "30%",
          maskImage: "linear-gradient(to top, black 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 40%, transparent 100%)",
        }}
      >
        {/* Top-anchored within the band (not bottom-anchored): the band
            only shows a small window of this taller-than-itself canvas,
            so which edge it's pinned to decides which slice of the
            pattern shows through. Bottom-anchoring showed the pattern's
            own bottom — its densest, most solid-green part. Anchoring to
            the top instead shows the sparser part near the pattern's own
            top, right where the band's fade already starts. */}
        <div className="absolute inset-x-0 top-0" style={{ height: "220%" }}>
          <Dithering
            style={{ width: "100%", height: "100%" }}
            colorBack="#0d0d0d"
            colorFront="#5af7b3"
            shape="wave"
            type="4x4"
            pxSize={2}
            speed={reduceMotion ? 0 : 0.4}
            scale={1.1}
          />
        </div>
      </div>
    </div>
  );
}
