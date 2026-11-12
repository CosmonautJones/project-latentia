// Overworld tiles, 24x24, one per TileKind in packages/game/src/overworld/tile-art.ts, in that file's
// order, plus the wild patch's second frame and the lurking-eyes overlay (the only transparent frames).
// Map tiles carry no neighbour information, so every tile is drawn to sit beside any other: trees and
// the sign bring their own grass, the rack and door their own wall.

import { Cv, noise, and, sub, or } from '../src/draw.mjs';

const N = 24;
const tile = (fill) => {
  const cv = new Cv(N, N);
  cv.rect(0, 0, N, N, fill);
  return cv;
};

function grass() {
  const cv = tile('d');
  // Blade tufts: a lit "v" with a dark root. Hand-placed so the repeat does not line up into rows.
  for (const [x, y, lit] of [[2, 3, 1], [14, 1, 0], [8, 8, 1], [19, 9, 1], [3, 14, 0], [12, 16, 1], [20, 19, 0], [6, 21, 1], [16, 22, 0]]) {
    cv.stamp(lit ? `
      c.c
      .c.
      .e.` : `
      e.e
      .e.`, x, y);
  }
  for (const [x, y] of [[10, 4], [22, 14], [0, 9], [15, 12]]) cv.rect(x, y, 2, 1, 'c');
  for (const [x, y] of [[5, 10], [18, 4], [10, 20], [23, 23]]) cv.rect(x, y, 2, 1, 'e');
  return cv;
}

function path() {
  const cv = tile('3');
  // Packed earth: flat pebbles with a cream top and a wood underside, and a few wheel scuffs.
  for (const [x, y, w] of [[3, 3, 3], [15, 2, 2], [9, 9, 3], [19, 12, 3], [2, 16, 2], [12, 19, 3], [6, 12, 2], [20, 20, 2]]) {
    cv.rect(x, y, w, 1, '2');
    cv.rect(x, y + 1, w, 1, '4');
  }
  for (const [x, y] of [[8, 5], [0, 10], [14, 14], [22, 6], [5, 21], [17, 17]]) cv.rect(x, y, 2, 1, noise(x, y, 5) > 0.5 ? '4' : '2');
  return cv;
}

/** A tree on grass: a clumped round crown, a short trunk and its ground shadow. */
function tree(ramp, line, trunk, old) {
  const cv = grass();
  cv.paint(cv.ell(12, 21.5, 8, 2.4), 'e'); // ground shadow
  cv.rect(10, 16, 4, 7, trunk[1]);
  cv.rect(10, 16, 1, 7, trunk[0]);
  cv.rect(13, 16, 1, 7, trunk[2]);
  cv.dots(trunk[2], [9, 22], [14, 22], [11, 19]);
  if (old) {
    // A bare limb reaching out of the thinning crown.
    cv.stamp(`
      5...
      .55.
      ...5`, 18, 2);
  }
  const crown = or(cv.ell(12, 9.5, 10.5, 8.5), cv.ell(6.5, 12, 5.5, 5), cv.ell(17.5, 12, 5.5, 5), cv.ell(12, 5, 7, 5));
  cv.outline(crown, line, line);
  cv.ball(crown, 11, 9, 13, 11, ramp, [0.93, 0.5, 0.12]);
  // Leaf clumps: lit crescents over shaded pockets, so the crown is a mass of foliage and not a ball.
  for (const [x, y] of [[5, 6], [12, 3], [16, 8], [8, 11], [14, 13], [4, 12]]) {
    cv.stamp(`
      .aa.
      a...
      ....
      .bb.`, x, y, { map: { a: ramp[x + y < 16 ? 0 : 1], b: ramp[x + y < 16 ? 2 : 3] } });
  }
  if (old) {
    // Gaps where leaves have dropped, and the leaves themselves on the grass.
    cv.dots(line, [9, 7], [10, 7], [15, 11], [16, 11], [7, 14]);
    for (const [x, y] of [[2, 20], [20, 18], [22, 22], [5, 23]]) cv.rect(x, y, 2, 1, ramp[1]);
  }
  return cv;
}

function wall() {
  // The lab is a converted garage: corrugated steel, a pale cap and a dark footing.
  const cv = tile('m');
  for (let x = 0; x < N; x += 4) {
    cv.rect(x, 0, 1, N, 'l');
    cv.rect(x + 3, 0, 1, N, 'n');
  }
  cv.rect(0, 0, N, 1, 'k');
  cv.rect(0, 1, N, 1, 'l');
  cv.rect(0, 2, N, 1, 'n');
  cv.rect(0, N - 3, N, 1, 'n');
  cv.rect(0, N - 2, N, 2, 'o');
  for (const x of [5, 17]) cv.dots('k', [x, 5], [x + 1, 5]).dots('n', [x, 6], [x + 1, 6]); // rivets
  return cv;
}

