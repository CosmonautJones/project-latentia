// Blitzr: forward-leaning lightning fox-hedgehog in a hoodie. Speed type.
// The 64 px study, redrawn at 96: a chevron pointing left, wedge head thrust
// ahead of the feet, three bolt quills and a bolt tail trailing up and back.
// The study's notes are answered where the pixels allow: the head is a turned
// wedge with a cheek ruff instead of a flat profile, the quills bend from the
// root (their tips lag the body), the hoodie has a hood, pocket and strings,
// and the rocket sticker has moved to the hoodie's chest where it can be read.
//
// Fur a 9 0 (amber, orange, rust) | quills b a 9 | muzzle 2 3 v | hoodie t 8 7 5 | line 5 / p

import { Cv, or, sub, and, ribbon } from '../../src/draw.mjs';

const S = 96, BASE = 87;

function bolt(cv, pts, tipDx, tipDy, lit = 'b', main = 'a', shade = '9') {
  // Bend: each point is displaced in proportion to its distance along the bolt.
  const n = pts.length - 1;
  const bent = pts.map(([x, y, w], i) => [x + (tipDx * i * i) / (n * n), y + (tipDy * i * i) / (n * n), w]);
  const m = cv.poly(ribbon(bent));
  cv.outline(m, 'p', '5');
  cv.paint(m, main);
  // Upper edge lit, lower edge in shade: the same polygon shifted, so the bands follow the zigzag.
  const up = cv.poly(ribbon(bent.map(([x, y, w]) => [x - 1.2, y - 1.6, w])));
  const dn = cv.poly(ribbon(bent.map(([x, y, w]) => [x + 1.2, y + 1.6, w])));
  cv.paint(sub(m, dn), lit);
  cv.paint(sub(m, up), shade);
  return bent[n];
}

