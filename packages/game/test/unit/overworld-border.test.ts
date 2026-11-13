import { describe, expect, it } from 'vitest';
import { LOCALHOST } from '../../src/content/maps/localhost.js';
import { BORDER, borderedTiles } from '../../src/overworld/border.js';
import { LONG_SIDE } from '../../src/layout/viewport.js';
import { TILE } from '../../src/overworld/tile.js';

describe('the scenery border around an area', () => {
  const outside = LOCALHOST.areas['outside']!;
  const lab = LOCALHOST.areas['lab']!;

  it('is wide enough that a view of any V16 size never sees past it, wherever the camera is', () => {
    // The camera clamps to the map, or centres a smaller one: at most half the view shows beyond an edge.
    expect(BORDER * TILE).toBeGreaterThanOrEqual(LONG_SIDE.max / 2);
  });

  it('keeps the area as is in the middle', () => {
    const rows = borderedTiles(outside);
    expect(rows).toHaveLength(outside.height + 2 * BORDER);
    for (let y = 0; y < outside.height; y++) {
      expect(rows[y + BORDER]?.slice(BORDER, BORDER + outside.width)).toEqual(outside.tiles.slice(y * outside.width, (y + 1) * outside.width));
    }
  });

  it('outdoors, the edge scenery goes on: trees past the tree line, autumn trees past the forest, the east path out', () => {
    const rows = borderedTiles(outside);
    expect(rows[0]?.[0]).toBe('tree');
    expect(rows[0]?.at(-1)).toBe('oldTree');
    expect(rows.at(-1)?.[BORDER + 5]).toBe('tree');
    // The trailhead's path leaves the map east on row 6, and carries on into the border.
    expect(rows[BORDER + 6]?.at(-1)).toBe('path');
    // Nothing walkable-looking but that path and the scenery: no walls, roofs or doors repeat.
    const kinds = new Set(rows.flatMap((r, y) => r.filter((_, x) => x < BORDER || x >= BORDER + outside.width || y < BORDER || y >= BORDER + outside.height)));
    expect([...kinds].sort()).toEqual(['oldTree', 'path', 'tree']);
  });

  it('indoors, the room sits in the dark (no endless walls)', () => {
    const rows = borderedTiles(lab);
    expect(rows[0]?.every((k) => k === 'void')).toBe(true);
    expect(rows[BORDER + 3]?.[0]).toBe('void');
    expect(rows[BORDER + 3]?.[BORDER]).toBe('wall');
  });
});
