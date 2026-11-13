// Tokenibble: the first wild model. Speed type; it eats tokens.
// A squat, greedy gobbler mid-bite on a hex token: buck teeth, a stuffed cheek,
// ticket-stub ears with bites out of them and a tail of three stacked tokens.
// The read is "nibble": something small with its teeth already in your budget.
//
// Fur ramp a 9 0 5 (amber, orange, rust, bark) | cream belly 2 3 | tokens b a 9 | line 5 / p

import { Cv, or, sub, and, wave } from '../../src/draw.mjs';

const S = 96, BASE = 87;

function hex(cv, cx, cy, r, rot) {
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([cx + r * Math.cos(rot + (i * Math.PI) / 3), cy + r * Math.sin(rot + (i * Math.PI) / 3)]);
  return cv.poly(pts);
}

function token(cv, cx, cy, r, rot, bite) {
  let m = hex(cv, cx, cy, r, rot);
  if (bite) {
    // Scalloped tooth marks on the side facing the mouth.
    for (const [bx, by, br] of bite) m = sub(m, cv.ell(cx + bx, cy + by, br, br));
  }
  cv.outline(m, 'p', '5');
  cv.paint(m, 'a');
  // Rim: lit on the upper-left edges, rust on the lower-right.
  const face = and(hex(cv, cx - 0.4, cy - 0.4, r - (r > 8 ? 2.6 : 2), rot), m);
  const rim = sub(m, face);
  cv.remap(and(rim, cv.mask((x, y) => x - cx + (y - cy) > r * 0.1)), { a: '9' });
  cv.remap(and(rim, cv.mask((x, y) => x - cx + (y - cy) < -r * 0.5)), { a: 'b' });
  cv.paint(face, 'b');
  cv.remap(and(face, cv.mask((x, y) => x - cx + (y - cy) > r * 0.45)), { b: 'a' });
  // A stamped square hole, like an arcade token.
  if (r > 5) {
    const h = r > 8 ? 2 : 1;
    const hole = and(face, cv.box(Math.round(cx) - h, Math.round(cy) - h, h * 2, h * 2));
    cv.paint(hole, '9');
    cv.remap(and(hole, cv.box(Math.round(cx) - h, Math.round(cy) - h, h * 2, 1)), { 9: '0' });
  }
}

function ear(cv, x, y, w, h, rot, biteAt, far) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const tr = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  let m = cv.poly([tr(-w / 2, 0), tr(-w / 2, -h + 2), tr(-w / 2 + 2, -h), tr(w / 2 - 2, -h), tr(w / 2, -h + 2), tr(w / 2, 0)]);
  const [bx, by] = tr(biteAt[0], biteAt[1]);
  m = sub(m, cv.ell(bx, by, 3.3, 3.3));
  cv.outline(m, '5', '5');
  cv.paint(m, far ? '0' : '9');
  // Inner ear: a tan stub with a perforation line, like a torn ticket.
  const [ix, iy] = tr(0, -h / 2);
  const inner = and(m, cv.ell(ix + 0.5, iy + 1, w / 2 - 1.8, h / 2 - 1.5, rot));
  cv.paint(inner, far ? '4' : '3');
  if (!far) cv.remap(and(inner, cv.mask((px, py) => Math.round(px + py) % 3 === 0 && Math.abs(py - iy) < 1)), { 3: '4' });
}

