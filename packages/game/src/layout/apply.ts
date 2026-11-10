// Applies a computed layout to the page and re-applies it on resize, orientation change and DPR change.

import { computeLayout, type Layout, type Rect, type Viewport } from './compute.js';

export interface LayoutElements {
  /** Phaser's parent; sized to exactly the integer-scaled game rect. */
  readonly frame: HTMLElement;
  /** The DS-style bottom band (portrait, and under the game on a touch landscape screen). */
  readonly band: HTMLElement;
  /** The touch controls: moved into the band, or overlaid on landscape touch screens. */
  readonly controls: HTMLElement;
}

const place = (el: HTMLElement, r: Rect) => {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
};

export function readViewport(win: Window): Viewport {
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    dpr: win.devicePixelRatio || 1,
    touch: win.matchMedia('(pointer: coarse)').matches,
  };
}

export function applyLayout(layout: Layout, els: LayoutElements): void {
  place(els.frame, layout.game);
  els.band.hidden = layout.band === null;
  els.band.dataset['mode'] = layout.mode;
  if (layout.band) place(els.band, layout.band);
  els.controls.dataset['placement'] = layout.controls;
  els.controls.hidden = layout.controls === 'none';
  if (layout.controls === 'band' && els.controls.parentElement !== els.band) els.band.append(els.controls);
  if ((layout.controls === 'overlay' || layout.controls === 'sides') && els.controls.parentElement === els.band) els.band.after(els.controls);
}

/** Lay out now and on every viewport change (coalesced to one per frame). Calls `onLayout` after each apply. */
export function watchLayout(win: Window, els: LayoutElements, onLayout: (layout: Layout) => void): () => void {
  let frame = 0;
  let dprQuery: MediaQueryList | null = null;
  const run = () => {
    frame = 0;
    const layout = computeLayout(readViewport(win));
    applyLayout(layout, els);
    onLayout(layout);
    watchDpr();
  };
  const schedule = () => {
    if (frame === 0) frame = win.requestAnimationFrame(run);
  };
  // A DPR change (browser zoom, moving to another monitor) does not always fire `resize`.
  function watchDpr() {
    dprQuery?.removeEventListener('change', schedule);
    dprQuery = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', schedule);
  }
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  run();
  return () => {
    if (frame !== 0) win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    dprQuery?.removeEventListener('change', schedule);
  };
}
