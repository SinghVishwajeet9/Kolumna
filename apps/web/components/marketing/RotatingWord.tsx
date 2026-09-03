// A single static word, plain accent green — no dot texture, no clipping.
// id="hero-chaos" is the anchor the loading screen measures: it drops its
// own copy of "chaos" onto this exact spot, so the hand-off from loader to
// hero is invisible. No animate-rise here — the loader owns the reveal, and
// an entrance transform would move the target out from under that measurement.
export function RotatingWord() {
  return (
    <span
      id="hero-chaos"
      className="inline-block text-accent"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      chaos
    </span>
  );
}
