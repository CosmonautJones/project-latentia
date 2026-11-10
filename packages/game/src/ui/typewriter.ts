// The pure model behind the dialogue box: text revealed a character at a time, page by page.
// A advances a finished page (or closes the last one); holding A or B reveals FAST_MULTIPLIER times faster.

import { paginate, sanitize, wrapText } from '../text/wrap.js';

export const FAST_MULTIPLIER = 4;

export interface TypewriterOptions {
  readonly maxChars: number;
  readonly maxLines: number;
  readonly charsPerSecond: number;
}

export interface TypewriterState {
  readonly pages: readonly (readonly string[])[];
  readonly page: number;
  /** Characters revealed on the current page, newlines not counted. */
  readonly shown: number;
  /** Milliseconds banked toward the next character. */
  readonly carryMs: number;
  readonly charsPerSecond: number;
  readonly closed: boolean;
}

export function createTypewriter(text: string, opts: TypewriterOptions): TypewriterState {
  const pages = paginate(wrapText(sanitize(text), opts.maxChars), opts.maxLines);
  return { pages, page: 0, shown: 0, carryMs: 0, charsPerSecond: opts.charsPerSecond, closed: false };
}

const pageLength = (s: TypewriterState): number => (s.pages[s.page] ?? []).reduce((n, l) => n + l.length, 0);

export const isPageComplete = (s: TypewriterState): boolean => s.shown >= pageLength(s);
export const isLastPage = (s: TypewriterState): boolean => s.page >= s.pages.length - 1;

export function tick(s: TypewriterState, dtMs: number, fast: boolean): TypewriterState {
  if (s.closed || isPageComplete(s)) return s;
  const msPerChar = 1000 / (s.charsPerSecond * (fast ? FAST_MULTIPLIER : 1));
  const total = s.carryMs + dtMs;
  const add = Math.floor(total / msPerChar);
  const shown = Math.min(pageLength(s), s.shown + add);
  return { ...s, shown, carryMs: shown >= pageLength(s) ? 0 : total - add * msPerChar };
}

/** The A button: next page, or close after the last. Ignored while the page is still typing. */
export function advance(s: TypewriterState): TypewriterState {
  if (s.closed || !isPageComplete(s)) return s;
  if (isLastPage(s)) return { ...s, closed: true };
  return { ...s, page: s.page + 1, shown: 0, carryMs: 0 };
}

/** The revealed part of the current page, lines joined by newlines. */
export function visibleText(s: TypewriterState): string {
  let left = s.shown;
  const out: string[] = [];
  for (const line of s.pages[s.page] ?? []) {
    if (left <= 0) break;
    out.push(line.slice(0, left));
    left -= line.length;
  }
  return out.join('\n');
}
