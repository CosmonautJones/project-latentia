import { describe, expect, it } from 'vitest';
import { computeViewport, LONG_SIDE, SHORT_SIDE, TAP_CSS, type Layout, type Rect, type Viewport } from '../../src/layout/viewport.js';

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
  // V16: both orientations flex, the short side 240-270 and the long side 426-540.
  const short = l.mode === 'landscape' ? l.logical.height : l.logical.width;
  const long = l.mode === 'landscape' ? l.logical.width : l.logical.height;
  expect(short).toBeGreaterThanOrEqual(SHORT_SIDE.min);
  expect(short).toBeLessThanOrEqual(SHORT_SIDE.max);
  expect(long).toBeGreaterThanOrEqual(LONG_SIDE.min);
  expect(long).toBeLessThanOrEqual(LONG_SIDE.max);
  // The image fits on the screen (only the too-small fallback clips).
  expect(l.game.width).toBeLessThanOrEqual(v.width + 1e-9);
  expect(l.game.height).toBeLessThanOrEqual(v.height + 1e-9);
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

/** The best coverage any integer scale and in-range logical size could reach, by brute force over every size. */
function bestCoverage(v: Viewport): number {
  const short = Math.min(v.width, v.height) * v.dpr;
  const long = Math.max(v.width, v.height) * v.dpr;
  let best = 0;
  for (let k = 1; k <= 12; k++) {
    for (let s = SHORT_SIDE.min; s <= SHORT_SIDE.max; s++) {
      for (let L = LONG_SIDE.min; L <= LONG_SIDE.max; L++) {
        if (s * k <= short && L * k <= long) best = Math.max(best, (s * k * L * k) / (short * long));
      }
    }
  }
  return best;
}