/** One frame from a pose. Every part is re-rasterised, nothing is slid as a bitmap. */
function draw(p) {
  const cv = new Cv(S, S);
  const ox = p.dx ?? 0;
  const sq = p.sq ?? 0; // + squashes down and out
  const ry = 19 - sq, rx = 21 + sq * 0.8;
  const cx = 50 + ox, cy = BASE - 3 - ry;
  const top = cy - ry;

  // Tail: three tokens stacked up and back, each lagging the one below.
  const t1 = [cx + 26, 74 + (p.tail?.[0] ?? 0)], t2 = [cx + 30 + (p.tail?.[1] ?? 0) * 0.5, 62 + (p.tail?.[1] ?? 0)], t3 = [cx + 32 + (p.tail?.[2] ?? 0), 51.5 + (p.tail?.[2] ?? 0)];
  cv.part(cv.cap(cx + 16, 76, t1[0], t1[1], 3, 2), '0', '5');
  token(cv, t3[0], t3[1], 5.4, 0);
  token(cv, t2[0], t2[1], 6.4, Math.PI / 6);
  token(cv, t1[0], t1[1], 7.4, 0);

  // Far ear behind the head.
  ear(cv, cx - 10, top + 6, 9, 12 + (p.ear ?? 0), -0.4, [-5, -7], true);

  // Body: a bean, heavier at the bottom.
  const body = or(cv.ell(cx, cy, rx, ry), cv.ell(cx + 1.5, cy + ry * 0.42, rx + 1.5, ry * 0.62));
  cv.outline(body, '5', '5');
  cv.bands(body, 'a905', [0.9, 0.4, -0.2], (x, y) => {
    const dx = (x + 0.5 - cx + 1) / (rx + 4), dy = (y + 0.5 - cy - 1) / (ry + 4);
    return dx * -0.5 + dy * -0.62 + Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)) * 0.6;
  }, 3);

  // Cream belly, low and toward the viewer.
  const belly = and(body, cv.ell(cx - 9, cy + ry * 0.62, 13, ry * 0.5));
  cv.paint(belly, '2');
  cv.remap(and(belly, cv.mask((x, y) => y > cy + ry * 0.78 || x > cx - 1)), { 2: '3' });

  // Stuffed cheek: a lit bulge with the corner of a token pressing out.
  const ck = [cx + 6 + (p.cheek ?? 0) * 0.5, cy + 5];
  const cheek = and(body, cv.ell(ck[0], ck[1], 7 + (p.cheek ?? 0), 6 + (p.cheek ?? 0) * 0.5));
  cv.remap(cheek, { 9: 'a', 0: '9', 5: '0' });
  // A rust crescent under it, so it reads as a pouch and not a patch.
  cv.remap(and(body, sub(cv.ell(ck[0] + 0.5, ck[1] + 1.5, 8 + (p.cheek ?? 0), 7 + (p.cheek ?? 0) * 0.5), or(cheek, cv.mask((x, y) => y < ck[1] - 1 || x < ck[0] - 5)))), { a: '0', 9: '0', 0: '5' });

  // Near ear in front.
  ear(cv, cx + 9, top + 4, 11, 15 + (p.ear ?? 0), 0.28, [6, -9], false);

  // Feet: two rust nubs on the baseline.
  for (const fx of [cx - 13, cx + 9]) {
    const f = cv.ell(fx, BASE - 2, 5, 2.4);
    cv.outline(f, 'p', 'p');
    cv.paint(f, '0');
    cv.remap(and(f, cv.box(0, BASE - 4, S, 1)), { 0: '9' });
  }

  // The token it is eating, held out front.
  const tk = [cx - 26 + (p.tok?.[0] ?? 0), cy + 7 + (p.tok?.[1] ?? 0)];
  const flying = p.eye === 'shut';
  token(cv, tk[0], tk[1], 10, p.tokRot ?? 0, flying ? [[8, -5, 3], [9.5, -0.5, 2.6]] : [[8, -5.5, 3], [9.6, -1, 2.6], [8.5, 3.2, 2.2 + (p.jaw ? 0.5 : 0)]]);

  // Eyes: big, round and fixed on the token.
  const eN = [cx - 6, cy - 6], eF = [cx - 17, cy - 5];
  if (p.eye === 'shut') {
    cv.stamp(`
      p....
      .pp..
      ...pp
      .pp..
      p....`, eN[0] - 3, eN[1] - 2);
    cv.stamp(`
      ...p
      .pp.
      p...
      .pp.
      ...p`, eF[0] - 2, eF[1] - 2);
  } else {
    const wide = p.eye === 'wide';
    for (const [e, r, far] of [[eF, 4.6, true], [eN, 5.6, false]]) {
      const w = and(cv.ell(e[0], e[1], r - (far ? 0.8 : 0), r), far ? body : cv.opaque());
      cv.outline(w, '5', '5');
      cv.paint(w, 'j');
      cv.remap(and(w, cv.mask((x, y) => y > e[1] + r * 0.45)), { j: 'k' });
      const [gx, gy] = p.eye === 'guard' ? [-1, -1] : wide ? [0, 0] : [-2, 1.5];
      const pr = wide ? 1.4 : far ? 2.2 : 2.8;
      const pu = and(w, cv.ell(e[0] + gx, e[1] + gy, pr, pr + (wide ? 0 : 0.6)));
      cv.paint(pu, 'p');
      if (!wide) cv.set(Math.floor(e[0] + gx - 1), Math.floor(e[1] + gy - 1), 'j');
      // A heavy upper lid: the greedy squint.
      if (!wide) cv.paint(and(w, cv.mask((x, y) => y < e[1] - r * 0.5 + (p.eye === 'guard' ? 1 : 0))), far ? '0' : '9');
    }
  }

  // Muzzle and the buck teeth, which sit on the token's bitten edge.
  const mz = [cx - 15, cy + 4];
  const muzzle = and(cv.ell(mz[0], mz[1], 6, 3.6), body);
  cv.paint(muzzle, '2');
  cv.remap(and(muzzle, cv.mask((x, y) => y > mz[1] + 1)), { 2: '3' });
  cv.dots('5', [mz[0] - 3, mz[1] - 2], [mz[0] - 2, mz[1] - 2]); // nose
  if (p.eye === 'shut') {
    cv.part(cv.ell(mz[0] - 1, mz[1] + 4.5, 2.6, 2.4), '6', '5');
  } else {
    const ty = Math.round(mz[1] + 2 + (p.jaw ? 1 : 0));
    const tx = Math.round(mz[0] - 5);
    cv.rect(tx - 1, ty - 1, 8, 6 + (p.jaw ? 0 : 0), '5');
    cv.rect(tx, ty, 6, 4, 'j');
    cv.rect(tx + 3, ty, 3, 4, 'k');
    cv.rect(tx + 3, ty + 1, 1, 3, 'l');
    cv.dots('2', [tx, ty + 3], [tx + 4, ty + 3], [tx + 5, ty + 3]);
  }

  // Paws gripping the token.
  if (!flying) {
    for (const [px, py] of [[tk[0] + 5, tk[1] + 7], [tk[0] + 1, tk[1] + 9.5]]) {
      const paw = cv.ell(px, py, 3.4, 2.4);
      cv.outline(paw, '5', '5');
      cv.paint(paw, '9');
      cv.set(px - 2, py - 1, 'a').set(px - 1, py - 1, 'a');
    }
  } else {
    for (const [px, py] of [[cx - 19, cy + 11], [cx - 13, cy + 13]]) cv.part(cv.ell(px, py, 3.2, 2.4), '9', '5');
  }

  // Crumbs of token.
  for (const [dx, dy] of p.crumbs ?? []) cv.set(tk[0] + dx, tk[1] + dy, 'b');

  cv.silhouette('p', true);
  return cv;
}

