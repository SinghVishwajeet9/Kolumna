// FALLBACK: the first version of the product film's camera (2026-11-17), kept
// unchanged in case we want to go back to it. A slight push in and a short
// constant-speed drift per shot. See ../README note in DESIGN-FILM.md.

import type { Shot } from "../camera";

export const SHOT_SECONDS = 7;

export const SHOTS: Shot[] = [
  { from: { x: 60, y: 46, rx: 38, ry: 6, rz: 9, scale: 3.0 }, to: { x: 10, y: 6, rx: 38, ry: 6, rz: 7.6, scale: 3.18 } },
  { from: { x: -6, y: 20, rx: 36, ry: -5, rz: -8, scale: 3.05 }, to: { x: 52, y: 2, rx: 36, ry: -5, rz: -6.6, scale: 3.25 } },
  { from: { x: 10, y: -30, rx: 40, ry: 5, rz: 11, scale: 3.1 }, to: { x: 58, y: 6, rx: 40, ry: 5, rz: 9.4, scale: 3.3 } },
  { from: { x: 54, y: 8, rx: 35, ry: -6, rz: -10, scale: 2.95 }, to: { x: -6, y: -4, rx: 35, ry: -6, rz: -8.5, scale: 3.15 } },
];
