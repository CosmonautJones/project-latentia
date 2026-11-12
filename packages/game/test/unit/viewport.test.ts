import { describe, expect, it } from 'vitest';
import { computeViewport, LANDSCAPE_SIZE, PORTRAIT_MAX_HEIGHT, PORTRAIT_MIN_HEIGHT, PORTRAIT_WIDTH, TAP_CSS, type Layout, type Rect, type Viewport } from '../../src/layout/viewport.js';

const phone = (width: number, height: number, dpr = 3): Viewport => ({ width, height, dpr, touch: true });
const desk = (width: number, height: number, dpr = 1): Viewport => ({ width, height, dpr, touch: false });

/** The logical rect of a CSS rect, for checking the controls against the safe area. */
const toLogical = (l: Layout, r: Rect, dpr: number): Rect => {
  const k = dpr / l.scale;
  return { x: (r.x - l.game.x) * k, y: (r.y - l.game.y) * k, width: r.width * k, height: r.height * k };
};
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Invariants every layout keeps. */
function check(v: Viewport): Layout {
  const l = computeViewport(v);
  expect(Number.isInteger(l.scale) && l.scale >= 1).toBe(true);
  // The image is exactly logical x scale device pixels, and every edge is on a device pixel.
  expect(l.game.width * v.dpr).toBeCloseTo(l.logical.width * l.scale, 6);
  expect(l.game.height * v.dpr).toBeCloseTo(l.logical.height * l.scale, 6);
  for (const n of [l.game.x, l.game.y]) expect(Math.abs(n * v.dpr - Math.round(n * v.dpr))).toBeLessThan(1e-6);
  if (l.mode === 'landscape') expect(l.logical).toEqual(LANDSCAPE_SIZE);
  else {
    expect(l.logical.width).toBe(PORTRAIT_WIDTH);
    expect(l.logical.height).toBeGreaterThanOrEqual(PORTRAIT_MIN_HEIGHT);
    expect(l.logical.height).toBeLessThanOrEqual(PORTRAIT_MAX_HEIGHT);
  }
  // A tap row of `tap` logical px is at least 44 CSS px.
  expect((l.tap * l.scale) / v.dpr).toBeGreaterThanOrEqual(TAP_CSS);
  expect(l.safe.x >= 0 && l.safe.y >= 0 && l.safe.x + l.safe.width <= l.logical.width && l.safe.y + l.safe.height <= l.logical.height).toBe(true);
  if (v.touch) {
    expect(l.controls).toBe('overlay');
    expect(Object.keys(l.buttons)).toHaveLength(6);
    for (const [id, b] of Object.entries(l.buttons)) {
      expect(b.width, id).toBeGreaterThanOrEqual(TAP_CSS);
      expect(b.height, id).toBeGreaterThanOrEqual(TAP_CSS);
      expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width && b.y + b.height <= v.height, `${id} on screen`).toBe(true);
      // No control ever covers the safe area, where the dialogue box and the menus go.
      expect(overlaps(toLogical(l, b, v.dpr), l.safe), `${id} clear of the safe area`).toBe(false);
    }
  } else {
    expect(l.controls).toBe('none');
    expect(l.safe).toEqual({ x: 0, y: 0, ...l.logical });
  }
  return l;
}

