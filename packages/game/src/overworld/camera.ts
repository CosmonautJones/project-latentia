// The overworld camera, pure: it follows the player with a small deadzone (design bible: 2x1 tiles) and integer
// scroll, clamped to the map; a map smaller than the screen is centred instead.

import type { Pos } from './map.js';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface CameraBox {
  readonly view: Size;
  readonly map: Size;
  readonly deadzone: Size;
}

function clampAxis(scroll: number, view: number, map: number): number {
  if (map <= view) return Math.floor((map - view) / 2);
  return Math.min(Math.max(0, Math.round(scroll)), map - view);
}

const clamp = (p: Pos, b: CameraBox): Pos => ({ x: clampAxis(p.x, b.view.width, b.map.width), y: clampAxis(p.y, b.view.height, b.map.height) });

/** Centre on `target` (a pixel point, e.g. the player's middle), clamped. */
export function cameraSnap(target: Pos, b: CameraBox): Pos {
  return clamp({ x: target.x - b.view.width / 2, y: target.y - b.view.height / 2 }, b);
}

function followAxis(scroll: number, target: number, view: number, dead: number): number {
  const lo = scroll + (view - dead) / 2;
  const hi = lo + dead;
  if (target < lo) return scroll + (target - lo);
  if (target > hi) return scroll + (target - hi);
  return scroll;
}

/** Move the camera just enough to keep `target` inside the deadzone around the screen's centre, clamped. */
export function cameraFollow(scroll: Pos, target: Pos, b: CameraBox): Pos {
  return clamp(
    { x: followAxis(scroll.x, target.x, b.view.width, b.deadzone.width), y: followAxis(scroll.y, target.y, b.view.height, b.deadzone.height) },
    b,
  );
}
