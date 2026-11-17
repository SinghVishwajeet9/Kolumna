"use client";

// A crowd of people walking left and right along the bottom of a strip.
// Adapted from Skiper UI's "Skiper 39" (Canvas_Landing_004, by @gurvinder-singh02,
// https://gxuri.me), itself inspired by https://codepen.io/zadvorsky/pen/xxwbBQV.
// Illustrations: Open Peeps (https://www.openpeeps.com/, CC0).
// Changes: sized to its parent instead of the viewport, people scaled to the strip
// height, a ResizeObserver instead of window resize, paused while off-screen,
// static under prefers-reduced-motion, no label text.

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

// Sprite sheet: 15 columns × 7 rows of people, black outlines with white fills.
const PEEPS_SRC =
  "https://cdn.21st.dev/assets/localized/abdb8990a7bef8c2f5af3e45f0a3c969c4b0603fba8be92e81347de4ea4e1ed7.png";

type Peep = {
  rect: [number, number, number, number];
  width: number;
  height: number;
  x: number;
  y: number;
  anchorY: number;
  scaleX: number;
  walk: gsap.core.Timeline | null;
};

export function CrowdCanvas({
  src = PEEPS_SRC,
  rows = 15,
  cols = 7,
  peepHeight = 0.8,
  density = 1,
  className = "",
}: {
  src?: string;
  rows?: number;
  cols?: number;
  /** Tallest person as a fraction of the strip height. */
  peepHeight?: number;
  /** Share of the sprite sheet's people on screen at once, 0 to 1. Lower leaves gaps between walkers. */
  density?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const pickIndex = (arr: unknown[]) => Math.floor(rand(0, arr.length));

    const img = new Image();
    const stage = { width: 0, height: 0, dpr: 1, scale: 1 };
    const allPeeps: Peep[] = [];
    const available: Peep[] = [];
    const crowd: Peep[] = [];
    let ready = false;
    let visible = true;

    const resetPeep = (peep: Peep) => {
      const direction = Math.random() > 0.5 ? 1 : -1;
      // Spread people over a band near the bottom so the crowd has depth.
      const offsetY = (40 - 100 * gsap.parseEase("power2.in")(Math.random())) * stage.scale;
      const startY = stage.height - peep.height * 0.85 + offsetY;
      const startX = direction === 1 ? -peep.width : stage.width + peep.width;
      const endX = direction === 1 ? stage.width : 0;
      peep.scaleX = direction;
      peep.x = startX;
      peep.y = startY;
      peep.anchorY = startY;
      return { startY, endX };
    };

    const addPeep = (): Peep => {
      const peep = available.splice(pickIndex(available), 1)[0];
      const { startY, endX } = resetPeep(peep);
      const xDuration = 10;
      const yDuration = 0.25;
      const tl = gsap.timeline({ paused: reduceMotion || !visible });
      // Leisurely pace: about half the original speed (originally 0.5–1.5).
      tl.timeScale(rand(0.3, 0.7));
      tl.to(peep, { duration: xDuration, x: endX, ease: "none" }, 0);
      tl.to(peep, { duration: yDuration, repeat: xDuration / yDuration, yoyo: true, y: startY - 6 * stage.scale }, 0);
      tl.eventCallback("onComplete", () => {
        crowd.splice(crowd.indexOf(peep), 1);
        available.push(peep);
        addPeep();
      });
      peep.walk = tl;
      crowd.push(peep);
      crowd.sort((a, b) => a.anchorY - b.anchorY);
      return peep;
    };

    const render = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(stage.dpr, stage.dpr);
      for (const p of crowd) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.scaleX, 1);
        ctx.drawImage(img, ...p.rect, 0, 0, p.width, p.height);
        ctx.restore();
      }
    };

    const layout = () => {
      if (!ready) return;
      stage.width = canvas.clientWidth;
      stage.height = canvas.clientHeight;
      stage.dpr = window.devicePixelRatio || 1;
      canvas.width = stage.width * stage.dpr;
      canvas.height = stage.height * stage.dpr;

      const cellH = img.naturalHeight / cols;
      stage.scale = (stage.height * peepHeight) / cellH;
      for (const p of allPeeps) {
        p.width = p.rect[2] * stage.scale;
        p.height = p.rect[3] * stage.scale;
      }

      for (const p of crowd) p.walk?.kill();
      crowd.length = 0;
      available.length = 0;
      available.push(...allPeeps);
      // Only some of the people walk at once. The rest wait their turn: when one
      // leaves, addPeep() picks the next at random, so the count stays the same.
      const count = Math.max(1, Math.round(allPeeps.length * Math.min(1, Math.max(0, density))));
      for (let i = 0; i < count && available.length; i++) addPeep().walk?.progress(Math.random());
      render();
    };

    const onLoad = () => {
      const w = img.naturalWidth / rows;
      const h = img.naturalHeight / cols;
      for (let i = 0; i < rows * cols; i++) {
        allPeeps.push({
          rect: [(i % rows) * w, Math.floor(i / rows) * h, w, h],
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          anchorY: 0,
          scaleX: 1,
          walk: null,
        });
      }
      ready = true;
      layout();
      if (!reduceMotion) gsap.ticker.add(render);
    };

    img.onload = onLoad;
    img.src = src;

    const ro = new ResizeObserver(layout);
    ro.observe(canvas);

    // Don't animate while the strip is off-screen.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (reduceMotion) return;
      for (const p of crowd) {
        if (visible) p.walk?.play();
        else p.walk?.pause();
      }
    });
    io.observe(canvas);

    return () => {
      img.onload = null;
      ro.disconnect();
      io.disconnect();
      gsap.ticker.remove(render);
      for (const p of crowd) p.walk?.kill();
    };
  }, [src, rows, cols, peepHeight, density]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`block h-full w-full ${className}`} />;
}