describe('computeViewport', () => {
  it('1366x768 desktop: 480x270 at 2x, centred, no controls', () => {
    const l = check(desk(1366, 768));
    expect(l).toMatchObject({ mode: 'landscape', scale: 2, game: { x: 203, y: 114, width: 960, height: 540 }, tap: 22 });
    expect(l.coverage).toBeCloseTo(0.494, 3);
  });

  it('1920x1080 desktop: an exact 4x fill', () => {
    const l = check(desk(1920, 1080));
    expect(l).toMatchObject({ scale: 4, game: { x: 0, y: 0, width: 1920, height: 1080 }, coverage: 1 });
  });

  it('scales in device pixels: 1440x900 at DPR 2 is 6 device px per game px (3 CSS px)', () => {
    const l = check(desk(1440, 900, 2));
    expect(l).toMatchObject({ scale: 6, game: { x: 0, y: 45, width: 1440, height: 810 } });
  });

  it('844x390 touch landscape (iPhone turned): 4 device px, 640x360 CSS; the D-pad overlaps the left edge, the safe area starts after it', () => {
    const l = check(phone(844, 390));
    expect(l).toMatchObject({ mode: 'landscape', scale: 4, game: { x: 102, y: 15, width: 640, height: 360 }, tap: 33 });
    expect(l.safe).toEqual({ x: 34, y: 0, width: 446, height: 270 });
    expect(l.coverage).toBeCloseTo(0.7, 3);
  });

  it('390x844 iPhone portrait: 4 device px (not 3), 270x540 logical, 360x720 CSS at the top; the controls take the bottom', () => {
    const l = check(phone(390, 844));
    expect(l).toMatchObject({ mode: 'portrait', scale: 4, logical: { width: 270, height: 540 }, game: { x: 15, y: 0, width: 360, height: 720 }, tap: 33 });
    expect(l.safe).toEqual({ x: 0, y: 0, width: 270, height: 523 });
    expect(l.coverage).toBeGreaterThan(0.78);
  });

  it('360x640 Android portrait at DPR 3: an exact fill, 270x480; at DPR 2: 2x, 270x540', () => {
    const three = check(phone(360, 640, 3));
    expect(three).toMatchObject({ scale: 4, logical: { width: 270, height: 480 }, game: { x: 0, y: 0, width: 360, height: 640 }, coverage: 1 });
    expect(three.safe.height).toBe(370);
    const two = check(phone(360, 640, 2));
    expect(two).toMatchObject({ scale: 2, logical: { width: 270, height: 540 }, game: { x: 45, y: 0, width: 270, height: 540 }, tap: 44 });
    expect(two.coverage).toBeGreaterThanOrEqual(0.55);
  });

  it('640x360 (that Android turned): an exact 4x fill; both control clusters overlap, so the safe area narrows on both sides', () => {
    const l = check(phone(640, 360));
    expect(l).toMatchObject({ scale: 4, game: { x: 0, y: 0, width: 640, height: 360 }, coverage: 1 });
    expect(l.safe.x).toBeGreaterThan(0);
    expect(l.safe.x + l.safe.width).toBeLessThan(480);
    expect(l.safe.width).toBeGreaterThanOrEqual(300);
  });

  it('412x915 portrait (Pixel) at DPR 2.625: the integer device scale that fills the most', () => {
    const l = check(phone(412, 915, 2.625));
    // 1081.5 x 2401.9 device px: 4x (1080 x 2160 at 540 tall) beats 3x.
    expect(l).toMatchObject({ scale: 4, logical: { width: 270, height: 540 } });
    expect(l.coverage).toBeGreaterThanOrEqual(0.55);
  });

  it('the review sizes cover at least 70% in landscape and 55% in portrait', () => {
    for (const v of [phone(390, 844), phone(360, 640), phone(360, 640, 2), phone(412, 915, 2.625)]) expect(check(v).coverage).toBeGreaterThanOrEqual(0.55);
    for (const v of [phone(640, 360), phone(915, 412, 2.625)]) expect(check(v).coverage).toBeGreaterThanOrEqual(0.7);
    // 844x390 at DPR 3 is 640x360 CSS on 844x390: 69.996%, the best any integer scale of 480x270 can do there.
    expect(check(phone(844, 390)).coverage).toBeGreaterThan(0.6999);
  });

  it('a portrait screen too short for 480 rows keeps 1x and clips rather than failing', () => {
    const l = computeViewport(phone(300, 400, 1));
    expect(l).toMatchObject({ mode: 'portrait', scale: 1, logical: { width: 270, height: 480 } });
  });

  it('safe-area insets push the controls in from the notch and the home bar', () => {
    const plain = computeViewport(phone(390, 844));
    const notched = computeViewport({ ...phone(390, 844), inset: { top: 0, right: 0, bottom: 34, left: 0 } });
    expect(notched.buttons['dpad-down']?.y).toBe((plain.buttons['dpad-down']?.y ?? 0) - 34);
    expect(notched.safe.height).toBeLessThan(plain.safe.height);
  });
});
