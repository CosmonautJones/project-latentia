// Placeholder people as data: a 16x32 two-tone figure (top and bottom colours) with an ink outline, in 4 facings
// (the eyes, and the backpack from behind, show which way it looks) and 2 frames (standing, and a walk bob where
// the body drops a pixel and the legs part). Left is right mirrored. Shown centred in 24x32 frames on the 24 px
// tiles until the art pass lands. Pure; the scene builds textures from it.

import { DIRS, type Dir } from './direction.js';
import type { LookId } from './map.js';
import { padWidth } from './upscale.js';

export const FIGURE_W = 16;
export const FIGURE_H = 32;
/** v0.1's overworld character frames are 24x32; the 16 px placeholder figure stands centred in one. */
export const FIGURE_FRAME_W = 24;

export interface Look {
  readonly top: number;
  readonly bottom: number;
  readonly skin: number;
  readonly hair: number;
  readonly accent: number;
}

/** Endesga 32 only; every look has its own top colour so NPCs read apart at a glance. */
export const LOOKS: Readonly<Record<LookId, Look>> = {
  player: { top: 0x0099db, bottom: 0x124e89, skin: 0xe8b796, hair: 0x3e2731, accent: 0xfeae34 },
  professor: { top: 0xc0cbdc, bottom: 0x5a6988, skin: 0xe8b796, hair: 0x8b9bb4, accent: 0x2ce8f5 },
  farmer: { top: 0x3e8948, bottom: 0x124e89, skin: 0xc28569, hair: 0xfeae34, accent: 0xbe4a2f },
  grad: { top: 0xf77622, bottom: 0x3a4466, skin: 0xb86f50, hair: 0x181425, accent: 0xffffff },
};

const INK = 0x181425;
const SHOE = 0x3e2731;

type Px = (number | null)[];

function draw(look: Look, dir: Exclude<Dir, 'left'>, frame: 0 | 1): Px {
  const px: Px = new Array<number | null>(FIGURE_W * FIGURE_H).fill(null);
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < FIGURE_W && y < FIGURE_H) px[y * FIGURE_W + x] = c;
  };
  const rect = (x0: number, y0: number, w: number, h: number, c: number) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  const bob = frame;
  const side = dir === 'right';

  // Legs and shoes (they stay planted; the walk frame parts them).
  const spread = frame === 1 ? 1 : 0;
  rect(4 - spread, 24, 3, 6, look.bottom);
  rect(9 + spread, 24, 3, 6, look.bottom);
  rect(4 - spread, 30, 3, 1, SHOE);
  rect(9 + spread, 30, 3, 1, SHOE);
  rect(7, 24 + bob, 2, 2, look.bottom);

  // Torso and arms in the top colour.
  rect(4, 16 + bob, 8, 8, look.top);
  rect(3, 17 + bob, 1, 6, look.top);
  rect(12, 17 + bob, 1, 6, look.top);
  put(3, 23 + bob, look.skin);
  put(12, 23 + bob, look.skin);

  // Head: hair on top, face below.
  rect(4, 8 + bob, 8, 8, look.skin);
  rect(4, 8 + bob, 8, 3, look.hair);
  if (dir === 'up') {
    rect(4, 11 + bob, 8, 4, look.hair);
    rect(5, 17 + bob, 6, 5, look.accent); // the backpack, seen from behind
  } else if (side) {
    rect(4, 11 + bob, 3, 3, look.hair);
    put(10, 12 + bob, INK);
    put(10, 13 + bob, INK);
    put(12, 13 + bob, look.skin); // the nose
    rect(4, 17 + bob, 2, 5, look.accent); // a backpack strap behind
  } else {
    put(6, 12 + bob, INK);
    put(6, 13 + bob, INK);
    put(9, 12 + bob, INK);
    put(9, 13 + bob, INK);
    rect(7, 17 + bob, 2, 1, look.accent); // the collar
  }

  // A one-pixel ink outline around the whole silhouette.
  const filled = px.map((c) => c !== null);
  for (let y = 0; y < FIGURE_H; y++) {
    for (let x = 0; x < FIGURE_W; x++) {
      if (filled[y * FIGURE_W + x]) continue;
      const near = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => nx! >= 0 && ny! >= 0 && nx! < FIGURE_W && ny! < FIGURE_H && filled[ny! * FIGURE_W + nx!]);
      if (near) px[y * FIGURE_W + x] = INK;
    }
  }
  return px;
}

const mirror = (px: Px): Px => px.map((_, i) => px[Math.floor(i / FIGURE_W) * FIGURE_W + (FIGURE_W - 1 - (i % FIGURE_W))] ?? null);

/** One frame of a figure, row-major 16x32, null for transparent. */
export function figureFrame(look: LookId, dir: Dir, frame: 0 | 1): Px {
  const l = LOOKS[look];
  return dir === 'left' ? mirror(draw(l, 'right', frame)) : draw(l, dir, frame);
}

/** One frame of a figure's 24x32 sheet: the 16 px figure centred (one tile wide, a third of a tile above it). */
export const figureSheetFrame = (look: LookId, dir: Dir, frame: 0 | 1): Px => padWidth(figureFrame(look, dir, frame), FIGURE_W, FIGURE_H, FIGURE_FRAME_W);

/** The frame number in a figure's sheet: two per facing, in DIRS order. */
export const figureFrameIndex = (dir: Dir, frame: 0 | 1): number => DIRS.indexOf(dir) * 2 + frame;
export const FIGURE_FRAMES = DIRS.length * 2;
