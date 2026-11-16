"use client";

// Pointer-reactive isometric figures from @lucasmarkes/hairline (MIT,
// https://github.com/lucasmarkes/hairline), themed to the landing panels.
// One per "Agents as teammates" card, drawing only (no labels or captions):
//   Riffle  - a tray of cards, one per agent credential; the one touched stands up.
//   Hub     - agents linked to a hub; the tile touched rises and its link turns solid.
//   Terrain - a field of pillars rising around the pointer.

import type { CSSProperties, ComponentType } from "react";
import { Hub, Riffle, Terrain, type HairlineProps } from "@lucasmarkes/hairline/react";

// Plates are filled with --hairline-plate, so it must match the panel behind them.
// The panels use the page colour (darker than other cards) so the hairlines stand out.
const THEME = {
  "--hairline-plate": "var(--l-bg)",
  "--hairline-hi": "#e4e7ec",
} as CSSProperties;

function HairlineStage({ name, Figure }: { name: string; Figure: ComponentType<HairlineProps> }) {
  return (
    <div
      className="relative flex h-[300px] items-center justify-center overflow-hidden border border-[var(--l-line)] bg-[var(--l-bg)] md:h-[320px]"
      style={{ borderRadius: 8 }}
    >
      {/* `label` is the accessible name only; nothing is drawn as text. */}
      <Figure theme="dark" label={name} className="w-[122%] max-w-[440px] shrink-0" style={THEME} />
    </div>
  );
}

export const IdentityHairline = () => <HairlineStage name="A tray of cards; the one under the pointer stands up" Figure={Riffle} />;
export const AutonomyHairline = () => (
  <HairlineStage name="A hub and its tiles; the tile under the pointer rises and links in" Figure={Hub} />
);
export const ConfidenceHairline = () => <HairlineStage name="Pillars that rise around the pointer" Figure={Terrain} />;