describe('computeViewport', () => {
  it('1366x768 desktop: 455x256 at 3x fills the screen but a pixel column', () => {
    const l = check(desk(1366, 768));
    expect(l).toMatchObject({ mode: 'landscape', scale: 3, logical: { width: 455, height: 256 }, game: { x: 0, y: 0, width: 1365, height: 768 }, tap: 15 });
    expect(l.coverage).toBeGreaterThanOrEqual(0.85);
  });

  it('1920x1080 desktop: an exact 4x fill of 480x270', () => {
    const l = check(desk(1920, 1080));
    expect(l).toMatchObject({ scale: 4, logical: { width: 480, height: 270 }, game: { x: 0, y: 0, width: 1920, height: 1080 }, coverage: 1 });
  });

  it('scales in device pixels: 1440x900 at DPR 2 is 6 device px per game px (3 CSS px)', () => {
    const l = check(desk(1440, 900, 2));
    expect(l).toMatchObject({ scale: 6, logical: { width: 480, height: 270 }, game: { x: 0, y: 45, width: 1440, height: 810 } });
  });

  it('844x390 touch landscape (iPhone turned): the long side flexes to 540, 720x360 CSS; the safe area starts after the D-pad', () => {
    const l = check(phone(844, 390));
    expect(l).toMatchObject({ mode: 'landscape', scale: 4, logical: { width: 540, height: 270 }, game: { x: 62, y: 15, width: 720, height: 360 }, tap: 33 });
    expect(l.safe.x).toBeGreaterThan(0);
    expect(l.safe.width).toBeGreaterThanOrEqual(400);
    expect(l.coverage).toBeGreaterThanOrEqual(0.75);
  });

  it('390x844 iPhone portrait: 4 device px, 270x540 logical, 360x720 CSS at the top; the controls take the bottom', () => {
    const l = check(phone(390, 844));
    expect(l).toMatchObject({ mode: 'portrait', scale: 4, logical: { width: 270, height: 540 }, game: { x: 15, y: 0, width: 360, height: 720 }, tap: 33 });
    expect(l.safe).toEqual({ x: 0, y: 0, width: 270, height: 523 });
    expect(l.coverage).toBeGreaterThanOrEqual(0.75);
  });

  it('360x640 Android portrait at DPR 3: an exact fill, 270x480; at DPR 2 the short side drops to 240 for a 3x fill', () => {
    const three = check(phone(360, 640, 3));
    expect(three).toMatchObject({ scale: 4, logical: { width: 270, height: 480 }, game: { x: 0, y: 0, width: 360, height: 640 }, coverage: 1 });
    expect(three.safe.height).toBe(370);
    const two = check(phone(360, 640, 2));
    expect(two).toMatchObject({ scale: 3, logical: { width: 240, height: 426 }, game: { x: 0, y: 0, width: 360, height: 639 }, tap: 30 });
    expect(two.coverage).toBeGreaterThan(0.99);
  });

  it('640x360 (that Android turned): DPR 3 is an exact 4x fill of 480x270, DPR 2 a 3x fill of 426x240; the safe area narrows on both sides', () => {
    const l = check(phone(640, 360));
    expect(l).toMatchObject({ scale: 4, logical: { width: 480, height: 270 }, game: { x: 0, y: 0, width: 640, height: 360 }, coverage: 1 });
    expect(l.safe.x).toBeGreaterThan(0);
    expect(l.safe.x + l.safe.width).toBeLessThan(480);
    expect(l.safe.width).toBeGreaterThanOrEqual(300);
    const two = check(phone(640, 360, 2));
    expect(two).toMatchObject({ scale: 3, logical: { width: 426, height: 240 } });
    expect(two.coverage).toBeGreaterThan(0.99);
    expect(two.safe.width).toBeGreaterThanOrEqual(260);
  });

  it('412x915 portrait (Pixel) at DPR 2.625: the integer device scale that fills the most', () => {
    const l = check(phone(412, 915, 2.625));
    // 1081.5 x 2401.9 device px: 4x (1080 x 2160 at 540 tall) beats 3x.
    expect(l).toMatchObject({ scale: 4, logical: { width: 270, height: 540 } });
    expect(l.coverage).toBeGreaterThanOrEqual(0.75);
  });

  it('V16 targets: 844x390 and 390x844 cover at least 75%, 1366x768 at least 85%', () => {
    expect(check(phone(844, 390)).coverage).toBeGreaterThanOrEqual(0.75);
    expect(check(phone(390, 844)).coverage).toBeGreaterThanOrEqual(0.75);
    expect(check(desk(1366, 768)).coverage).toBeGreaterThanOrEqual(0.85);
  });

  it('the chosen scale and size cover as much as any integer scale and in-range size could (brute force)', () => {
    const sizes = [desk(1366, 768), desk(1920, 1080), desk(1440, 900, 2), desk(1280, 720), desk(2560, 1440), desk(1024, 768)];
    sizes.push(phone(844, 390), phone(390, 844), phone(360, 640), phone(640, 360), phone(360, 640, 2), phone(640, 360, 2));
    sizes.push(phone(412, 915, 2.625), phone(915, 412, 2.625), phone(375, 667, 2), phone(667, 375, 2), phone(768, 1024, 2), phone(1024, 768, 2));
    for (const v of sizes) expect(check(v).coverage, `${v.width}x${v.height}@${v.dpr}`).toBeCloseTo(bestCoverage(v), 9);
  });

  it('a tie in coverage goes to the larger logical size', () => {
    // 4320x2430 is filled exactly by 432x243 at 10x and by 480x270 at 9x: the larger logical size wins.
    const l = check(desk(4320, 2430));
    expect(l).toMatchObject({ scale: 9, logical: { width: 480, height: 270 }, coverage: 1 });
  });

  it('a screen too small for 426x240 keeps 1x and clips rather than failing', () => {
    const l = computeViewport(phone(300, 400, 1));
    expect(l).toMatchObject({ mode: 'portrait', scale: 1, logical: { width: 270, height: 426 } });
  });

  it('safe-area insets push the controls in from the notch and the home bar', () => {
    const plain = computeViewport(phone(390, 844));
    const notched = computeViewport({ ...phone(390, 844), inset: { top: 0, right: 0, bottom: 34, left: 0 } });
    expect(notched.buttons['dpad-down']?.y).toBe((plain.buttons['dpad-down']?.y ?? 0) - 34);
    expect(notched.safe.height).toBeLessThan(plain.safe.height);
  });
});