const idle = [0, 1, 2, 3, 4, 5].map((i) => {
  const ph = i / 6;
  return draw({
    sq: wave(ph) * 0.9,
    jaw: i % 2, // two chews per breath
    tok: [i % 2 ? 0 : -1, Math.round(wave(ph) * 0.9) + (i % 2)],
    tokRot: 0,
    cheek: i % 2 ? 0.8 : 0,
    tail: [Math.round(wave(ph, 0.1) * 1.2), Math.round(wave(ph, 0.27) * 1.8), Math.round(wave(ph, 0.44) * 2.4)],
    spin: wave(ph) * 0.18,
    ear: i === 4 ? 1.5 : 0,
    eye: i >= 3 && i <= 4 ? 'guard' : 'token',
    crumbs: [[], [[11, 6]], [[12, 9], [9, 7]], [[12, 12]], [[10, 5]], [[11, 9]]][i],
  });
});

const hit = [
  // Knocked back: squashed, eyes screwed shut, the token punched out of its paws.
  draw({ dx: 5, sq: 3, eye: 'shut', tok: [-3, -24], tokRot: Math.PI / 6, tail: [-2, -4, -6], spin: -0.5, ear: -2, crumbs: [[14, 12], [18, 18], [10, 20]] }),
  // Rebound: stretched up, wide-eyed, the token falling back toward its grip.
  draw({ dx: 2, sq: -1.5, eye: 'wide', tok: [-1, -5], tokRot: 0, tail: [1, 2, 3], spin: 0.3, ear: 2, jaw: 1 }),
];

export default { name: 'tokenibble', anims: { idle: { delay: 90, frames: idle }, hit: { delay: 130, frames: hit, loop: false } } };
