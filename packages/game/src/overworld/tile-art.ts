// Placeholder overworld tiles as data: 16x16 Endesga 32 swatches with simple patterns, one per tile kind, plus a
// second frame for the wild patch (its tall "unindexed data" grass sways and its data bits flicker) and the two
// blink frames of the eyes peeking out of it. Pure: overworld-ui/textures.ts turns these pixels into textures.

import type { TileKind } from './map.js';

export const TILE = 16;
/** The patch's sway, and the lurker's blink, per frame. */
export const PATCH_FRAME_MS = 420;

type Px = (number | null)[];

const C = {
  ink: 0x181425,
  plum: 0x3e2731,
  bark: 0x733e39,
  wood: 0xb86f50,
  tan: 0xe4a672,
  cream: 0xead4aa,
  rust: 0xbe4a2f,
  ember: 0xd77643,
  red: 0xa22633,
  scarlet: 0xe43b44,
  amber: 0xfeae34,
  lemon: 0xfee761,
  leaf: 0x63c74d,
  green: 0x3e8948,
  pine: 0x265c42,
  deep: 0x193c3e,
  cyan: 0x2ce8f5,
  magenta: 0xb55088,
  white: 0xffffff,
  cloud: 0xc0cbdc,
  mist: 0x8b9bb4,
  steel: 0x5a6988,
  slate: 0x3a4466,
  night: 0x262b44,
} as const;

/** A small stable hash for speckle placement, so every tile is the same on every run. */
const noise = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x * 374761393 + y * 668265263 + seed * 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const blank = (fill: number | null): Px => new Array<number | null>(TILE * TILE).fill(fill);
const put = (px: Px, x: number, y: number, c: number | null) => {
  if (x >= 0 && y >= 0 && x < TILE && y < TILE) px[y * TILE + x] = c;
};
const rect = (px: Px, x0: number, y0: number, w: number, h: number, c: number) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(px, x, y, c);
};

function grass(): Px {
  const px = blank(C.green);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = noise(x, y, 1);
      if (n < 0.08) put(px, x, y, C.leaf);
      else if (n > 0.95) put(px, x, y, C.pine);
    }
  }
  // Two little tufts.
  for (const [x, y] of [[3, 5], [11, 11]] as const) {
    put(px, x, y, C.pine);
    put(px, x + 2, y, C.pine);
    put(px, x + 1, y + 1, C.pine);
  }
  return px;
}

function path(): Px {
  const px = blank(C.tan);
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const n = noise(x, y, 2);
      if (n < 0.07) put(px, x, y, C.wood);
      else if (n > 0.94) put(px, x, y, C.cream);
    }
  }
  return px;
}

function tree(canopy: readonly [number, number, number], outline: number): Px {
  const px = grass();
  const [dark, mid, light] = canopy;
  rect(px, 7, 12, 2, 4, C.bark);
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(x - 7.5, y - 6.5);
      if (d > 7.2) continue;
      const lit = x + y < 11 && d < 5.5;
      put(px, x, y, d > 6.3 ? outline : lit ? mid : dark);
      if (lit && noise(x, y, 3) < 0.18) put(px, x, y, light);
    }
  }
  return px;
}

function wall(): Px {
  const px = blank(C.steel);
  rect(px, 0, 0, TILE, 1, C.mist);
  for (let y = 4; y < TILE; y += 4) rect(px, 0, y, TILE, 1, C.slate);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 === 0 ? 3 : 11;
    rect(px, off, row * 4 + 1, 1, 3, C.slate);
  }
  return px;
}

function roof(): Px {
  const px = blank(C.red);
  for (let y = 0; y < TILE; y++) {
    const shift = Math.floor(y / 4) % 2 === 0 ? 0 : 2;
    for (let x = 0; x < TILE; x++) {
      if (y % 4 === 3) put(px, x, y, C.plum);
      else if ((x + shift) % 4 === 0) put(px, x, y, C.scarlet);
    }
  }
  return px;
}

