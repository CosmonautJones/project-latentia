// Forkling: three stacked rounded cubes with a git-fork tail. Open type.
// The 64 px study, redrawn at 96. The study's blocks read as lozenges because
// the top and front planes were one green; here each block has three planes
// (glossy lemon-lit top, leaf front with a green foot, pine side) and a bevel
// between them. The fork glyph on its chest and the fork tail are the same mark.
//
// Planes b c d e (lemon gloss, leaf, green, pine) | fork t s r (pink, magenta, violet) | line e / p

import { Cv, or, sub, and, shift, wave } from '../../src/draw.mjs';

const S = 96, BASE = 87;

/** One block: front face at (x, y) w by h, extruded d pixels up and to the right. */
function cube(cv, x, y, w, h, d) {
  const front = cv.sup(x + w / 2, y + h / 2, w / 2, h / 2, 7);
  let hull = front;
  for (let k = 1; k <= d; k++) hull = or(hull, shift(front, S, k, -k));
  const top = new Uint8Array(S * S), side = new Uint8Array(S * S);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      if (!hull[i] || front[i]) continue;
      // The diagonal through the front face's top-right corner divides the top plane from the side.
      (px + py > x + w + y ? side : top)[i] = 1;
    }
  }
  cv.outline(hull, 'e', 'e');
  cv.paint(front, 'c');
  cv.paint(top, 'c');
  cv.paint(side, 'd');
  // Top: a broad lemon gloss toward the light.
  cv.paint(and(top, cv.mask((px, py) => px + py * 0.9 < x + w * 0.62 + (y - d) * 0.9 + 1 && py < y - 1)), 'b');
  // Bevel: the front face's top edge catches the light, its right edge and foot fall away.
  cv.paint(and(front, and(cv.box(x + 2, y, w * 0.55, 1.5), front)), 'b');
  cv.paint(and(front, cv.box(0, y + h - Math.max(3, h * 0.2), S, h)), 'd');
  cv.paint(and(front, cv.box(x + w - 2, 0, 3, S)), 'd');
  cv.paint(and(side, cv.mask((px, py) => py > y + h * 0.55 - (px - x - w))), 'e');
  // A soft specular on the front face.
  cv.paint(and(front, cv.ell(x + 5.5, y + 5, 2.6, 1.6, -0.5)), 'b');
  return { front, hull, top, side };
}

function fork(cv, root, flex, hit) {
  // Trunk out of the low block, a commit node, then two prongs with ring nodes.
  const split = [root[0] + 10, root[1] - 7 - flex * 0.5];
  const a = [split[0] - 1 + flex * 0.5, split[1] - 15 - flex], b = [split[0] + 12 + flex * 0.4, split[1] - 10 - flex * 0.4 + (hit ? 6 : 0)];
  const stems = or(cv.tube([[root[0] - 3, root[1] + 1, 2.4], [root[0] + 5, root[1], 2], [split[0], split[1], 1.8]]), cv.tube([[split[0], split[1], 1.7], [a[0], a[1], 1.6]]), cv.tube([[split[0], split[1], 1.7], [split[0] + 8, split[1] - 3, 1.6], [b[0], b[1], 1.6]]));
  cv.outline(stems, 'p', 'r');
  cv.paint(stems, 's');
  cv.paint(sub(stems, shift(stems, S, -1, -1)), 'r');
  for (const [n, r] of [[split, 3.2], [a, 3.8], [b, 3.8]]) {
    const ring = cv.ell(n[0], n[1], r, r);
    cv.outline(ring, 'p', 'r');
    cv.paint(ring, 's');
    cv.paint(and(ring, cv.mask((px, py) => px - n[0] + (py - n[1]) < -r * 0.5)), 't');
    cv.paint(and(ring, cv.mask((px, py) => px - n[0] + (py - n[1]) > r * 0.7)), 'r');
    cv.paint(cv.ell(n[0], n[1], r - 2.3, r - 2.3), 'p');
  }
}

