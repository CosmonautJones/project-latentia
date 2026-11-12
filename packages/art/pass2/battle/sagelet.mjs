// Sagelet: round owlet-monk. Reasoning type. The 64 px study, redrawn at 96.
// Same design: one egg for hood and robe, a cream facial disc left of centre,
// spectacles whose frames are the { } themselves, tufts, a rope belt, a cream
// hem, a thought-bubble crest and three "..." dots in orbit. The extra pixels
// go to the things the study's notes said did not read: the braces and the
// curved shadow side. The dots orbit lower, clear of the face.
//
// Robe ramp i h g o (cyan, sky, blue, night) | disc 2 3 v | lens j k | beak a 9 | line o / p

import { Cv, or, sub, and, wave } from '../../src/draw.mjs';

const S = 96, BASE = 87;

const BRACE = `
  ooo.
  .ooo
  ..oo
  ..oo
  ..oo
  ..oo
  ..ooo
  ...oo
  ..ooo
  ..oo
  ..oo
  ..oo
  ..oo
  .ooo
  ooo.`;

function bubble(cv, m, hit) {
  cv.outline(m, 'o', 'o');
  cv.paint(m, 'j');
  if (hit) cv.remap(m, { j: 'k' });
}

function dot(cv, x, y, depth, trail) {
  // depth 0 far (small, dim), 1 mid, 2 near (large, bright)
  const r = [2.2, 2.8, 3.4][depth];
  for (const [tx, ty, tr] of trail) cv.paint(cv.ell(x + tx, y + ty, tr, tr), depth === 0 ? 'm' : 'l');
  const m = cv.ell(x, y, r, r);
  cv.outline(m, 'o', 'o');
  cv.paint(m, depth === 0 ? 'l' : 'j');
  cv.remap(and(m, cv.mask((px, py) => px - x + (py - y) > r * 0.3)), { j: 'k', l: 'm' });
}

