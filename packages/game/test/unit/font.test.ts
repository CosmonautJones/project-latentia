import { describe, expect, it } from 'vitest';
import { FONT_CHARS, GLYPH_HEIGHT, GLYPH_WIDTH, glyphRows } from '../../src/text/glyphs.js';
import { CELL_HEIGHT, CELL_WIDTH, fontSheet } from '../../src/text/font-sheet.js';
import { glyphSvg } from '../../src/text/glyph-svg.js';

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const SYMBOLS = '…→✓×';

describe('glyphs', () => {
  it('cover printable ASCII plus … → ✓ ×', () => {
    for (const ch of ASCII + SYMBOLS) expect(FONT_CHARS, `missing ${JSON.stringify(ch)}`).toContain(ch);
  });

  it('every glyph is exactly 5x8 pixels of . and #', () => {
    expect(GLYPH_WIDTH).toBe(5);
    expect(GLYPH_HEIGHT).toBe(8);
    for (const ch of FONT_CHARS) {
      const rows = glyphRows(ch);
      expect(rows, ch).toHaveLength(8);
      for (const r of rows) expect(r, ch).toMatch(/^[.#]{5}$/);
    }
  });

  it('space is blank and every other glyph has ink', () => {
    expect(glyphRows(' ').join('')).not.toContain('#');
    for (const ch of FONT_CHARS.replace(' ', '')) expect(glyphRows(ch).join(''), ch).toContain('#');
  });

  it('no two glyphs are identical (every character reads distinctly)', () => {
    const seen = new Map<string, string>();
    for (const ch of FONT_CHARS) {
      const k = glyphRows(ch).join('|');
      expect(seen.get(k), `${ch} duplicates ${seen.get(k) ?? ''}`).toBeUndefined();
      seen.set(k, ch);
    }
  });

  it('capitals and digits sit on the baseline (row 6) and leave the descender row empty', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      const rows = glyphRows(ch);
      expect(rows[6], ch).toContain('#');
      expect(rows[7], ch).toBe('.....');
    }
  });

  it('descenders use row 7', () => {
    for (const ch of 'gjpqy') expect(glyphRows(ch)[7], ch).toContain('#');
  });

  it('throws for a character outside the font', () => {
    expect(() => glyphRows('€')).toThrow();
  });
});

describe('fontSheet', () => {
  it('lays every glyph out on a fixed 6x10 grid, 16 per row, with no overlaps', () => {
    const sheet = fontSheet();
    expect(CELL_WIDTH).toBe(6);
    expect(CELL_HEIGHT).toBe(10);
    expect(sheet.chars).toBe(FONT_CHARS);
    expect(sheet.charsPerRow).toBe(16);
    expect(sheet.width).toBe(16 * 6);
    expect(sheet.height).toBe(Math.ceil(FONT_CHARS.length / 16) * 10);
    const cells = new Set<string>();
    for (const p of sheet.pixels) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(sheet.width);
      expect(p.y).toBeLessThan(sheet.height);
      cells.add(`${p.x},${p.y}`);
    }
    expect(cells.size).toBe(sheet.pixels.length);
  });

  it('places glyph i at column i % 16, row floor(i / 16)', () => {
    const sheet = fontSheet();
    const i = FONT_CHARS.indexOf('A');
    const ox = (i % 16) * 6;
    const oy = Math.floor(i / 16) * 10;
    const inA = sheet.pixels.filter((p) => p.x >= ox && p.x < ox + 6 && p.y >= oy && p.y < oy + 10);
    const expected = glyphRows('A').join('').split('').filter((c) => c === '#').length;
    expect(inA).toHaveLength(expected);
    // Nothing is drawn in the 1 px gutter column or the 2 px gutter rows of a cell.
    expect(inA.every((p) => p.x - ox < 5 && p.y - oy < 8)).toBe(true);
  });
});

describe('glyphSvg', () => {
  it('draws one rect per lit pixel at the given scale, with crisp edges', () => {
    const svg = glyphSvg('A', 4, '#ffffff');
    const lit = glyphRows('A').join('').split('').filter((c) => c === '#').length;
    expect(svg.match(/<rect /g)).toHaveLength(lit);
    expect(svg).toContain('width="20"');
    expect(svg).toContain('height="28"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });
});