function draw(p) {
  const cv = new Cv(S, S);
  const ox = p.dx ?? 0;
  const bob = p.bob ?? 0; // + is down (knees bend)
  const hit = !!p.mode;
  const hip = [61 + ox, 71 + bob];
  const sh = [43 + ox + (p.lean ?? 0), 60 + bob + (p.leanY ?? 0)];
  const hd = [34 + ox + (p.head?.[0] ?? 0), 47 + bob + (p.head?.[1] ?? 0)];
  const q = p.quill ?? [0, 0];

  // ---- Tail: a bolt, rooted at the hip.
  const t = p.tail ?? [0, 0];
  bolt(cv, [[hip[0] + 2, hip[1] + 2, 3.6], [hip[0] + 14, hip[1] - 2, 3.4], [hip[0] + 10, hip[1] - 10, 3], [hip[0] + 23, hip[1] - 14, 2.6], [hip[0] + 19, hip[1] - 22, 2], [hip[0] + 30, hip[1] - 31, 0.3]], t[0], t[1], 'a', '9', '0');

  // ---- Quills: three bolts off the back of the skull and shoulders.
  bolt(cv, [[sh[0] + 12, sh[1] - 2, 3.4], [sh[0] + 24, sh[1] - 7, 3], [sh[0] + 21, sh[1] - 13, 2.4], [sh[0] + 36, sh[1] - 19, 0.3]], q[0] * 0.7, q[1] * 0.7);
  bolt(cv, [[hd[0] + 14, hd[1] - 2, 4], [hd[0] + 27, hd[1] - 12, 3.6], [hd[0] + 23, hd[1] - 17, 3], [hd[0] + 42, hd[1] - 27, 0.3]], q[0], q[1]);

  // ---- Far limbs, all in rust so the near ones separate.
  const farFoot = [hip[0] + 6 + (p.stance ?? 0), BASE - 2];
  const farLeg = cv.tube([[hip[0] + 2, hip[1] + 1, 4.5], [hip[0] + 8 + bob, hip[1] + 8 - bob * 0.5, 3.4], [farFoot[0] + 1, farFoot[1] - 2, 2.6]]);
  cv.part(farLeg, '0', 'p');
  cv.part(cv.ell(farFoot[0] - 2, farFoot[1], 5, 2.2), '3', 'p');
  const farArm = cv.tube([[sh[0] - 2, sh[1] + 2, 3.4], [sh[0] - 11 + (p.arm ?? 0), sh[1] + 9, 2.8]]);
  cv.part(farArm, '7', 'p');
  cv.part(cv.ell(sh[0] - 13 + (p.arm ?? 0), sh[1] + 11, 3, 2.6), '3', 'p');

  // ---- Hood, bunched behind the neck.
  const hood = cv.ell(sh[0] + 9, sh[1] - 5, 8.5, 6.5, -0.4);
  cv.outline(hood, '5', '5');
  cv.relief(hood, 't875', { R: 4, th: [0.93, 0.45, 0.1] });

  // ---- Torso: the hoodie, a leaning wedge from shoulders to hips.
  const torso = or(cv.cap(sh[0] + 2, sh[1] + 3, hip[0] - 2, hip[1] - 1, 10.5, 9), cv.ell(sh[0] + 1, sh[1] + 3, 10, 10));
  cv.outline(torso, '5', '5');
  cv.relief(torso, 't875', { R: 6, th: [0.94, 0.42, 0.08], smooth: 2 });
  // Hem band, pocket and drawstrings.
  const hem = and(torso, cv.cap(hip[0] - 8, hip[1] + 7.5, hip[0] + 6, hip[1] + 4, 2, 2));
  cv.remap(hem, { 8: '7', t: '8', 7: '5' });
  const pocket = and(torso, cv.poly([[sh[0] - 2, sh[1] + 9], [sh[0] + 10, sh[1] + 8], [sh[0] + 13, sh[1] + 14], [sh[0] + 1, sh[1] + 16]]));
  cv.inline(pocket, '7', '7');
  for (let i = 0; i < 6; i++) {
    cv.set(sh[0] - 5 + Math.round(i * 0.3), sh[1] - 2 + i + (i > 3 ? Math.round(p.string ?? 0) : 0), 'b');
    cv.set(sh[0] - 1 + Math.round(i * 0.3), sh[1] - 3 + i, i < 5 ? 'b' : 'a');
  }
  // Rocket sticker on the chest: a white rocket, red nose, on a navy round.
  cv.stamp(`
    ..ooo..
    .oo8oo.
    oo8j8oo
    oojjjoo
    o8jjj8o
    ooabaoo
    .ooooo.`, sh[0] + 8, sh[1] - 1);

  // ---- Near leg: thigh, shin, a cream paw planted on the toes.
  const foot = [hip[0] - 13 - (p.stance ?? 0), BASE - 2];
  const leg = cv.tube([[hip[0] - 3, hip[1] + 3, 5.5], [hip[0] - 10 - bob, hip[1] + 9 - bob * 0.4, 4], [foot[0] + 3, foot[1] - 3, 3]]);
  cv.outline(leg, '5', '5');
  cv.relief(leg, 'a90', { R: 4, th: [0.9, 0.35] });
  const paw = cv.ell(foot[0], foot[1], 6, 2.4);
  cv.outline(paw, 'p', 'p');
  cv.paint(paw, '2');
  cv.remap(and(paw, cv.box(0, BASE - 2, S, 2)), { 2: '3' });

  // ---- Third quill, in front of the hood.
  bolt(cv, [[hd[0] + 10, hd[1] - 8, 3.6], [hd[0] + 17, hd[1] - 21, 3.4], [hd[0] + 12, hd[1] - 24, 2.8], [hd[0] + 21, hd[1] - 40, 0.3]], q[0] * 1.2, q[1] * 0.6);

  // ---- Head: skull, cheek ruff and a long wedge snout.
  const tip = [hd[0] - 21, hd[1] + 6 + (p.snout ?? 0)];
  const skull = cv.ell(hd[0] + 2, hd[1], 13, 11);
  const snout = cv.poly([[hd[0] - 6, hd[1] - 9], [tip[0], tip[1] - 2], [tip[0] - 0.5, tip[1] + 2], [hd[0] - 4, hd[1] + 12], [hd[0] + 6, hd[1] + 10]]);
  const ruff = cv.poly([[hd[0] + 4, hd[1] + 6], [hd[0] + 16, hd[1] + 5], [hd[0] + 11, hd[1] + 10], [hd[0] + 15, hd[1] + 14], [hd[0] + 6, hd[1] + 13], [hd[0] + 4, hd[1] + 17], [hd[0] - 2, hd[1] + 11]]);
  // Ears first (the far one behind the skull).
  const earF = cv.poly([[hd[0] - 6, hd[1] - 8], [hd[0] - 5 + (p.ear ?? 0), hd[1] - 24], [hd[0] + 3, hd[1] - 10]]);
  cv.part(earF, '0', 'p');
  const headM = or(skull, snout, ruff);
  cv.outline(headM, '5', '5');
  cv.bands(headM, 'a90', [0.86, 0.3], (x, y) => {
    const dx = (x - hd[0] + 2) / 20, dy = (y - hd[1]) / 15;
    return dx * -0.5 + dy * -0.62 + Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy)) * 0.6;
  }, 2);
  const earN = cv.poly([[hd[0] + 2, hd[1] - 9], [hd[0] + 10 + (p.ear ?? 0), hd[1] - 25], [hd[0] + 13, hd[1] - 6]]);
  cv.outline(earN, '5', '5');
  cv.paint(earN, '9');
  cv.paint(and(earN, cv.poly([[hd[0] + 5, hd[1] - 9], [hd[0] + 10 + (p.ear ?? 0), hd[1] - 21], [hd[0] + 11, hd[1] - 8]])), '7');
  cv.remap(and(earN, cv.mask((x) => x < hd[0] + 5)), { 9: 'a' });
  // Cream muzzle: the underside of the snout and the front of the ruff.
  const muzzle = and(or(snout, ruff), cv.mask((x, y) => y > hd[1] + 4 + (x - hd[0]) * -0.16 && x < hd[0] + 8));
  cv.paint(muzzle, '2');
  cv.remap(and(muzzle, cv.mask((x, y) => y > hd[1] + 9 + (x - hd[0]) * -0.1)), { 2: '3' });
  // Nose and mouth.
  cv.part(cv.ell(tip[0] + 0.5, tip[1] - 1, 2, 1.8), 'p', 'p');
  if (hit) {
    cv.part(cv.poly([[tip[0] + 5, tip[1] + 3], [hd[0] - 4, hd[1] + 7], [hd[0] - 8, hd[1] + 12]]), '7', 'p');
  } else {
    // A grin running back from the nose, one fang showing.
    for (let i = 0; i < 13; i++) cv.set(tip[0] + 3 + i, tip[1] + 3 + Math.round(i * 0.22), 'p');
    cv.dots('j', [tip[0] + 7, tip[1] + 5], [tip[0] + 8, tip[1] + 5], [tip[0] + 7, tip[1] + 6]);
    cv.dots('p', [tip[0] + 16, tip[1] + 5], [tip[0] + 16, tip[1] + 4]);
  }
  // Eyes: slanted, under a hard brow. The far eye is a sliver past the bridge of the snout.
  const ey = [Math.round(hd[0]) - 7, Math.round(hd[1]) - 3];
  if (p.mode === 'hitA') {
    cv.stamp(`
      p...p
      .p.p.
      ..p..
      .p.p.
      p...p`, ey[0], ey[1] - 1);
  } else {
    cv.stamp(hit ? `
      ..ppppp..
      .pjjjjjp.
      pjjpjjjjp
      pjjpjjjjp
      .pjjjjkp.
      ..ppppp..` : `
      pp.......
      .ppppp...
      .pjjjpppp
      .pppjjjkp
      .pppjjkp.
      ..ppppp..`, ey[0], ey[1] - 1);
    cv.stamp(hit ? `
      .pp.
      pjjp
      pjpp
      .pp.` : `
      p...
      pppp
      ppjp
      .pp.`, ey[0] - 8, ey[1] + 1);
    if (!hit) cv.set(ey[0] + 1, ey[1] + 2, 'j'); // glint
  }

  // ---- Near arm: a sleeve swung forward, cream fist.
  const hand = [sh[0] - 12 - (p.arm ?? 0), sh[1] + 13 + (p.armY ?? 0)];
  const arm = cv.tube([[sh[0] + 1, sh[1] + 2, 4.4], [sh[0] - 4, sh[1] + 11, 3.6], [hand[0] + 3, hand[1] - 1, 3.2]]);
  cv.outline(arm, '5', '5');
  cv.relief(arm, 't87', { R: 3.5, th: [0.9, 0.35] });
  cv.remap(and(arm, cv.ell(hand[0] + 4, hand[1] - 0.5, 2, 3.4)), { 8: '7', t: '8' }); // cuff
  const fist = cv.ell(hand[0], hand[1], 3.6, 3.2);
  cv.outline(fist, 'p', '5');
  cv.paint(fist, '2');
  cv.remap(and(fist, cv.mask((x, y) => y > hand[1] + 0.6)), { 2: '3' });

  // ---- Sparks.
  for (const [sx, sy] of p.sparks ?? []) {
    cv.stamp(`
      .b.
      bjb
      .b.`, sx + ox, sy);
  }

  cv.silhouette('p', true);
  return cv;
}

