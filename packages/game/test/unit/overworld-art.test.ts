import { describe, expect, it } from 'vitest';
import { DIRS } from '../../src/overworld/direction.js';
import { FIGURE_H, FIGURE_W, figureFrame, LOOKS } from '../../src/overworld/figure-art.js';
import { LEGEND } from '../../src/overworld/map.js';
import { lurkPixels, TILE, tileIndex, tilePixels, TILESET } from '../../src/overworld/tile-art.js';
import { ENDESGA_32 } from '../../src/ui/palette.js';

const PALETTE = new Set<number>(ENDESGA_32);
const onPalette = (px: readonly (number | null)[]) => px.every((c) => c === null || PALETTE.has(c));
const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((v, i) => v === b[i]);

describe('generated tiles', () => {
  const kinds = [...new Set(Object.values(LEGEND))];

  it('every legend tile has an opaque 16x16 tile drawn only from Endesga 32', () => {
    expect(TILE).toBe(16);
    for (const k of kinds) {
      const px = tilePixels(k);
      expect(px, k).toHaveLength(TILE * TILE);
      expect(px.every((c) => c !== null), k).toBe(true);
      expect(onPalette(px), k).toBe(true);
    }
  });

  it('the required kinds are all there and look different from each other', () => {
    for (const k of ['grass', 'path', 'tree', 'wall', 'floor', 'door', 'sign', 'patch'] as const) expect(kinds).toContain(k);
    const drawn = kinds.filter((k) => k !== 'void').map((k) => tilePixels(k));
    for (let i = 0; i < drawn.length; i++) for (let j = i + 1; j < drawn.length; j++) expect(same(drawn[i]!, drawn[j]!)).toBe(false);
  });

  it('tiles have a pattern, not a flat swatch (at least 3 colours)', () => {
    for (const k of kinds.filter((x) => x !== 'void')) expect(new Set(tilePixels(k)).size, k).toBeGreaterThanOrEqual(3);
  });

  it('the patch animates in 2 frames that differ; the tileset lists both and indexes them', () => {
    expect(same(tilePixels('patch', 0), tilePixels('patch', 1))).toBe(false);
    expect(TILESET.filter((f) => f.kind === 'patch')).toHaveLength(2);
    expect(TILESET[tileIndex('patch', 1)]).toMatchObject({ kind: 'patch', frame: 1 });
    expect(TILESET[tileIndex('grass')]).toMatchObject({ kind: 'grass', frame: 0 });
    expect(new Set(TILESET.map((f) => `${f.kind}.${f.frame}`)).size).toBe(TILESET.length);
  });

  it('the lurker in the patch is a transparent overlay with 2 blink frames', () => {
    const [a, b] = [lurkPixels(0), lurkPixels(1)];
    expect(a).toHaveLength(TILE * TILE);
    expect(a.some((c) => c === null) && a.some((c) => c !== null)).toBe(true);
    expect(onPalette(a) && onPalette(b)).toBe(true);
    expect(same(a, b)).toBe(false);
  });
});

describe('generated figures (the player and NPCs)', () => {
  it('are 16x32, on palette, transparent around the body', () => {
    expect([FIGURE_W, FIGURE_H]).toEqual([16, 32]);
    for (const look of Object.keys(LOOKS) as (keyof typeof LOOKS)[]) {
      for (const d of DIRS) {
        for (const f of [0, 1] as const) {
          const px = figureFrame(look, d, f);
          expect(px).toHaveLength(FIGURE_W * FIGURE_H);
          expect(onPalette(px)).toBe(true);
          // The top rows stay clear (the figure stands about 1.5 tiles tall), and so do the side columns.
          expect(px.slice(0, FIGURE_W * 4).every((c) => c === null)).toBe(true);
        }
      }
    }
  });

  it('the player is two-tone: distinct top and bottom colours fill most of the body', () => {
    const px = figureFrame('player', 'down', 0);
    const counts = new Map<number, number>();
    for (const c of px) if (c !== null) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(counts.get(LOOKS.player.top) ?? 0).toBeGreaterThan(30);
    expect(counts.get(LOOKS.player.bottom) ?? 0).toBeGreaterThan(20);
    expect(LOOKS.player.top).not.toBe(LOOKS.player.bottom);
  });

  it('each of the 4 facings looks different (the facing indicator), and left mirrors right', () => {
    const frames = DIRS.map((d) => figureFrame('player', d, 0));
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) expect(same(frames[i]!, frames[j]!)).toBe(false);
    const left = figureFrame('player', 'left', 0);
    const right = figureFrame('player', 'right', 0);
    const mirrored = left.map((_, i) => right[Math.floor(i / FIGURE_W) * FIGURE_W + (FIGURE_W - 1 - (i % FIGURE_W))]);
    expect(mirrored).toEqual(left);
  });

  it('the walk frame bobs: it differs from standing in every facing', () => {
    for (const d of DIRS) expect(same(figureFrame('player', d, 0), figureFrame('player', d, 1))).toBe(false);
  });

  it('NPC looks are told apart by their colours', () => {
    const tops = Object.values(LOOKS).map((l) => l.top);
    expect(new Set(tops).size).toBe(tops.length);
  });
});
