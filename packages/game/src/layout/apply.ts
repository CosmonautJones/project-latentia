// Applies a computed layout to the page and re-applies it on resize, orientation change and DPR change.

import type { TouchControlId } from '../input/actions.js';
import { computeViewport, type Insets, type Layout, type Rect, type Viewport } from './viewport.js';

export interface LayoutElements {
  /** Phaser's parent; sized to exactly the integer-scaled game rect. */
  readonly frame: HTMLElement;
  /** The touch controls' overlay; each button is placed at its computed rect. */
  readonly controls: HTMLElement;
}

const place = (el: HTMLElement, r: Rect) => {
  el.style.left = `${r.x}px`;
  el.style.top = `${r.y}px`;
  el.style.width = `${r.width}px`;
  el.style.height = `${r.height}px`;
};

/** env(safe-area-inset-*), read through a probe element (0 where the browser has none). */
function readInsets(doc: Document): Insets {
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  doc.body.append(probe);
  const s = doc.defaultView?.getComputedStyle(probe);
  const px = (v: string | undefined) => Number.parseFloat(v ?? '0') || 0;
  const insets = { top: px(s?.paddingTop), right: px(s?.paddingRight), bottom: px(s?.paddingBottom), left: px(s?.paddingLeft) };
  probe.remove();
  return insets;
}

export function readViewport(win: Window): Viewport {
  return {
    width: win.innerWidth,
    height: win.innerHeight,
    dpr: win.devicePixelRatio || 1,
    touch: win.matchMedia('(pointer: coarse)').matches,
    inset: readInsets(win.document),
  };
}

export function applyLayout(layout: Layout, els: LayoutElements): void {
  place(els.frame, layout.game);
  els.controls.hidden = layout.controls === 'none';
  els.controls.dataset['mode'] = layout.mode;
  for (const el of els.controls.querySelectorAll<HTMLElement>('[data-control]')) {
    const r = layout.buttons[el.dataset['control'] as TouchControlId];
    el.hidden = r === undefined;
    if (r) place(el, r);
  }
}

/** Lay out now and on every viewport change (coalesced to one per frame). Calls `onLayout` after each apply. */
export function watchLayout(win: Window, els: LayoutElements, onLayout: (layout: Layout) => void): () => void {
  let frame = 0;
  let dprQuery: MediaQueryList | null = null;
  const run = () => {
    frame = 0;
    const layout = computeViewport(readViewport(win));
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
