import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ART, artFile, BATTLE_SPECIES, battleSheet } from '../../src/art/sheets.js';
import { ART_REACH, SPRITE_REACH } from '../../src/battle-ui/stage-layout.js';

// ART_REACH (stage-layout.ts) is hand-copied from the art pass's battle sheets: tie it to the PNGs (review Minor 3).
// For each species, the highest opaque row of any idle frame, measured up from the baseline, must be ART_REACH (measured from the feet).

const PUBLIC = join(import.meta.dirname, '../../public');

/** An 8-bit RGBA, non-interlaced PNG's alpha channel, row by row (enough for the art pass's sheets). */
function alpha(file: string): { width: number; height: number; at: (x: number, y: number) => number } {
  const b = readFileSync(file);
  const width = b.readUInt32BE(16);
  const height = b.readUInt32BE(20);
  expect([b[24], b[25], b[28]], `${file}: 8-bit RGBA, not interlaced`).toEqual([8, 6, 0]);
  const idat: Buffer[] = [];
  for (let p = 8; p < b.length; ) {
    const len = b.readUInt32BE(p);
    const type = b.subarray(p + 4, p + 8).toString('ascii');
    if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)] ?? 0;
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i] ?? 0;
      const a = i >= bpp ? (px[y * stride + i - bpp] ?? 0) : 0;
      const up = y > 0 ? (px[(y - 1) * stride + i] ?? 0) : 0;
      const c = i >= bpp && y > 0 ? (px[(y - 1) * stride + i - bpp] ?? 0) : 0;
      const paeth = () => {
        const p = a + up - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      };
      const pred = [0, a, up, (a + up) >> 1, paeth()][filter] ?? 0;
      px[y * stride + i] = (x + pred) & 0xff;
    }
  }
  return { width, height, at: (x, y) => px[y * stride + x * bpp + 3] ?? 0 };
}

describe('ART_REACH matches the battle sheets', () => {
  for (const species of BATTLE_SPECIES) {
    it(`${species}: the highest opaque row of an idle frame is ART_REACH above the feet`, () => {
      const sheet = battleSheet(species);
      expect(sheet).not.toBeNull();
      if (sheet === null) return;
      const s = ART.sheets[sheet.id];
      if (s === undefined) throw new Error(`no sheet ${sheet.id}`);
      const png = alpha(join(PUBLIC, artFile(s.file)));
      let top = s.frameHeight;
      for (const frame of sheet.idle.frames) {
        for (let y = 0; y < s.frameHeight && y < top; y++) {
          for (let x = 0; x < s.frameWidth; x++) {
            if (png.at(frame * s.frameWidth + x, y) > 0) {
              top = y;
              break;
            }
          }
        }
      }
      // The feet stand on the row under the baseline (origin (baseline + 1) / height), so the reach counts the baseline row.
      expect(ART_REACH[species]).toBe(sheet.baseline + 1 - top);
      expect(ART_REACH[species] ?? 0).toBeLessThanOrEqual(SPRITE_REACH.up);
    });
  }
});
