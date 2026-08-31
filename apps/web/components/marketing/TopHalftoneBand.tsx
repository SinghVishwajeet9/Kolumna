import Image from "next/image";

// A thin slice of the same halftone artwork used in CrowdScene
// (border.png), flush against the navbar at the top of the hero —
// object-bottom so the dense, visibly-dotted end of the image shows,
// not the sparse/near-empty top of the artwork.
export function TopHalftoneBand() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
      style={{
        height: "56px",
        maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
      }}
    >
      <Image
        src="/border.png"
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-bottom"
      />
    </div>
  );
}
