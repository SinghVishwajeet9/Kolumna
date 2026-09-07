// Hollow squares on the corners of a bordered region — the registration /
// crop-mark device that gives the landing page its "spec sheet" feel. The
// parent needs `position: relative`. Purely decorative.
export function CornerMarks({ accent = false }: { accent?: boolean }) {
  const tone = accent ? "border-accent" : "border-faint";
  return (
    <>
      {[
        "-left-[7px] -top-[7px]",
        "-right-[7px] -top-[7px]",
        "-left-[7px] -bottom-[7px]",
        "-right-[7px] -bottom-[7px]",
      ].map((pos) => (
        <span
          key={pos}
          aria-hidden="true"
          className={`pointer-events-none absolute h-[13px] w-[13px] border bg-bg ${tone} ${pos}`}
          style={{ borderRadius: "3px" }}
        />
      ))}
    </>
  );
}
