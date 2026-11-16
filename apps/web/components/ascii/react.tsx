"use client";

import { useEffect, useRef } from "react";
import type { AnimalKey } from "./animals";
import { AnimalEngine } from "./engine";
import type { Theme } from "./renderer";

/** Glyphs come from the canvas's font-family, so give it (or a parent) a monospace font. */
export function AsciiAnimals({
  className,
  animal = "butterflies",
  count,
  theme = "light",
}: { className?: string; animal?: AnimalKey; count?: number; theme?: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AnimalEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new AnimalEngine(canvas, { animal, count, theme });
    engineRef.current = engine;
    return () => engine.destroy();
    // The population size is fixed for the life of the canvas; animal and theme changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (engine && engine.animal.key !== animal) engine.setAnimal(animal);
  }, [animal]);

  useEffect(() => {
    engineRef.current?.setTheme(theme);
  }, [theme]);

  return <canvas ref={canvasRef} aria-hidden="true" className={`ascii-animals ${className ?? ""}`} />;
}
