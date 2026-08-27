import Image from "next/image";

// Halftone dot band dissolving into an illustrated crowd. Decorative only —
// the whole section is aria-hidden, so both images take an empty alt.
export function CrowdScene() {
  return (
    <section
      aria-hidden="true"
      className="relative overflow-hidden border-b border-line bg-bg"
    >
      {/* Halftone gradient band. Its aspect ratio is preserved rather than
          being stretched — squashing a dot pattern makes the dots visibly
          oval. The max-height only bites on very wide screens, where
          object-bottom crops the sparse top (nearly empty) and keeps the
          dense end that meets the crowd.

          Top masked to transparent: the artwork's black isn't exactly
          #0d0d0d and carries grain, so butting it against the page would
          show a hard horizontal seam. */}
      <div
        className="relative w-full"
        style={{
          aspectRatio: "1759 / 371",
          maxHeight: "180px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 22%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 22%)",
        }}
      >
        <Image
          src="/border.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: "center 80%" }}
        />
      </div>

      {/* object-bottom keeps the crowd planted on the section's bottom edge
          while the empty upper part of the artwork is what gets cropped.
          object-cover means narrow screens crop the sides rather than
          shrinking the figures into illegibility.

          Only a shallow top fade here — it meets the dot band rather than
          the page, and both are the same artwork family, so a long fade
          would read as a gap between them. */}
      <div
        className="relative -mt-px w-full"
        style={{
          height: "clamp(260px, 30vw, 480px)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%)",
        }}
      >
        <Image
          src="/crowd.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </div>
    </section>
  );
}
