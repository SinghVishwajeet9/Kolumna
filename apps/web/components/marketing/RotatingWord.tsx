// A single static word, plain accent green — no dot texture, no clipping.
export function RotatingWord() {
  return (
    <span
      className="inline-block animate-rise text-accent"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      chaos
    </span>
  );
}
