// Pure viewport math (plan v0.1 Q1): from the CSS viewport, the DPR and the orientation, the logical size the game
// runs at, the integer DEVICE-pixel scale, where the image goes, where the touch controls go, and the safe area of the
// logical screen that they never cover (the dialogue box and every menu stay inside it).
// - Landscape and desktop: 480x270. Portrait: 270 wide, 480 to 540 tall (the long side grows to fill the screen).
// - The scale is the largest integer number of device pixels per logical pixel that fits (for a fixed aspect, and for
//   portrait's flexible height, the largest scale that fits is also the one that fills the most screen). Every image
//   edge lands on a device pixel, so nearest filtering never scales by a fraction.
// - The touch controls are a translucent overlay at the screen edges: in portrait along the bottom (the safe area ends
//   above them), in landscape vertically centred at the sides (the safe area starts and ends beside them).

import type { TouchControlId } from '../input/actions.js';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Size {
  readonly x: number;
  readonly y: number;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface Viewport {
  /** CSS px. */
  readonly width: number;
  /** CSS px. */
  readonly height: number;
  readonly dpr: number;
  /** A coarse pointer (phone or tablet): the touch controls are shown. */
  readonly touch: boolean;
  /** env(safe-area-inset-*), CSS px: the controls stay clear of a notch and the home bar. */
  readonly inset?: Insets;
}

export type LayoutMode = 'landscape' | 'portrait';

export interface Layout {
  readonly mode: LayoutMode;
  /** The size the game runs at, in logical (game) px. */
  readonly logical: Size;
  /** Device pixels per logical pixel, an integer >= 1. */
  readonly scale: number;
  /** The game image, CSS px. */
  readonly game: Rect;
  readonly controls: 'overlay' | 'none';
  /** Each touch control's button, CSS px (empty without touch). */
  readonly buttons: Readonly<Partial<Record<TouchControlId, Rect>>>;
  /** Logical px: the part of the image no control covers. Dialogue and menus are laid out inside it. */
  readonly safe: Rect;
  /** Logical px of a 44 CSS px tap target: the least row pitch of a tappable menu. */
  readonly tap: number;
  /** The fraction of the screen's area the game image covers. */
  readonly coverage: number;
}

export const LANDSCAPE_SIZE: Size = { width: 480, height: 270 };
export const PORTRAIT_WIDTH = 270;
export const PORTRAIT_MIN_HEIGHT = 480;
export const PORTRAIT_MAX_HEIGHT = 540;
/** The least touch target, CSS px. */
export const TAP_CSS = 44;
/** The controls' geometry, CSS px: a 3x3 D-pad of 44 px cells and two 56 px buttons, 12 px in from the edges. */
const CELL = 44;
const PAD = 3 * CELL;
const BTN = 56;
const EDGE = 12;
/** Logical px kept between a control and the safe area. */
const GAP = 2;

const NO_INSET: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The D-pad's four buttons in a plus, its top-left corner at (x, y). */
function dpad(x: number, y: number): Record<'dpad-up' | 'dpad-down' | 'dpad-left' | 'dpad-right', Rect> {
  const cell = (cx: number, cy: number): Rect => ({ x: x + cx * CELL, y: y + cy * CELL, width: CELL, height: CELL });
  return { 'dpad-up': cell(1, 0), 'dpad-left': cell(0, 1), 'dpad-right': cell(2, 1), 'dpad-down': cell(1, 2) };
}

function placeButtons(v: Viewport, mode: LayoutMode): Record<TouchControlId, Rect> {
  const i = v.inset ?? NO_INSET;
  const left = EDGE + i.left;
  const right = v.width - EDGE - i.right;
  const btn = (x: number, y: number): Rect => ({ x, y, width: BTN, height: BTN });
  if (mode === 'portrait') {
    // Along the bottom: the D-pad bottom-left; B low and A high at the bottom right, like a handheld.
    const bottom = v.height - EDGE - i.bottom;
    return { ...dpad(left, bottom - PAD), 'btn-b': btn(right - 2 * BTN - 12, bottom - BTN), 'btn-a': btn(right - BTN, bottom - BTN - 44) };
  }
  // At the sides, vertically centred: the D-pad left, A over B right.
  const mid = (v.height - i.bottom + i.top) / 2;
  return { ...dpad(left, mid - PAD / 2), 'btn-a': btn(right - BTN, mid - BTN - 6), 'btn-b': btn(right - BTN, mid + 6) };
}

/** The largest integer scale (>= 1) at which `logical` fits in `widthDev` x `heightDev` device px. */
const fit = (widthDev: number, heightDev: number, w: number, h: number): number => Math.max(1, Math.floor(Math.min(widthDev / w, heightDev / h)));

export function computeViewport(v: Viewport): Layout {
  const { dpr } = v;
  const wDev = v.width * dpr;
  const hDev = v.height * dpr;
  const mode: LayoutMode = v.height > v.width ? 'portrait' : 'landscape';
  let logical: Size;
  let scale: number;
  if (mode === 'portrait') {
    scale = fit(wDev, hDev, PORTRAIT_WIDTH, PORTRAIT_MIN_HEIGHT);
    logical = { width: PORTRAIT_WIDTH, height: Math.min(PORTRAIT_MAX_HEIGHT, Math.max(PORTRAIT_MIN_HEIGHT, Math.floor(hDev / scale))) };
  } else {
    scale = fit(wDev, hDev, LANDSCAPE_SIZE.width, LANDSCAPE_SIZE.height);
    logical = LANDSCAPE_SIZE;
  }
  const gw = logical.width * scale;
  const gh = logical.height * scale;
  const top = (v.inset?.top ?? 0) * dpr;
  // Centred; in portrait at the top (below a notch), so the controls get the room underneath.
  const gx = Math.max(0, Math.floor((wDev - gw) / 2));
  const gy = mode === 'portrait' ? Math.min(Math.max(0, Math.floor(hDev - gh)), Math.ceil(top)) : Math.max(0, Math.floor((hDev - gh) / 2));
  const game: Rect = { x: gx / dpr, y: gy / dpr, width: gw / dpr, height: gh / dpr };
  const coverage = (Math.min(game.width, v.width - game.x) * Math.min(game.height, v.height - game.y)) / (v.width * v.height);
  const tap = Math.ceil((TAP_CSS * dpr) / scale);
  const full: Rect = { x: 0, y: 0, ...logical };
  if (!v.touch) return { mode, logical, scale, game, controls: 'none', buttons: {}, safe: full, tap, coverage };

  const buttons = placeButtons(v, mode);
  // CSS px to logical px.
  const lx = (x: number) => ((x - game.x) * dpr) / scale;
  const ly = (y: number) => ((y - game.y) * dpr) / scale;
  const rects = Object.values(buttons);
  let safe: Rect;
  if (mode === 'portrait') {
    const controlsTop = Math.min(...rects.map((r) => ly(r.y)));
    safe = { x: 0, y: 0, width: logical.width, height: Math.max(0, Math.min(logical.height, Math.floor(controlsTop) - GAP)) };
  } else {
    const leftRects = rects.filter((r) => r.x + r.width / 2 < v.width / 2);
    const rightRects = rects.filter((r) => r.x + r.width / 2 >= v.width / 2);
    // Only a cluster that reaches over the image narrows the safe area.
    const leftEdge = Math.max(0, ...leftRects.filter((r) => lx(r.x + r.width) > 0).map((r) => Math.ceil(lx(r.x + r.width)) + GAP));
    const rightEdge = Math.min(logical.width, ...rightRects.filter((r) => lx(r.x) < logical.width).map((r) => Math.floor(lx(r.x)) - GAP));
    safe = { x: leftEdge, y: 0, width: Math.max(0, rightEdge - leftEdge), height: logical.height };
  }
  return { mode, logical, scale, game, controls: 'overlay', buttons, safe, tap, coverage };
}