function roof() {
  // Scalloped red shingles in offset courses; each course throws a shadow on the next.
  const cv = tile('7');
  for (let row = 0; row < 4; row++) {
    const y = row * 6, off = row % 2 ? 3 : 0;
    cv.rect(0, y, N, 1, '8');
    cv.rect(0, y + 5, N, 1, '6');
    for (let x = -off; x < N; x += 6) {
      cv.rect(x + 5, y + 1, 1, 4, '5');
      cv.rect(x, y + 1, 1, 3, '8');
      cv.dots('6', [x, y + 5], [x + 4, y + 5]).dots('7', [x + 1, y + 5], [x + 3, y + 5], [x + 2, y + 5]);
      cv.dots('6', [x + 1, y + 4], [x + 3, y + 4]).set(x + 5, y + 4, '6');
    }
  }
  return cv;
}

function rack() {
  // A server cabinet against the wall. Old mining rigs: mostly idle, a few lights still on.
  const cv = wall();
  cv.rect(1, 1, 22, 23, 'p');
  cv.rect(2, 2, 20, 21, 'o');
  cv.rect(2, 2, 20, 1, 'm');
  cv.rect(2, 3, 1, 20, 'n');
  for (let u = 0; u < 4; u++) {
    const y = 4 + u * 5;
    cv.rect(4, y, 16, 4, 'n');
    cv.rect(4, y, 16, 1, 'm');
    cv.rect(4, y + 3, 16, 1, 'p');
    for (let x = 10; x < 19; x += 2) cv.rect(x, y + 1, 1, 2, 'o'); // vents
    cv.set(5, y + 1, ['c', 'a', 'c', 'i'][u]).set(5, y + 2, ['d', '9', 'd', 'h'][u]);
    cv.set(7, y + 1, ['i', 'o', 'c', 'o'][u]).set(7, y + 2, ['h', 'o', 'd', 'o'][u]);
  }
  return cv;
}

function floor() {
  // Poured concrete in four slabs: pale, with seams, a little wear and one stain.
  const cv = tile('k');
  for (const o of [0, 12]) {
    cv.rect(o + 11, 0, 1, N, 'l');
    cv.rect(0, o + 11, N, 1, 'l');
    cv.rect(o, 0, 1, N, 'j');
    cv.rect(0, o, N, 1, 'j');
  }
  for (const o of [11, 23]) for (const q of [11, 23]) cv.set(o, q, 'm');
  for (const [x, y] of [[4, 5], [17, 3], [7, 18], [19, 16]]) cv.rect(x, y, 2, 1, 'l');
  return cv;
}

function door() {
  const cv = wall();
  cv.rect(3, 1, 18, 23, 'p');
  cv.rect(4, 2, 16, 22, '4');
  // Planks, a lit left edge and a shaded right one.
  for (const x of [8, 12, 16]) cv.rect(x, 2, 1, 22, '5');
  cv.rect(4, 2, 1, 22, '3');
  cv.rect(19, 2, 1, 22, '5');
  // A wired-glass window and a kick plate.
  cv.rect(6, 4, 12, 7, 'p');
  cv.rect(7, 5, 10, 5, 'h');
  cv.rect(7, 5, 10, 1, 'i');
  cv.dots('j', [8, 6], [9, 7], [10, 8]).dots('i', [13, 6], [14, 7]);
  cv.rect(5, 19, 14, 4, 'm').rect(5, 19, 14, 1, 'l').rect(5, 22, 14, 1, 'n');
  cv.rect(16, 13, 2, 3, 'a').rect(16, 15, 2, 1, '9').set(16, 13, 'b');
  return cv;
}

function sign() {
  // A board high on its post, so a reader standing below does not cover it.
  const cv = grass();
  cv.paint(cv.ell(12, 22, 5, 1.6), 'e');
  cv.rect(10, 12, 4, 11, 'p');
  cv.rect(11, 12, 2, 10, '4').rect(12, 12, 1, 10, '5');
  cv.rect(1, 0, 22, 14, 'p');
  cv.rect(2, 1, 20, 12, '4');
  cv.rect(3, 2, 18, 10, '3');
  cv.rect(3, 2, 18, 1, '2').rect(3, 11, 18, 1, '4').rect(20, 2, 1, 10, '4');
  cv.rect(5, 4, 12, 1, '6').rect(5, 6, 14, 1, '6').rect(5, 8, 9, 1, '6');
  cv.dots('5', [3, 2], [20, 2], [3, 11], [20, 11]); // nails
  return cv;
}