function draw(p) {
  const cv = new Cv(S, S);
  const ox = p.dx ?? 0;
  const B = p.blocks; // per block: [dx, dy (up is negative), squash]
  const hit = !!p.mode;

  // Low block sits on the baseline; each block above rests on the one below.
  const lowH = 22 - B[0][2], midH = 19 - B[1][2], topH = 19 - B[2][2];
  const low = { x: 19 + ox + B[0][0], y: BASE - lowH, w: 31 + B[0][2], h: lowH, d: 7 };
  const mid = { x: 25 + ox + B[1][0], y: low.y - 1 - midH + B[1][1], w: 26 + B[1][2], h: midH, d: 6 };
  const top = { x: 29 + ox + B[2][0], y: mid.y - 1 - topH + B[2][1], w: 23 + B[2][2], h: topH, d: 6 };

  fork(cv, [low.x + low.w + 5, low.y + 9], p.flex ?? 0, hit);

  const cl = cube(cv, low.x, low.y, low.w, low.h, low.d);
  const cm = cube(cv, mid.x, mid.y, mid.w, mid.h, mid.d);
  // Each block throws a shadow on the top plane below it.
  cv.remap(and(cl.top, shift(cm.hull, S, 3, 4)), { b: 'c', c: 'd' });
  cube(cv, mid.x, mid.y, mid.w, mid.h, mid.d);
  const ct = cube(cv, top.x, top.y, top.w, top.h, top.d);
  cv.remap(and(cm.top, shift(ct.hull, S, 3, 4)), { b: 'c', c: 'd' });
  cube(cv, top.x, top.y, top.w, top.h, top.d);

  // Chest glyph: the fork, embossed on the middle block.
  cv.stamp(`
    tt....tt
    ts....ts
    .ss..ss.
    ..ssss..
    ...ss...
    ...ss...
    ...sr...
    ...tt...
    ...ts...`, mid.x + 8, mid.y + Math.round(mid.h / 2) - 4);

  // Face on the top block.
  const fx = top.x + 4, fy = top.y + Math.round(top.h / 2) - 3;
  if (p.mode === 'hitA') {
    cv.stamp(`
      p...........p
      .pp.......pp.
      ...p.....p...
      .pp.......pp.
      p...........p`, fx, fy);
    cv.stamp(`
      .ppp.
      p777p
      .ppp.`, fx + 4, fy + 6);
  } else {
    const blink = p.blink;
    cv.stamp(blink ? `
      .............
      .............
      ppp......ppp.
      .............` : hit ? `
      .pp.......pp.
      pjjp.....pjjp
      pjpp.....pjpp
      .pp.......pp.` : `
      .pp......ppp.
      pjpp....pjppp
      pppp....ppppp
      pppp....ppppp
      .pp......ppp.`, fx, fy);
    cv.stamp(hit ? `
      .ppp.
      p...p` : `
      p...p
      .ppp.`, fx + 4, fy + 7);
    cv.rect(fx - 2, fy + 6, 3, 2, 't').rect(fx + 11, fy + 6, 3, 2, 't');
  }
  if (p.mode === 'hitB') cv.stamp(`
    .i.
    ihi
    ijh
    .h.`, top.x + top.w + 7, top.y + 3);

  cv.silhouette('p', true);
  return cv;
}

// A wave climbs the stack: the low block pushes, the middle peaks a frame later, the top a frame after.
const idle = [0, 1, 2, 3, 4, 5].map((i) => {
  const ph = i / 6;
  const blk = (lag, amp) => {
    const w = wave(ph, lag);
    return [Math.round(wave(ph, lag + 0.25) * 0.8), Math.round(Math.min(0, -w) * amp), Math.round(-w * 1.1)];
  };
  return draw({ blocks: [[0, 0, Math.round(-wave(ph) * 1.2)], blk(1 / 6, 2), blk(2 / 6, 3)], flex: wave(ph, 0.3) * 2, blink: i === 4 });
});

const hit = [
  draw({ mode: 'hitA', dx: 3, blocks: [[0, 0, 3], [4, 0, 2], [9, -2, 1]], flex: -4 }),
  draw({ mode: 'hitB', dx: 1, blocks: [[0, 0, -1], [-2, -1, -1], [-3, -3, 0]], flex: 3 }),
];

export default { name: 'forkling', anims: { idle: { delay: 100, frames: idle }, hit: { delay: 130, frames: hit, loop: false } } };
