import { SPECIES_IDS } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { FABLE_SHEETS, placeholderArt, PLACEHOLDER_FRAMES } from '../../src/battle/creature-art.js';
import { ENDESGA_32 } from '../../src/ui/palette.js';

describe('Fable starter sheets', () => {
  it('cover the three starters at the bible frame timing (6 frames of 64×64; Blitzr faster)', () => {
    expect(Object.keys(FABLE_SHEETS).sort()).toEqual(['blitzr', 'forkling', 'sagelet']);
    for (const s of Object.values(FABLE_SHEETS)) expect(s).toMatchObject({ frames: 6, frameSize: 64 });
    expect(FABLE_SHEETS.sagelet.frameMs).toBe(100);
    expect(FABLE_SHEETS.forkling.frameMs).toBe(100);
    expect(FABLE_SHEETS.blitzr.frameMs).toBe(75);
  });
});

describe('placeholder creature art', () => {
  const palette = new Set<number>(ENDESGA_32);

  it.each(SPECIES_IDS.filter((s) => !(s in FABLE_SHEETS)).map((s) => [s] as const))('%s: a 64×64 Endesga 32 silhouette, deterministic', (species) => {
    const a = placeholderArt(species);
    expect(a.size).toBe(64);
    expect(a.frames).toHaveLength(PLACEHOLDER_FRAMES);
    for (const frame of a.frames) {
      expect(frame).toHaveLength(64 * 64);
      for (const px of frame) if (px !== null) expect(palette.has(px)).toBe(true);
      // Transparent corners: a rounded silhouette, not a box.
      expect(frame[0]).toBeNull();
      expect(frame[63]).toBeNull();
      expect(frame[64 * 63]).toBeNull();
      // A body of roughly the bible's ~40×40 first-stage size.
      expect(frame.filter((p) => p !== null).length).toBeGreaterThan(700);
    }
    expect(placeholderArt(species)).toEqual(a);
  });

  it('is filled with the type colour and carries the species initial', () => {
    const a = placeholderArt('nullbeetle');
    const frame = a.frames[0] ?? [];
    const count = (c: number) => frame.filter((p) => p === c).length;
    // Code: terminal cyan fill.
    expect(count(0x2ce8f5)).toBeGreaterThan(300);
    expect(a.initial).toBe('N');
    expect(a.initialColor).not.toBe(a.fill);
    expect(count(a.initialColor)).toBeGreaterThan(20);
  });

  it('different species get different shapes', () => {
    const shapes = new Set(['tokenibble', 'vibrat', 'cobolt', 'heisenmoth'].map((s) => (placeholderArt(s).frames[0] ?? []).map((p) => (p === null ? 0 : 1)).join('')));
    expect(shapes.size).toBe(4);
  });
});