function draw(p) {
  const cv = new Cv(S, S);
  const sq = p.sq ?? 0;
  const ox = p.dx ?? 0;
  const hit = !!p.mode;
  const rx = 25 + sq * 0.7, ry = 26 - sq;
  const cx = 46 + ox, cy = BASE - 1 - ry;
  const top = cy - ry;
  const fy = cy - 3; // face height follows the breath

  // ---- Orbit: far dots first, so they pass behind the body.
  const orbit = { cx: cx + 1, cy: cy + 14, rx: 36, ry: 6, tilt: 0.08 };
  const dots = [0, 1, 2].map((k) => {
    const a = (((p.f ?? 0) * 20 + k * 120 + 135) * Math.PI) / 180;
    const x = orbit.cx + orbit.rx * Math.cos(a), s = Math.sin(a);
    const y = orbit.cy + orbit.ry * s + (x - orbit.cx) * orbit.tilt + (p.scatter?.[k]?.[1] ?? 0);
    return { x: x + (p.scatter?.[k]?.[0] ?? 0), y, s, trail: [] };
  });
  for (const d of dots) if (d.s <= 0) dot(cv, d.x, d.y, d.s < -0.45 ? 0 : 1, d.trail);

  // ---- Hood tufts.
  for (const [tx, lean, h] of [[-13, -4, 9], [11, 5, 10]]) {
    const t = cv.poly([[cx + tx - 4, top + 8], [cx + tx + lean, top - h + 7 + (p.tuft ?? 0)], [cx + tx + 5, top + 6]]);
    cv.part(t, tx < 0 ? 'h' : 'g', 'o');
    if (tx < 0) cv.remap(and(t, cv.mask((x) => x < cx + tx - 1)), { h: 'i' });
  }

  // ---- Body: one egg, flat where the robe meets the ground.
  const body = and(cv.ell(cx, cy, rx, ry), cv.box(0, 0, S, BASE - 2));
  cv.outline(body, 'o', 'o');
  cv.bands(body, 'ihgo', [0.95, 0.36, -0.1], (x, y) => {
    const dx = (x + 0.5 - cx) / (rx + 3), dy = (y + 0.5 - cy) / (ry + 3);
    return dx * -0.5 + dy * -0.62 + Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)) * 0.6;
  }, 3);
  const u = (x) => (x - cx) / rx;
  const shadeSide = cv.mask((x) => x > cx + rx * 0.45);

  // ---- Cream hem and the feet under it.
  const hem = and(body, cv.mask((x, y) => y > BASE - 10 + 3 * (1 - u(x) * u(x))));
  cv.paint(hem, '2');
  cv.remap(and(hem, cv.mask((x) => x > cx + 2)), { 2: '3' });
  cv.remap(and(hem, shadeSide), { 3: 'v' });
  cv.remap(and(body, sub(cv.mask((x, y) => y > BASE - 11 + 3 * (1 - u(x) * u(x))), hem)), { i: 'h', h: 'g', g: 'o' });
  for (const fx of [cx - 10, cx + 9]) {
    const f = cv.ell(fx, BASE - 2.5, 5.5, 2.4);
    cv.outline(f, 'p', 'p');
    cv.paint(f, fx < cx ? 'a' : '9');
    cv.dots('9', [fx - 2, BASE - 2], [fx + 1, BASE - 2]);
  }

  // ---- Mantle line and rope belt, both sagging with the robe's curve.
  const curve = (x, y0, sag) => y0 + sag * (1 - u(x) * u(x));
  const belt = and(body, cv.mask((x, y) => Math.abs(y - curve(x, cy + 9, 4)) < 1.6));
  cv.paint(belt, '3');
  cv.remap(and(belt, cv.mask((x, y) => y < curve(x, cy + 9, 4) - 0.5)), { 3: '2' });
  cv.remap(and(belt, shadeSide), { 3: 'v', 2: '3' });
  cv.remap(and(body, cv.mask((x, y) => Math.abs(y - curve(x, cy + 11.2, 4)) < 0.6)), { h: 'g', g: 'o', i: 'h' });
  const kx = Math.round(cx - 9), ky = Math.round(curve(cx - 9, cy + 9, 4)) - 2;
  cv.stamp(`
    .ooo.
    o2j2o
    o232o
    .o3o.
    .2o3.
    .2.3.
    .2.v.`, kx - 2, ky);

  // ---- Facial disc: two eye discs and a chin, cut from the hood.
  const eF = [cx - 12, fy], eN = [cx + 4, fy + 0.5];
  const disc = and(body, or(cv.ell(eF[0] - 1, eF[1], 10.5, 10.5), cv.ell(eN[0] + 1.5, eN[1], 12.5, 11.5), cv.ell(cx - 4, fy + 6, 14, 7)));
  cv.inline(disc, 'g', 'g');
  cv.paint(disc, '2');
  cv.remap(and(disc, cv.mask((x, y) => y < fy - 8 || (y > fy + 8 && x > cx - 8))), { 2: '3' }); // hood shadow, chin shade

  // ---- Spectacles: round lenses whose frames are the braces.
  const lF = and(cv.ell(eF[0] + 0.5, eF[1] + 0.5, 6, 7), disc), lN = cv.ell(eN[0], eN[1] + 0.5, 7.5, 7.5);
  for (const [l, e] of [[lF, eF], [lN, eN]]) {
    cv.inline(l, 'l', 'l');
    cv.paint(l, 'j');
    cv.remap(and(l, sub(l, cv.ell(e[0] - 0.8, e[1] - 0.6, 6, 6.2))), { j: 'k' });
  }
  cv.stamp(BRACE, Math.round(eF[0]) - 10, Math.round(eF[1]) - 7, { flip: true });
  cv.stamp(BRACE, Math.round(eN[0]) + 8, Math.round(eN[1]) - 7);
  cv.rect(Math.round(eN[0]) - 9, Math.round(eN[1]) - 1, 2, 1, 'o'); // bridge
  if (p.eye === 'shut') {
    // Screwed shut: two little downward arcs. Apologetic, not angry.
    for (const [e, w] of [[eF, 3], [eN, 4]]) for (let i = -w; i <= w; i++) cv.set(e[0] + i, e[1] + 1 + (Math.abs(i) >= w - 1 ? 1 : 0), 'p');
  } else {
    const [gx, gy] = p.look ?? [-2, 0];
    const small = p.eye === 'small';
    for (const [e, l, r] of [[eF, lF, 2.2], [eN, lN, 2.8]]) {
      const pu = and(l, cv.ell(e[0] + gx, e[1] + 1 + gy, small ? 1.3 : r, small ? 1.3 : r + 1.1));
      cv.paint(pu, 'p');
      if (!small) cv.set(Math.floor(e[0] + gx - 1), Math.floor(e[1] + gy - 1), 'j');
    }
    if (small) {
      // Worried brows.
      cv.stamp(`
        ..oo
        oo..`, eF[0] - 3, eF[1] - 5);
      cv.stamp(`
        oo..
        ..oo`, eN[0] - 1, eN[1] - 6);
    }
  }

  // ---- Beak and blush.
  const bk = [Math.round(cx - 6), Math.round(fy + 5)];
  cv.stamp(hit ? `
    .ooo.
    oabao
    o999o
    .o0o.
    ..o..` : `
    .ooo.
    obaao
    oa99o
    .o9o.
    ..o..`, bk[0] - 2, bk[1]);
  cv.rect(Math.round(eF[0]) - 6, Math.round(fy) + 9, 3, 2, 't');
  cv.rect(Math.round(eN[0]) + 4, Math.round(fy) + 10, 4, 2, 't');

  // ---- Thought-bubble crest: puff, bubble, cloud, each a frame behind the last.
  const c1 = p.crest?.[0] ?? 0, c2 = p.crest?.[1] ?? 0, c3 = p.crest?.[2] ?? 0;
  bubble(cv, cv.ell(cx + 5, top - 3 + c1, 2.6, 2.6), hit);
  bubble(cv, cv.ell(cx + 11, top - 10 + c2, 3.6, 3.6), hit);
  const kx0 = cx + 24, ky0 = top - 20 + c3;
  const cloud = or(cv.ell(kx0 - 6, ky0 + 1, 5, 4.5), cv.ell(kx0, ky0 - 1.5, 6, 5.5), cv.ell(kx0 + 7, ky0 + 0.5, 5.5, 4.5), cv.ell(kx0 + 1, ky0 + 3, 9, 3.5));
  bubble(cv, cloud, hit);
  cv.remap(and(cloud, cv.mask((x, y) => y > ky0 + 3.2 || (x > kx0 + 8 && y > ky0 + 0.5))), { j: 'k' });
  if (p.mode === 'hitA') cv.rect(kx0 - 1, ky0 - 3, 2, 4, 'o').rect(kx0 - 1, ky0 + 2, 2, 2, 'o'); // "!"

  // ---- Sweat drop.
  if (hit) cv.stamp(`
    .o.
    oio
    ojho
    ohho
    .oo.`, cx + 19, top + 8 + (p.mode === 'hitB' ? 5 : 0));

  // ---- Near dots, in front.
  for (const d of dots) if (d.s > 0) dot(cv, d.x, d.y, d.s > 0.45 ? 2 : 1, d.trail);

  cv.silhouette('p', true);
  return cv;
}

