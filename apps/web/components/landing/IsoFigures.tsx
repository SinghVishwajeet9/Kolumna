// Isometric line drawings for the "Agents as teammates" cards. Our own figures,
// drawn in the style of linear.app's: solid blocks filled with the panel colour
// (so nearer blocks hide farther ones), hairline outlines, bright top edges and
// dim sides. Hovering the card moves parts of the drawing with a slow, springy
// ease (CSS in globals.css under "Isometric figures").

import type { CSSProperties, ReactNode } from "react";

// --- Projection --------------------------------------------------------------
// World x runs to the lower right, y to the lower left, z straight up.
const COS = Math.cos(Math.PI / 6);
const iso = (x: number, y: number, z: number): [number, number] => [(x - y) * COS, (x + y) / 2 - z];
const pts = (list: [number, number, number][]) =>
  list.map(([x, y, z]) => iso(x, y, z).map((n) => n.toFixed(2)).join(",")).join(" ");
/** Screen offset for moving something by (dx, dy, dz) in world space. */
const shift = (dx: number, dy: number, dz: number) => {
  const [x, y] = iso(dx, dy, dz);
  return `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
};

const FILL = "var(--l-panel)";
const TOP = "rgba(208,214,224,0.78)";
const SIDE = "rgba(208,214,224,0.3)";
const FAINT = "rgba(208,214,224,0.16)";
const SW = 0.75;

/** A solid box: its top and the two faces that face the viewer. */
function Box({
  x, y, z, w, d, h, bright = false,
}: { x: number; y: number; z: number; w: number; d: number; h: number; bright?: boolean }) {
  const X = x + w, Y = y + d, Z = z + h;
  const top = pts([[x, y, Z], [X, y, Z], [X, Y, Z], [x, Y, Z]]);
  const right = pts([[X, y, z], [X, Y, z], [X, Y, Z], [X, y, Z]]);
  const left = pts([[x, Y, z], [X, Y, z], [X, Y, Z], [x, Y, Z]]);
  const sideStroke = bright ? TOP : SIDE;
  return (
    <g strokeLinejoin="round" strokeWidth={SW}>
      <polygon points={right} fill={FILL} stroke={sideStroke} />
      <polygon points={left} fill={FILL} stroke={sideStroke} />
      <polygon points={top} fill={FILL} stroke={TOP} className="iso-edge" />
    </g>
  );
}

/** A circle lying flat at height z. */
function FlatCircle({ cx, cy, z, r, dashed = false }: { cx: number; cy: number; z: number; r: number; dashed?: boolean }) {
  const [sx, sy] = iso(cx, cy, z);
  return (
    <ellipse
      cx={sx} cy={sy} rx={r * Math.SQRT2 * COS} ry={r * Math.SQRT2 * 0.5}
      fill="none" stroke={dashed ? FAINT : TOP} strokeWidth={SW} strokeDasharray={dashed ? "2 2" : undefined}
    />
  );
}

/** A straight line between two world points. */
function Line({ a, b, stroke = SIDE, dashed = false }: { a: [number, number, number]; b: [number, number, number]; stroke?: string; dashed?: boolean }) {
  const [x1, y1] = iso(...a);
  const [x2, y2] = iso(...b);
  return (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={SW} strokeLinecap="round"
      strokeDasharray={dashed ? "2 2.5" : undefined} />
  );
}

/** A group that slides by `to` (a CSS transform) while its card is hovered. */
function Move({ to, delay = 0, children }: { to: string; delay?: number; children: ReactNode }) {
  return (
    <g className="iso-move" style={{ "--to": to, "--delay": `${delay}s` } as CSSProperties}>
      {children}
    </g>
  );
}

function Figure({ label, viewBox, children }: { label: string; viewBox: string; children: ReactNode }) {
  return (
    <div
      className="relative flex h-[300px] items-center justify-center overflow-hidden border border-[var(--l-line)] bg-[var(--l-panel)] md:h-[320px]"
      style={{ borderRadius: 8 }}
    >
      <span className="absolute left-4 top-3.5 font-mono text-[10.5px] tracking-[0.08em] text-[var(--l-faint)]">{label}</span>
      <svg viewBox={viewBox} className="h-auto w-[86%] max-w-[330px] overflow-visible" aria-hidden="true" fill="none">
        {children}
      </svg>
    </div>
  );
}

// --- FIG 0.1  Its own identity -------------------------------------------------
// A workspace plate with three scope tiles; the agent's ID badge floats above
// its dashed footprint. On hover the badge rises and the scopes step up.
export function IdentityFigure() {
  const tiles = [8, 38, 68];
  return (
    <Figure label="FIG 0.1" viewBox="-98 -46 196 154">
      <Box x={0} y={0} z={0} w={100} d={100} h={6} />
      {/* Footprint of the badge on the plate */}
      <polygon
        points={pts([[22, 14, 6], [78, 14, 6], [78, 56, 6], [22, 56, 6]])}
        fill="none" stroke={FAINT} strokeWidth={SW} strokeDasharray="2 2.5"
      />
      {tiles.map((x, i) => (
        <Move key={x} to={shift(0, 0, 5)} delay={0.08 + i * 0.06}>
          <Box x={x} y={70} z={6} w={24} d={18} h={5} />
        </Move>
      ))}
      <Move to={shift(0, 0, 14)}>
        <Box x={22} y={14} z={36} w={56} d={42} h={7} bright />
        <FlatCircle cx={38} cy={35} z={43} r={9} />
        <Line a={[54, 28, 43]} b={[70, 28, 43]} stroke={TOP} />
        <Line a={[54, 35, 43]} b={[66, 35, 43]} />
        <Line a={[54, 42, 43]} b={[68, 42, 43]} />
      </Move>
    </Figure>
  );
}

// --- FIG 0.2  Autonomy you set -------------------------------------------------
// Three steps for suggest only / act with approval / act on its own. The agent
// (a small cube) climbs from the first step to the second on hover.
export function AutonomyFigure() {
  // Back (tallest) to front (lowest), drawn in that order.
  const steps = [
    { x: 0, h: 50 },
    { x: 40, h: 32 },
    { x: 80, h: 14 },
  ];
  return (
    <Figure label="FIG 0.2" viewBox="-46 -62 156 150">
      {steps.map((s, i) => (
        <Move key={s.x} to={shift(0, 0, 3)} delay={0.12 * (2 - i)}>
          <Box x={s.x} y={0} z={0} w={36} d={40} h={s.h} />
          <FlatCircle cx={s.x + 18} cy={20} z={s.h} r={4} dashed />
        </Move>
      ))}
      <Move to={shift(-40, 0, 18 + 3)} delay={0.05}>
        <Box x={92} y={12} z={14} w={14} d={14} h={14} bright />
      </Move>
    </Figure>
  );
}

// --- FIG 0.3  Confidence gates -------------------------------------------------
// A track running through a gate. On hover the confident change passes through
// the gate; the unsure one moves up to it and stops.
export function ConfidenceFigure() {
  return (
    <Figure label="FIG 0.3" viewBox="-74 -8 198 132">
      <Box x={0} y={30} z={0} w={160} d={40} h={4} />
      {/* Threshold line across the track under the gate */}
      <Line a={[94, 30, 4]} b={[94, 70, 4]} stroke={FAINT} dashed />
      {/* Far pillar (behind the cubes) */}
      <Box x={90} y={24} z={4} w={8} d={6} h={46} />
      {/* Unsure change: stops just short of the gate */}
      <Move to={shift(34, 0, 0)} delay={0.06}>
        <Box x={14} y={42} z={4} w={16} d={16} h={16} />
      </Move>
      {/* Confident change: goes through */}
      <Move to={shift(70, 0, 0)}>
        <Box x={50} y={42} z={4} w={16} d={16} h={16} bright />
      </Move>
      {/* Near pillar and crossbar (in front) */}
      <Box x={90} y={70} z={4} w={8} d={6} h={46} />
      <Box x={90} y={24} z={50} w={8} d={52} h={6} />
    </Figure>
  );
}
