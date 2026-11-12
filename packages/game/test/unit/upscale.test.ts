import { describe, expect, it } from 'vitest';
import { FIGURE_FRAME_W, FIGURE_H, figureFrame, figureSheetFrame } from '../../src/overworld/figure-art.js';
import { ART_TILE, lurkTile, TILE, tilePixels, worldTile } from '../../src/overworld/tile-art.js';
import { padWidth, upscaleHalf } from '../../src/overworld/upscale.js';

describe('the x1.5 pixel pattern (16 px placeholder art on 24 px tiles)', () => {
  it('turns each pair of source pixels into three: a a b, in both directions', () => {
    // 2x2 source: a b / c d.
    expect(upscaleHalf(['a', 'b', 'c', 'd'], 2, 2)).toEqual(['a', 'a', 'b', 'a', 'a', 'b', 'c', 'c', 'd']);
  });

  it('keeps every colour and never invents one', () => {
    const src = tilePixels('grass');
    const out = upscaleHalf(src, ART_TILE, ART_TILE);
    expect(out).toHaveLength(24 * 24);
    expect(new Set(out)).toEqual(new Set(src));
  });

  it('the world tiles are 24x24 and the lurker overlay too', () => {
    expect([ART_TILE, TILE]).toEqual([16, 24]);
    expect(worldTile('patch', 1)).toHaveLength(TILE * TILE);
    expect(lurkTile(0)).toHaveLength(TILE * TILE);
  });

  it('figures stand in 24x32 frames, the 16 px figure centred and untouched', () => {
    expect([FIGURE_FRAME_W, FIGURE_H]).toEqual([24, 32]);
    const src = figureFrame('player', 'down', 0);
    const framed = figureSheetFrame('player', 'down', 0);
    expect(framed).toHaveLength(24 * 32);
    expect(padWidth(src, 16, 32, 24)).toEqual(framed);
    for (let y = 0; y < 32; y++) {
      expect(framed.slice(y * 24, y * 24 + 4).every((c) => c === null)).toBe(true);
      expect(framed.slice(y * 24 + 4, y * 24 + 20)).toEqual(src.slice(y * 16, y * 16 + 16));
    }
  });
});
