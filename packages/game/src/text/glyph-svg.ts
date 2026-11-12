// A glyph as an inline SVG, for the DOM touch controls, so their labels use the game font, not a system font.

import { CELL_WIDTH } from './font-sheet.js';
import { GLYPH_HEIGHT, GLYPH_WIDTH, glyphRows } from './glyphs.js';
import { sanitize } from './wrap.js';

/** The glyph's 7 rows above the descender (the controls only use capitals and arrows). */
const ROWS = 7;

export function glyphSvg(ch: string, scale: number, fill: string): string {
  const rects: string[] = [];
  glyphRows(ch)
    .slice(0, ROWS)
    .forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') rects.push(`<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}"/>`);
      }
    });
  const w = GLYPH_WIDTH * scale;
  const h = ROWS * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${fill}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}

/** A single line of text as an inline SVG (descenders included), for DOM text such as the touch-control labels. */
export function textSvg(text: string, scale: number, fill: string): string {
  const chars = [...sanitize(text)];
  const rects: string[] = [];
  chars.forEach((ch, i) => {
    glyphRows(ch).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') rects.push(`<rect x="${(i * CELL_WIDTH + x) * scale}" y="${y * scale}" width="${scale}" height="${scale}"/>`);
      }
    });
  });
  const w = Math.max(1, chars.length * CELL_WIDTH - 1) * scale;
  const h = GLYPH_HEIGHT * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="${fill}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
