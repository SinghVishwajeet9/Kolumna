import SplitFlapText from "@/components/SplitFlapText";

// A departure-board strip. Deliberately NOT usage metrics — Kolumna has no
// users yet, and inventing "4,170,903 users" would be fabricating numbers on
// a public page. Cycling status phrases give the same mechanical-board
// effect without claiming anything untrue.
export function StatusBoard() {
  return (
    <section className="relative overflow-hidden bg-bg">
      <div className="px-6 py-24 text-center md:px-10 lg:py-28">
        <h2 className="mb-3 text-[clamp(1.75rem,3.2vw,2.5rem)] font-medium leading-[1.1] tracking-[-0.03em]">
          Always in motion
        </h2>
        <p className="mb-12 text-[17px] text-muted">
          Cards move, columns fill, work ships.
        </p>

        <div className="flex justify-center overflow-x-auto pb-2">
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