/** Unindexed data: tall dark grass with stray bits caught in it. Frame 1 leans the tips and moves the bits. */
function patch(frame) {
  const cv = tile('f');
  const blade = (x, base, h, c, lean) => {
    for (let i = 0; i < h; i++) {
      const y = base - i;
      const sx = x + (i > h - 3 ? lean : 0);
      cv.set((sx + N) % N, y, c);
      if (i < h * 0.4) cv.set((sx + 1) % N, y, c);
    }
  };
  const lean = frame ? 1 : 0;
  // Two ranks of blades per tile, so stacked tiles read as rows of tall grass and not as stripes.
  for (const [base, seed] of [[11, 3], [23, 9]]) {
    for (let x = 0; x < N; x += 2) blade(x, base, 10 + Math.floor(noise(x, seed, 7) * 3), 'e', x % 4 ? lean : 0);
    for (let x = 1; x < N; x += 3) blade(x, base, 6 + Math.floor(noise(x, seed + 1, 7) * 4), 'd', lean);
    for (let x = 2 + (seed % 2); x < N; x += 5) blade(x, base, 3 + Math.floor(noise(x, seed + 2, 7) * 4), 'c', x % 2 ? lean : -lean);
  }
  // Bits: cyan and magenta 2x1 blocks, as if a table had been shredded into the grass.
  const bits = frame
    ? [[4, 2, 'i'], [15, 1, 's'], [20, 13, 'i'], [9, 14, 's'], [1, 3, 'h']]
    : [[6, 1, 'i'], [17, 3, 's'], [21, 14, 'h'], [10, 13, 'i'], [2, 15, 's']];
  for (const [x, y, c] of bits) cv.rect(x, y, 2, 1, c);
  return cv;
}

/** The wild model's eyes in the patch: open, then a blink. Drawn over a patch tile. */
function lurk(frame) {
  const cv = new Cv(N, N);
  for (const x of [5, 13]) {
    if (frame === 0) {
      cv.rect(x, 9, 6, 5, 'p');
      cv.rect(x + 1, 10, 4, 3, 'b');
      cv.rect(x + 1, 12, 4, 1, 'a');
      cv.rect(x + 1, 11, 2, 2, 'p');
      cv.set(x + 1, 10, 'j');
    } else {
      cv.rect(x, 11, 6, 3, 'p');
      cv.rect(x + 1, 12, 4, 1, 'a');
    }
  }
  return cv;
}

const frames = {
  void: [tile('p')],
  grass: [grass()],
  path: [path()],
  tree: [tree('cdef', 'f', 'v45', false)],
  oldTree: [tree('3105', '6', '456', true)],
  wall: [wall()],
  roof: [roof()],
  rack: [rack()],
  floor: [floor()],
  door: [door()],
  sign: [sign()],
  patch: [patch(0), patch(1)],
};
const overlays = [lurk(0), lurk(1)];

// The real map rows (packages/game/src/content/maps/localhost.ts), for the review sheet's mock-up.
const LAB = ['WWWWWWWWWWWW', 'WKKWWWWWWKKW', 'W__________W', 'W__________W', 'W__________W', 'W__________W', 'W__________W', 'WWWWWDWWWWWW'];
const OUTSIDE = [
  '##############################%%%%%%%%%%%%%%%%%%',
  '#.RRRRRRR...#.....############%%%%%....%%%%%%%%%',
  '#.RRRRRRR.........###########%S"""".....%%%%%%%%',
  '#.WWWDWWW.........####,,,,,,,,.""""......%%%%%%%',
  '#....,..........######,,,,,,,,.""""......%%%%%%%',
  '#....,..........######,,######%"""".....%%%%%%%%',
  '#....,,,,,,,,,,,,,,,,,,,######%%%%%....,,,,,,,,,',
  '#..#.....#..,,,,,,,,,,,,######%%%%%.....%%%%%%%%',
  '#.....#.........##############%%%%%%....%%%%%%%%',
];
const legend = {
  ' ': frames.void[0], '.': frames.grass[0], ',': frames.path[0], '#': frames.tree[0], '%': frames.oldTree[0], W: frames.wall[0],
  R: frames.roof[0], K: frames.rack[0], _: frames.floor[0], D: frames.door[0], S: frames.sign[0], '"': frames.patch[0],
};

export default {
  tiles: Object.entries(frames).map(([kind, f]) => ({ kind, frames: f })),
  overlays,
  overlayNames: { lurk: 2 },
  patchMs: 420,
  legend,
  mock: [LAB, OUTSIDE.map((r) => r.slice(0, 24)), OUTSIDE.map((r) => r.slice(24))],
};
void and; void sub;