// A fast bounce on the toes. The head leads by a frame; quill and tail tips lag and overshoot.
const BOB = [0, 1.5, 2, 0.5, -1, -1];
const idle = [0, 1, 2, 3, 4, 5].map((i) => {
  const lag = (k) => BOB[(i + 6 - k) % 6];
  return draw({
    bob: BOB[i],
    head: [[0, 0], [-1, 1], [-1, 0], [0, -1], [1, -1], [0, 0]][i],
    snout: [0, 0, 1, 0, -1, 0][i],
    lean: [0, -1, -1, 0, 0, 0][i],
    quill: [lag(1) * -1 + 0, lag(1) * 2.2 - BOB[i]],
    tail: [lag(2) * -0.8, lag(2) * 2.4 - BOB[i]],
    ear: [0, 0, 1, 1, 0, -1][i],
    arm: [0, 1, 2, 1, -1, -1][i],
    armY: [0, 0, -1, -1, 0, 1][i],
    stance: [0, 1, 1, 0, 0, 0][i],
    string: [0, 0, 1, 1, 0, 0][i],
    sparks: [[], [[78, 24]], [[84, 50]], [], [[66, 12]], [[74, 40]]][i],
  });
});

const hit = [
  draw({ mode: 'hitA', dx: 6, bob: 1, head: [3, -5], snout: -4, lean: 3, leanY: -1, quill: [4, 9], tail: [-3, 12], ear: 3, arm: -5, armY: -6, stance: -2, sparks: [[20, 30], [12, 44], [28, 22]] }),
  draw({ mode: 'hitB', dx: 3, bob: 2, head: [1, -1], snout: -1, lean: 1, quill: [-2, -3], tail: [2, -4], ear: -1, arm: -2, armY: -2, stance: 1, sparks: [[16, 36]] }),
];

export default { name: 'blitzr', anims: { idle: { delay: 75, frames: idle }, hit: { delay: 130, frames: hit, loop: false } } };
