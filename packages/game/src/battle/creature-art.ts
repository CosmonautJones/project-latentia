// Battle art for creatures, as data. The three starters use the Fable style-test idle sheets (art/style-test on the
// art branch; credited in the README). Every other species gets a generated placeholder: a rounded silhouette in
// its type colour, outlined and shaded, with its initial in the font, all from the Endesga 32 palette. Pure: the
// scene turns these pixels into textures.

import { SPECIES } from '@latentia/engine';
import { glyphRows, GLYPH_WIDTH } from '../text/glyphs.js';
import { COLOR } from '../ui/palette.js';
import { TYPE_COLORS } from './labels.js';

export interface SheetDef {
  /** Under public/. */
  readonly file: string;
  readonly frames: number;
  readonly frameSize: number;
  /** Per frame (the style test's authored delays: 100 ms, Blitzr's faster 75 ms per the bible). */
  readonly frameMs: number;
}

export const FABLE_SHEETS = {
  sagelet: { file: 'assets/sagelet-idle.png', frames: 6, frameSize: 64, frameMs: 100 },
  blitzr: { file: 'assets/blitzr-idle.png', frames: 6, frameSize: 64, frameMs: 75 },
  forkling: { file: 'assets/forkling-idle.png', frames: 6, frameSize: 64, frameMs: 100 },
} as const satisfies Record<string, SheetDef>;

export const hasSheet = (species: string): species is keyof typeof FABLE_SHEETS => Object.hasOwn(FABLE_SHEETS, species);

export const PLACEHOLDER_FRAMES = 2;
/** A slow two-frame breathe. */
export const PLACEHOLDER_FRAME_MS = 400;
const SIZE = 64;
/** Where silhouettes stand, matching the Fable sheets' common baseline. */
const BASELINE = 58;

export interface PlaceholderArt {
  readonly size: number;
  readonly initial: string;
  readonly fill: number;
  readonly initialColor: number;
  /** Row-major SIZE×SIZE palette colours, null for transparent; one array per idle frame. */
  readonly frames: readonly (readonly (number | null)[])[];
}

/** A small stable hash of the species id, for its shape variation. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const luminance = (c: number): number => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;

interface Shape {
  readonly rx: number;
  readonly ry: number;
  /** Superellipse exponent: 2 is an ellipse, higher is boxier. */
  readonly power: number;
  readonly ears: boolean;
}

function inside(shape: Shape, cx: number, cy: number, x: number, y: number): boolean {
  const dx = Math.abs(x + 0.5 - cx) / shape.rx;
  const dy = Math.abs(y + 0.5 - cy) / shape.ry;
  if (dx ** shape.power + dy ** shape.power <= 1) return true;
  if (!shape.ears) return false;
  // Two small round ears on top.
  for (const ex of [cx - shape.rx * 0.55, cx + shape.rx * 0.55]) {
    const ey = cy - shape.ry * 0.9;
    if ((x + 0.5 - ex) ** 2 + (y + 0.5 - ey) ** 2 <= 16) return true;
  }
  return false;
}

function frame(shape: Shape, fill: number, shade: number, light: number, initial: string, initialColor: number): (number | null)[] {
  const cx = SIZE / 2;
  const cy = BASELINE - shape.ry;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && inside(shape, cx, cy, x, y);
  const px: (number | null)[] = new Array<number | null>(SIZE * SIZE).fill(null);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!solid(x, y)) continue;
      const edge = !solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1);
      // Light from the top-right in battle (bible): the lower-left rim is in shade.
      const shaded = !solid(x - 3, y + 3);
      const lit = !solid(x + 2, y - 2) && !edge;
      px[y * SIZE + x] = edge ? COLOR.ink : lit ? light : shaded ? shade : fill;
    }
  }
  // The initial at 2×, centred on the body.
  const rows = glyphRows(initial).slice(0, 7);
  const ox = Math.round(cx - GLYPH_WIDTH);
  const oy = Math.round(cy - 6);
  rows.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] !== '#') continue;
      for (let k = 0; k < 4; k++) {
        const x = ox + gx * 2 + (k & 1);
        const y = oy + gy * 2 + (k >> 1);
        if (solid(x, y)) px[y * SIZE + x] = initialColor;
      }
    }
  });
  return px;
}

export function placeholderArt(speciesId: string): PlaceholderArt {
  const species = SPECIES[speciesId as keyof typeof SPECIES];
  const type = species?.types[0] ?? 'memory';
  const { fill, shade, light } = TYPE_COLORS[type];
  const h = hash(speciesId);
  const shape: Shape = { rx: 17 + (h % 6), ry: 15 + ((h >>> 3) % 6), power: 2 + ((h >>> 6) % 3) * 0.75, ears: ((h >>> 9) & 1) === 1 };
  const initial = (species?.name ?? speciesId).charAt(0).toUpperCase();
  const initialColor = luminance(fill) > 110 ? COLOR.ink : COLOR.white;
  // Frame 2 breathes out: one pixel shorter and wider, still on the baseline.
  const breathe: Shape = { ...shape, rx: shape.rx + 1, ry: shape.ry - 1 };
  return {
    size: SIZE,
    initial,
    fill,
    initialColor,
    frames: [frame(shape, fill, shade, light, initial, initialColor), frame(breathe, fill, shade, light, initial, initialColor)],
  };
}