// Slow breath: stretch on 1-2, squash on 4-5; the crest trails; the eyes drift up to the thought.
const idle = [0, 1, 2, 3, 4, 5].map((i) => {
  const ph = i / 6;
  return draw({
    f: i,
    sq: -wave(ph) * 1.1,
    crest: [Math.round(-wave(ph, 1 / 6) * 1.2), Math.round(-wave(ph, 2 / 6) * 1.6), Math.round(-wave(ph, 3 / 6) * 2)],
    tuft: Math.round(wave(ph, 0.2)),
    look: [[-2, 0], [-2, 0], [-2, -1], [-1, -2], [-1, -2], [-2, -1]][i],
  });
});

const hit = [
  draw({ mode: 'hitA', f: 1, dx: 4, sq: 3, eye: 'shut', crest: [1, -3, -6], tuft: -3, scatter: [[-6, -9], [8, -12], [5, 4]] }),
  draw({ mode: 'hitB', f: 2, dx: 2, sq: -1, eye: 'small', look: [-1, 0], crest: [0, 0, -2], tuft: 1, scatter: [[-3, -4], [4, -5], [2, 2]] }),
];

export default { name: 'sagelet', anims: { idle: { delay: 100, frames: idle }, hit: { delay: 130, frames: hit, loop: false } } };
