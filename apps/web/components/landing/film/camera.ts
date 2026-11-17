// The camera for each shot of the product film (see apps/web/DESIGN-FILM.md).
// A shot is one continuous move from `from` to `to`: a clear travel in one
// direction (down, up, across, diagonal), a slight push in and a degree or two
// of settle, eased in and out. The subject crosses the centre mid-shot. Values are in the
// film's own 1280 × 720 space; ProductFilm scales the whole world to fit.

export type Pose = {
  /** Offset of the plane's centre from the stage centre, px. */
  x: number;
  y: number;
  /** Degrees. */
  rx: number;
  ry: number;
  rz: number;
  scale: number;
};

/** `enter`: where a shot's pieces arrive from, in px before the scene's 3x zoom. */
export type Shot = { from: Pose; to: Pose; enter?: { x: number; y: number } };

/** Seconds each shot holds the screen, and how long two shots overlap. */
export const SHOT_SECONDS = 7;
export const DISSOLVE_SECONDS = 1.1;

// The same slow pace as the first version (about 60 px of travel per 7 s shot),
// but each shot travels one clear way, and the pieces of the scene arrive in
// that same direction (shots.tsx). Scale is about 1 because scenes are drawn at
// 3x (see Scene in shots.tsx): text is rendered at full size, never enlarged.
// Each shot's `enter` is the small offset its pieces arrive from.
export const SHOTS: Shot[] = [
  // 1. The board: the camera moves up the columns; a card landing in review, the
  //    agent's avatar and the progress fill arrive bottom to top.
  {
    from: { x: 18, y: -30, rx: 38, ry: 6, rz: 9, scale: 1.0 },
    to: { x: 30, y: 34, rx: 38, ry: 6, rz: 7.6, scale: 1.06 },
    enter: { x: 0, y: 5 },
  },
  // 2. The workspace: the camera moves down the sidebar; its rows appear one by
  //    one, top to bottom, each wiping in left to right.
  {
    from: { x: 30, y: 34, rx: 36, ry: -5, rz: -8, scale: 1.02 },
    to: { x: 20, y: -30, rx: 36, ry: -5, rz: -6.6, scale: 1.08 },
    enter: { x: 0, y: -5 },
  },
  // 3. A person decides: the camera moves left to right; things arrive left to right, top down.
  {
    from: { x: 64, y: -10, rx: 40, ry: 5, rz: 11, scale: 1.03 },
    to: { x: 2, y: 4, rx: 40, ry: 5, rz: 9.4, scale: 1.1 },
    enter: { x: -5, y: 0 },
  },
  // 4. It is on the record: the camera moves up diagonally; entries arrive bottom to top.
  {
    from: { x: -34, y: -34, rx: 35, ry: -6, rz: -10, scale: 0.98 },
    to: { x: 24, y: 26, rx: 35, ry: -6, rz: -8.5, scale: 1.05 },
    enter: { x: 4, y: 4 },
  },
];

/** A pose as a CSS transform. Every pose uses the same list of functions, so two poses interpolate smoothly. */
export const toTransform = (p: Pose) =>
  `translate(-50%, -50%) translate3d(${p.x}px, ${p.y}px, 0) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${p.rz}deg) scale(${p.scale})`;
