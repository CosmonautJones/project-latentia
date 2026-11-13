// The overworld camera, pure: it follows the player with a small deadzone (design bible: 2x1 tiles) and integer
// scroll, clamped to the map; a map smaller than the screen is centred instead.
// - `focus` is the part of the view the touch controls leave uncovered (the layout's safe area): the player is
//   centred in it, not in the whole view, and the clamp lets it reach the map's edges, so the player is never walking
//   under the D-pad or A/B (review I-1). Past the map's edge, under the controls, is the backdrop. Without a focus,
//   the whole view is the focus.

import type { Pos } from './map.js';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface CameraBox {
  readonly view: Size;
  readonly map: Size;
  readonly deadzone: Size;
  /** The uncovered part of the view, in view px (default: all of it). */
  readonly focus?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

/** One axis of the focus: its offset in the view and its length. */
interface Span {
  readonly at: number;
  readonly len: number;
}

const spans = (b: CameraBox): { x: Span; y: Span } => {
  const f = b.focus ?? { x: 0, y: 0, ...b.view };
  return { x: { at: f.x, len: f.width }, y: { at: f.y, len: f.height } };
};

function clampAxis(scroll: number, view: number, map: number, f: Span): number {
  // A map that fits the view and the focus is centred in the focus; else the focus may run to either map edge.
  if (map <= f.len) return Math.floor((map - f.len) / 2) - f.at;
  return Math.min(Math.max(Math.min(0, 0 - f.at), Math.round(scroll)), Math.max(map - view, map - f.at - f.len));
}

const clamp = (p: Pos, b: CameraBox): Pos => {
  const f = spans(b);
  return { x: clampAxis(p.x, b.view.width, b.map.width, f.x), y: clampAxis(p.y, b.view.height, b.map.height, f.y) };
};

/** Centre on `target` (a pixel point, e.g. the player's middle) in the focus, clamped. */
export function cameraSnap(target: Pos, b: CameraBox): Pos {
  const f = spans(b);
  return clamp({ x: target.x - f.x.at - f.x.len / 2, y: target.y - f.y.at - f.y.len / 2 }, b);
}

function followAxis(scroll: number, target: number, f: Span, dead: number): number {
  const lo = scroll + f.at + (f.len - dead) / 2;
  const hi = lo + dead;
  if (target < lo) return scroll + (target - lo);
  if (target > hi) return scroll + (target - hi);
  return scroll;
}

/** Move the camera just enough to keep `target` inside the deadzone around the focus's centre, clamped. */
export function cameraFollow(scroll: Pos, target: Pos, b: CameraBox): Pos {
  const f = spans(b);
  return clamp({ x: followAxis(scroll.x, target.x, f.x, b.deadzone.width), y: followAxis(scroll.y, target.y, f.y, b.deadzone.height) }, b);
}
