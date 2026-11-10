// How big the band's DOM text is, and how many characters fit a button line, for the band it is drawn in: portrait
// (one column of full-width buttons) or the touch-landscape band under the game (two columns). Text scales are rounded
// to whole device pixels per font pixel so the SVG glyphs stay crisp. Pure, so it is unit-tested; style.css holds the
// matching paddings (#band-panel 12 px a side, a 6 px gap, .band-btn 10 px a side).

import type { Layout } from '../layout/compute.js';
import { CELL_WIDTH } from '../text/font-sheet.js';

const PANEL_PAD = 12;
const GAP = 6;
/** The button's own padding plus a little slack for its bevel. */
const BUTTON_INSET = 32;
/** A move button's colour tick and cost column (band-menu.ts). */
export const MOVE_RESERVE = 36;

export interface TextSize {
  /** CSS px per font px. */
  readonly scale: number;
  /** Characters that fit one line of a button. */
  readonly chars: number;
}

export interface BandText {
  readonly columns: number;
  readonly label: TextSize;
  /** The smaller line under a choice's label. */
  readonly detail: TextSize;
}

export const crispScale = (cssScale: number, dpr: number): number => Math.max(1, Math.round(cssScale * dpr)) / dpr;

const charsFor = (width: number, scale: number): number => Math.max(8, Math.floor((width / scale + 1) / CELL_WIDTH));

/**
 * Text sizes for band buttons. `reserve` is extra width a button uses besides its text (e.g. MOVE_RESERVE); `columns`
 * is how many columns a wide (touch landscape) band uses, so a short choice list fits without scrolling.
 */
export function bandText(layout: Layout, opts: { readonly reserve?: number; readonly columns?: number } = {}): BandText {
  const reserve = opts.reserve ?? 0;
  const width = layout.band?.width ?? 0;
  const dpr = (layout.scale * 320) / Math.max(1, layout.game.width);
  const landscape = layout.mode === 'landscape';
  const columns = landscape && width >= 480 ? Math.max(1, opts.columns ?? 2) : 1;
  const inner = (width - 2 * PANEL_PAD - (columns - 1) * GAP) / columns - BUTTON_INSET - reserve;
  const label = landscape ? crispScale(4 / 3, dpr) : 2;
  const detail = landscape ? label : crispScale(1.5, dpr);
  return { columns, label: { scale: label, chars: charsFor(inner, label) }, detail: { scale: detail, chars: charsFor(inner, detail) } };
}
