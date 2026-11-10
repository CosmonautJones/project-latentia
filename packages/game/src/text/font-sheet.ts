// Pure layout of the font texture: where each glyph's lit pixels go on a fixed-cell sheet that Phaser's
// RetroFont parser reads (fixed width, `charsPerRow` per row, characters in FONT_CHARS order).

import { FONT_CHARS, glyphRows } from './glyphs.js';

/** Advance width: 5 px of glyph plus 1 px of spacing. */
export const CELL_WIDTH = 6;
/** Line height: 8 px of glyph plus 2 px of leading. */
export const CELL_HEIGHT = 10;
const CHARS_PER_ROW = 16;

export interface FontSheet {
  readonly chars: string;
  readonly charsPerRow: number;
  readonly width: number;
  readonly height: number;
  /** Every lit pixel, in sheet coordinates. */
  readonly pixels: readonly { readonly x: number; readonly y: number }[];
}

export function fontSheet(): FontSheet {
  const chars = [...FONT_CHARS];
  const pixels: { x: number; y: number }[] = [];
  chars.forEach((ch, i) => {
    const ox = (i % CHARS_PER_ROW) * CELL_WIDTH;
    const oy = Math.floor(i / CHARS_PER_ROW) * CELL_HEIGHT;
    glyphRows(ch).forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') pixels.push({ x: ox + x, y: oy + y });
    });
  });
  return {
    chars: FONT_CHARS,
    charsPerRow: CHARS_PER_ROW,
    width: CHARS_PER_ROW * CELL_WIDTH,
    height: Math.ceil(chars.length / CHARS_PER_ROW) * CELL_HEIGHT,
    pixels,
  };
}
