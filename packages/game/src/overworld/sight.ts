// Trainer sight (design bible "overworld rules"): a trainer sees the tiles straight in front of it, up to its range,
// and only while nothing stands between. Once it spots you it walks up to the tile next to you.

import { DELTA, type Dir } from './direction.js';
import type { Pos } from './map.js';

export interface Watcher extends Pos {
  readonly facing: Dir;
}

/** The `range` tiles in front of the watcher, nearest first. */
export function sightLine(w: Watcher, range: number): Pos[] {
  const { dx, dy } = DELTA[w.facing];
  return Array.from({ length: Math.max(0, range) }, (_, i) => ({ x: w.x + dx * (i + 1), y: w.y + dy * (i + 1) }));
}

/** Whether `target` is in front within `range`, with every tile between them `clear`. */
export function inSight(w: Watcher, range: number, target: Pos, clear: (p: Pos) => boolean): boolean {
  const line = sightLine(w, range);
  const at = line.findIndex((p) => p.x === target.x && p.y === target.y);
  if (at < 0) return false;
  return line.slice(0, at).every(clear);
}

/** The tiles the watcher walks to stand next to `target` (which must be on its sightline). */
export function approachPath(w: Watcher, target: Pos): Pos[] {
  const distance = Math.abs(target.x - w.x) + Math.abs(target.y - w.y);
  return sightLine(w, distance - 1);
}
