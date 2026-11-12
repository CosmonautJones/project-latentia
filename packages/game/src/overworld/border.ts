// The scenery around an area, pure: BORDER tiles on every side, so the camera never shows past a map's edge (it
// centres a map smaller than the view, and at an edge half the view can lie outside). Outdoors the edge scenery goes
// on (each border tile repeats the nearest edge tile when that is a tree, grass or path); indoors, and next to any
// building tile, it is the void, so a room sits in the dark instead of in endless walls.

import { TILE } from './tile.js';
import type { Area, TileKind } from './map.js';
import { LONG_SIDE } from '../layout/viewport.js';

/** Tiles of border on each side: half the longest logical view, rounded up. */
export const BORDER = Math.ceil(LONG_SIDE.max / 2 / TILE);

const CARRIES_ON: ReadonlySet<TileKind> = new Set<TileKind>(['tree', 'oldTree', 'grass', 'path']);

/** The area's tiles, row by row, with BORDER tiles of scenery around them. */
export function borderedTiles(area: Area): TileKind[][] {
  const clamp = (v: number, n: number) => Math.min(n - 1, Math.max(0, v));
  return Array.from({ length: area.height + 2 * BORDER }, (_, by) =>
    Array.from({ length: area.width + 2 * BORDER }, (_, bx) => {
      const x = bx - BORDER;
      const y = by - BORDER;
      const kind = area.tiles[clamp(y, area.height) * area.width + clamp(x, area.width)] ?? 'void';
      const inside = x >= 0 && y >= 0 && x < area.width && y < area.height;
      return inside || CARRIES_ON.has(kind) ? kind : 'void';
    }),
  );
}