function rack(): Px {
  const px = blank(C.night);
  rect(px, 0, 0, TILE, 1, C.steel);
  rect(px, 1, 1, 1, 15, C.slate);
  rect(px, 14, 1, 1, 15, C.slate);
  for (let y = 3; y < TILE; y += 4) {
    rect(px, 2, y, 12, 1, C.slate);
    put(px, 4, y - 1, C.leaf);
    put(px, 6, y - 1, y % 8 === 3 ? C.cyan : C.amber);
  }
  return px;
}

function floor(): Px {
  const px = blank(C.cloud);
  rect(px, 0, 15, TILE, 1, C.mist);
  rect(px, 15, 0, 1, TILE, C.mist);
  rect(px, 0, 7, TILE, 1, C.mist);
  rect(px, 7, 0, 1, TILE, C.mist);
  put(px, 2, 2, C.white);
  put(px, 10, 10, C.white);
  return px;
}

function door(): Px {
  const px = wall();
  rect(px, 3, 1, 10, 15, C.bark);
  rect(px, 4, 2, 8, 14, C.wood);
  rect(px, 4, 8, 8, 1, C.bark);
  put(px, 10, 10, C.amber);
  return px;
}

/** The board sits high on its post, so the head of someone reading it from below doesn't cover it. */
function sign(): Px {
  const px = grass();
  rect(px, 7, 7, 2, 9, C.bark);
  rect(px, 1, 0, 14, 8, C.bark);
  rect(px, 2, 1, 12, 6, C.wood);
  for (const y of [2, 4]) rect(px, 4, y, y === 4 ? 5 : 8, 1, C.plum);
  return px;
}

/** Tall dark grass with glitchy data bits; frame 1 sways the blade tips and moves the bits. */
function patch(frame: number): Px {
  const px = blank(C.deep);
  for (let x = 0; x < TILE; x++) {
    const height = 9 + Math.floor(noise(x, 0, 7) * 6);
    const sway = frame === 1 && x % 2 === 0 ? 1 : 0;
    for (let y = TILE - height; y < TILE; y++) put(px, x, y, (x + Math.floor(y / 3)) % 3 === 0 ? C.green : C.pine);
    put(px, Math.min(TILE - 1, x + sway), TILE - height - 1, C.green);
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(noise(i, frame, 11) * TILE);
    const y = 3 + Math.floor(noise(i, frame, 13) * 12);
    put(px, x, y, i % 2 === 0 ? C.cyan : C.magenta);
  }
  return px;
}

const DRAW: Readonly<Record<TileKind, (frame: number) => Px>> = {
  void: () => blank(C.ink),
  grass,
  path,
  tree: () => tree([C.pine, C.green, C.leaf], C.deep),
  oldTree: () => tree([C.rust, C.ember, C.tan], C.bark),
  wall,
  roof,
  rack,
  floor,
  door,
  sign,
  patch,
};

const FRAMES_OF: Readonly<Partial<Record<TileKind, number>>> = { patch: 2 };

/** The 16x16 pixels of a tile kind (row-major, opaque). */
export const tilePixels = (kind: TileKind, frame = 0): Px => DRAW[kind](frame);

/** Every tile frame in the generated tileset texture, in order: one per kind, then the patch's second frame. */
export const TILESET: readonly { readonly kind: TileKind; readonly frame: number }[] = (Object.keys(DRAW) as TileKind[]).flatMap((kind) =>
  Array.from({ length: FRAMES_OF[kind] ?? 1 }, (_, frame) => ({ kind, frame })),
);

export const tileIndex = (kind: TileKind, frame = 0): number => TILESET.findIndex((f) => f.kind === kind && f.frame === frame);

/** The wild model's eyes in the patch: open, then a blink. Transparent elsewhere. */
export function lurkPixels(frame: number): Px {
  const px = blank(null);
  for (const x0 of [4, 9]) {
    if (frame === 0) {
      rect(px, x0, 6, 3, 2, C.lemon);
      put(px, x0 + 1, 7, C.ink);
    } else {
      rect(px, x0, 7, 3, 1, C.amber);
    }
  }
  return px;
}
