import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/layout/compute.js';
import { bandText, crispScale, MOVE_RESERVE } from '../../src/ui/band-sizing.js';

describe('crispScale: DOM text scales that land on whole device pixels', () => {
  it('rounds a CSS scale to whole device px per font px, never below one', () => {
    expect(crispScale(2, 3)).toBe(2);
    expect(crispScale(1.5, 3)).toBeCloseTo(5 / 3);
    expect(crispScale(1.5, 2)).toBe(1.5);
    expect(crispScale(1.25, 3)).toBeCloseTo(4 / 3);
    expect(crispScale(0.1, 1)).toBe(1);
  });
});

describe('bandText: the band buttons size their text for the band they are in', () => {
  it('portrait 390x844: one column, labels at 2x (28 chars a line), details smaller', () => {
    const t = bandText(computeLayout({ width: 390, height: 844, dpr: 3, touch: true }));
    expect(t.columns).toBe(1);
    expect(t.label).toEqual({ scale: 2, chars: 28 });
    expect(t.detail.scale).toBeLessThan(t.label.scale);
    expect(t.detail.chars).toBeGreaterThan(t.label.chars);
  });

  it('touch landscape 844x390: two columns, and the longest move name fits one line', () => {
    const t = bandText(computeLayout({ width: 844, height: 390, dpr: 3, touch: true }));
    expect(t.columns).toBe(2);
    expect(bandText(computeLayout({ width: 844, height: 390, dpr: 3, touch: true }), { reserve: MOVE_RESERVE }).label.chars).toBeGreaterThanOrEqual('PROOF BY CONTRADICTION'.length);
    expect(t.detail.scale).toBeLessThanOrEqual(t.label.scale);
  });

  it('a wide band can show three choices side by side; portrait stays one column', () => {
    expect(bandText(computeLayout({ width: 844, height: 390, dpr: 3, touch: true }), { columns: 3 }).columns).toBe(3);
    expect(bandText(computeLayout({ width: 390, height: 844, dpr: 3, touch: true }), { columns: 3 }).columns).toBe(1);
  });
});
