// Pure layout math: which integer scale the 320x180 screen gets and where it, and the portrait band, go.
// The scale is counted in DEVICE pixels per game pixel (design bible: "integer-scaled by device pixels"), so a
// 390-CSS-px phone at DPR 3 gets 3x = 960 device px = 320 CSS px. Every rect edge lands on a device pixel.

export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;
/** Portrait mode keeps at least this much CSS height below the game for the touch band. */
export const MIN_BAND_CSS = 200;
/** A touch landscape screen wants this much CSS width each side of the game for the D-pad and the A/B pair. */
export const SIDE_CONTROLS_CSS = 150;
/**
 * Touch landscape puts the menus in a band under the game (DOM buttons, 44 CSS px targets, as in portrait) when at
 * least this much CSS height is left there; the canvas rows would be only about 20 CSS px tall.
 */
export const LANDSCAPE_BAND_CSS = 140;

export interface Viewport {
  /** CSS px. */
  readonly width: number;
  /** CSS px. */
  readonly height: number;
  readonly dpr: number;
  /** A coarse pointer (phone or tablet): landscape then overlays the touch controls. */
  readonly touch: boolean;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type LayoutMode = 'landscape' | 'portrait';
/**
 * Where the touch controls go: in the portrait band; beside the game on a touch landscape screen (`sides`, so they
 * never cover the menus); overlaid when even 1x leaves no room beside it; or hidden.
 */
export type ControlsPlacement = 'band' | 'sides' | 'overlay' | 'none';

export interface Layout {
  readonly mode: LayoutMode;
  /** Device pixels per game pixel, an integer >= 1. */
  readonly scale: number;
  /** The game screen, CSS px. */
  readonly game: Rect;
  /** The DS-style bottom band (portrait, and touch landscape when it fits), CSS px. */
  readonly band: Rect | null;
  readonly controls: ControlsPlacement;
  /**
   * Where menus and choice panels take taps: `band` (DOM buttons in the band's `#band-panel`; the canvas keeps only the
   * prompt or title) or `canvas` (rows drawn and tapped on the game screen: desktop, and touch screens too small for a band).
   */
  readonly menus: 'canvas' | 'band';
}

const fitScale = (widthDev: number, heightDev: number): number =>
  Math.max(1, Math.floor(Math.min(widthDev / GAME_WIDTH, heightDev / GAME_HEIGHT)));

export function computeLayout(v: Viewport): Layout {
  const { dpr } = v;
  const wDev = v.width * dpr;
  const hDev = v.height * dpr;
  const portrait = v.height > v.width;

  if (portrait) {
    const scale = fitScale(wDev, Math.max(0, hDev - MIN_BAND_CSS * dpr));
    const gw = GAME_WIDTH * scale;
    const gh = GAME_HEIGHT * scale;
    const gx = Math.max(0, Math.floor((wDev - gw) / 2));
    const bandTop = gh / dpr;
    return {
      mode: 'portrait',
      scale,
      game: { x: gx / dpr, y: 0, width: gw / dpr, height: gh / dpr },
      band: { x: 0, y: bandTop, width: v.width, height: Math.max(0, v.height - bandTop) },
      controls: 'band',
      menus: 'band',
    };
  }

  if (v.touch) {
    // The largest scale (at least 1 CSS px per game px) that leaves the side margins for the controls and a band
    // under the game for the menus. The game sits on top, centred; the band spans between the controls.
    for (let s = fitScale(wDev, hDev); s >= Math.max(1, Math.ceil(dpr)); s--) {
      const gh = GAME_HEIGHT * s;
      if (wDev - GAME_WIDTH * s < 2 * SIDE_CONTROLS_CSS * dpr || hDev - gh < LANDSCAPE_BAND_CSS * dpr) continue;
      const gx = Math.floor((wDev - GAME_WIDTH * s) / 2);
      return {
        mode: 'landscape',
        scale: s,
        game: { x: gx / dpr, y: 0, width: (GAME_WIDTH * s) / dpr, height: gh / dpr },
        band: { x: SIDE_CONTROLS_CSS, y: gh / dpr, width: v.width - 2 * SIDE_CONTROLS_CSS, height: v.height - gh / dpr },
        controls: 'sides',
        menus: 'band',
      };
    }
  }

  let scale = fitScale(wDev, hDev);
  let controls: ControlsPlacement = v.touch ? 'overlay' : 'none';
  if (v.touch) {
    // The largest scale that leaves SIDE_CONTROLS_CSS free on each side.
    for (let s = scale; s >= 1; s--) {
      if (wDev - GAME_WIDTH * s >= 2 * SIDE_CONTROLS_CSS * dpr) {
        scale = s;
        controls = 'sides';
        break;
      }
    }
  }
  const gw = GAME_WIDTH * scale;
  const gh = GAME_HEIGHT * scale;
  const gx = Math.max(0, Math.floor((wDev - gw) / 2));
  const gy = Math.max(0, Math.floor((hDev - gh) / 2));
  return {
    mode: 'landscape',
    scale,
    game: { x: gx / dpr, y: gy / dpr, width: gw / dpr, height: gh / dpr },
    band: null,
    controls,
    menus: 'canvas',
  };
}
