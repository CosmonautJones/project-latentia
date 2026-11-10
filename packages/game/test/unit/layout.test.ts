import { describe, expect, it } from 'vitest';
import { computeLayout, MIN_BAND_CSS } from '../../src/layout/compute.js';

describe('computeLayout', () => {
  it('portrait phone 390x844 at DPR 3: 3 device px per game px (320 CSS px wide) at the top, band below', () => {
    const l = computeLayout({ width: 390, height: 844, dpr: 3, touch: true });
    expect(l.mode).toBe('portrait');
    expect(l.scale).toBe(3);
    expect(l.game).toEqual({ x: 35, y: 0, width: 320, height: 180 });
    expect(l.band).toEqual({ x: 0, y: 180, width: 390, height: 664 });
    expect(l.controls).toBe('band');
  });

  it('1920x1080 at DPR 1: exact 6x fill, no letterbox', () => {
    const l = computeLayout({ width: 1920, height: 1080, dpr: 1, touch: false });
    expect(l.mode).toBe('landscape');
    expect(l.scale).toBe(6);
    expect(l.game).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(l.band).toBeNull();
    expect(l.controls).toBe('none');
  });

  it('1366x768 at DPR 1: 4x, centred and letterboxed', () => {
    const l = computeLayout({ width: 1366, height: 768, dpr: 1, touch: false });
    expect(l.mode).toBe('landscape');
    expect(l.scale).toBe(4);
    expect(l.game).toEqual({ x: 43, y: 24, width: 1280, height: 720 });
    expect(l.band).toBeNull();
  });

  it('scales in device pixels: 1440x900 at DPR 2 is 9 device px per game px (4.5 CSS px)', () => {
    const l = computeLayout({ width: 1440, height: 900, dpr: 2, touch: false });
    expect(l.scale).toBe(9);
    expect(l.game).toEqual({ x: 0, y: 45, width: 1440, height: 810 });
  });

  it('landscape on a touch device overlays the controls', () => {
    const l = computeLayout({ width: 844, height: 390, dpr: 3, touch: true });
    expect(l.mode).toBe('landscape');
    expect(l.scale).toBe(6);
    expect(l.game).toEqual({ x: 102, y: 15, width: 640, height: 360 });
    expect(l.controls).toBe('overlay');
  });

  it('portrait keeps at least MIN_BAND_CSS of band below the game', () => {
    // A tall-but-narrow desktop window: width alone would allow 4x, the band floor caps it.
    const l = computeLayout({ width: 1300, height: 1300, dpr: 1, touch: false });
    expect(l.mode).toBe('landscape');
    const p = computeLayout({ width: 1300, height: 1400, dpr: 1, touch: false });
    expect(p.mode).toBe('portrait');
    expect(p.band).not.toBeNull();
    expect(p.band?.height ?? 0).toBeGreaterThanOrEqual(MIN_BAND_CSS);
    expect(p.scale).toBe(4);
  });

  it('every layout uses an integer scale of at least 1 and device-pixel-aligned rects', () => {
    const cases = [
      { width: 360, height: 640, dpr: 2 },
      { width: 375, height: 667, dpr: 2 },
      { width: 412, height: 915, dpr: 2.625 },
      { width: 200, height: 100, dpr: 1 },
      { width: 1024, height: 768, dpr: 1.25 },
    ];
    for (const c of cases) {
      const l = computeLayout({ ...c, touch: true });
      expect(Number.isInteger(l.scale)).toBe(true);
      expect(l.scale).toBeGreaterThanOrEqual(1);
      for (const v of [l.game.x, l.game.y, l.game.width, l.game.height]) {
        expect(Number.isInteger(Math.round(v * c.dpr * 1000) / 1000)).toBe(true);
      }
      expect(l.game.width * c.dpr).toBeCloseTo(320 * l.scale, 6);
      expect(l.game.height * c.dpr).toBeCloseTo(180 * l.scale, 6);
    }
  });

  it('a viewport smaller than 320x180 device px still gets scale 1 (it overflows rather than shrinking)', () => {
    const l = computeLayout({ width: 200, height: 100, dpr: 1, touch: false });
    expect(l.scale).toBe(1);
    expect(l.game.width).toBe(320);
    expect(l.game.x).toBe(0);
  });
});
