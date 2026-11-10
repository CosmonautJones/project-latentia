// Pure text shaping for the fixed-width pixel font: sanitising to the glyph set, word wrap and pagination.

import { hasGlyph } from './glyphs.js';

const REPLACEMENTS: Readonly<Record<string, string>> = {
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '–': '-',
  '—': '-',
};

/** Map text onto the font: smart punctuation to ASCII, anything else the font lacks to `?`. Keeps newlines. */
export function sanitize(text: string): string {
  let out = '';
  for (const ch of text) {
    const r = REPLACEMENTS[ch] ?? ch;
    out += r === '\n' || hasGlyph(r) ? r : '?';
  }
  return out;
}

/** Word-wrap to at most `maxChars` per line. Explicit newlines start a new line; long words are hard-broken. */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ').filter((w) => w.length > 0)) {
      let w = word;
      if (line.length > 0 && line.length + 1 + w.length <= maxChars) {
        line += ` ${w}`;
        continue;
      }
      if (line.length > 0) lines.push(line);
      while (w.length > maxChars) {
        lines.push(w.slice(0, maxChars));
        w = w.slice(maxChars);
      }
      line = w;
    }
    lines.push(line);
  }
  return lines;
}

export function paginate(lines: readonly string[], maxLines: number): string[][] {
  if (lines.length === 0) return [[]];
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));
  return pages;
}
