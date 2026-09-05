import Image from "next/image";
import SplitFlapText from "@/components/SplitFlapText";

// A departure-board strip. Deliberately NOT usage metrics — Kolumna has no
// users yet, and inventing "4,170,903 users" would be fabricating numbers on
// a public page. Cycling status phrases give the same mechanical-board
// effect without claiming anything untrue.
export function StatusBoard() {
  return (
    <section className="relative overflow-hidden bg-bg">
      {/* Decorative pixel-sparkles, placed as-is. */}
      <Image
        src="/star.png"
        alt=""
        aria-hidden="true"
        width={320}
        height={320}
        className="pointer-events-none absolute select-none"
        style={{
          top: "18px",
          right: "28px",
          width: "185px",
          height: "auto",
        }}
      />
      <Image
        src="/star.png"
        alt=""
        aria-hidden="true"
        width={320}
        height={320}
        className="pointer-events-none absolute select-none"
        style={{
          bottom: "18px",
          left: "28px",
          width: "120px",
          height: "auto",
        }}
      />

      {/* Two knobs: paddingTop slides the upper boundary, paddingBottom the
          lower one — change either number to land an edge on a grid line. */}
      <div
        className="px-6 text-center md:px-10"
        style={{ paddingTop: "90px", paddingBottom: "165px" }}
      >
        <h2
          className="mb-3 text-[clamp(2.25rem,4.6vw,3.5rem)] font-medium leading-[1.1] tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span style={{ color: "#fb923c" }}>Always</span>{" "}
          <span style={{ color: "#7dd3fc" }}>in</span>{" "}
          <span style={{ color: "#f9a8d4" }}>motion</span>
        </h2>
        <p className="mb-12 text-[22px] text-muted">
          Cards move, columns fill, work ships.
        </p>

        <div className="mt-6 flex justify-center overflow-x-auto pb-2">
          <SplitFlapText
            words={[
              "DRAG TO MOVE",
              "SYNCED LIVE",
              "COLUMNS SET",
              "AI ASSISTED",
              "SHIP IT",
            ]}
            flipDuration={0.1}
            stagger={0.05}
            cycleDelay={2600}
            charset="alpha"
            flipsPerChar={7}
            tileColor="#171717"
            textColor="#5af7b3"
            tileRadius={2}
            gap={5}
            // clamp() rather than a fixed px: 12 tiles at 44px is ~467px
            // wide, which overflows a phone. This scales the whole board
            // down with the viewport so it never needs sideways swiping.
            fontSize="clamp(20px, 5.6vw, 44px)"
            padTo={12}
            loop
          />
        </div>
      </div>
    </section>
  );
}
