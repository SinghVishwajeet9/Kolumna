// No longer cycles — a single static word, textured with a dot grid and
// clipped to the letterforms so it reads as the same pixelated/dithered
// material as the shader elsewhere on the page, rather than a flat fill.
export function RotatingWord() {
  return (
    <span className="relative inline-block">
      <span
        className="inline-block animate-rise"
        style={{
          backgroundImage:
            "radial-gradient(var(--color-accent) 1.4px, transparent 1.6px)",
          backgroundSize: "4px 4px",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        chaos
      </span>
    </span>
  );
}
