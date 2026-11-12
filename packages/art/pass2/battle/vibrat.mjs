// Vibrat: Bootcamp Grad's model. Code type; its signature is "Accept All".
// A wiry grey rat reared up on its hind legs, chin high, one finger raised to
// explain something it has not read. Blue-light glasses hide its eyes, studio
// headphones keep the vibe in, its belly is a terminal that scrolls regardless,
// and its tail is a frayed cable with a live plug. A magenta bug rides the tail;
// Vibrat has not noticed.
//
// Fur ramp k l m n o (cloud to night) | terminal o with i h text | glow i j | bug s r | line o / p

import { Cv, or, sub, and } from '../../src/draw.mjs';

const S = 96, BASE = 87;

function draw(p) {
  const cv = new Cv(S, S);
  const ox = p.dx ?? 0;
  const lean = p.lean ?? 0; // + leans back (to the right)
  const nod = p.nod ?? 0;
  const hit = p.mode === 'hitA' || p.mode === 'hitB';
  const hipX = 55 + ox, hipY = 72;
  const chest = [hipX - 3 + lean, 58 + (p.sq ?? 0)];
  const head = [chest[0] - 8 + lean * 0.6, chest[1] - 19 + nod];

  // ---- Tail: a cable that leaves low, loops up behind and ends in a plug.
  const tw = p.tail ?? 0;
  const tailPts = [
    [hipX + 7, 79, 2.6], [hipX + 15, 82, 2.1], [hipX + 22, 78 - tw * 0.3, 1.9], [hipX + 25, 69 - tw * 0.6, 1.8],
    [hipX + 21 + tw * 0.4, 60 - tw, 1.7], [hipX + 24 + tw, 51 - tw, 1.6],
  ];
  const tail = cv.tube(tailPts);
  cv.outline(tail, 'p', 'p');
  cv.paint(tail, 'm');
  cv.remap(and(tail, sub(tail, cv.tube(tailPts.map(([x, y, r]) => [x + 0.8, y + 0.8, r])))), { m: 'l' });
  // Plug: a steel block with two prongs and a live cyan tip.
  const [px, py] = [Math.round(tailPts[5][0]), Math.round(tailPts[5][1])];
  cv.rect(px - 3, py - 6, 7, 6, 'p');
  cv.rect(px - 2, py - 5, 5, 4, 'l');
  cv.rect(px - 2, py - 5, 2, 4, 'k');
  cv.rect(px + 2, py - 3, 1, 2, 'm');
  cv.rect(px - 2, py - 8, 1, 2, 'k').rect(px + 2, py - 8, 1, 2, 'l');
  for (const [sx, sy] of p.spark ?? []) cv.set(px + sx, py - 9 + sy, sx % 2 ? 'i' : 'j');
  // The bug, clinging on.
  const [bx, by] = [Math.round(tailPts[3][0]) + 2, Math.round(tailPts[3][1]) - 1];
  cv.stamp(p.bug ? `
    .p..p.
    pssspp
    psrsrp
    .pppp.
    p.p..p` : `
    p...p.
    pssspp
    psrsrp
    .pppp.
    .p.p.p`, bx - 2, by - 2);

  // ---- Far leg and foot.
  const farFoot = cv.ell(hipX - 14, BASE - 3, 5, 2.2);
  cv.part(cv.cap(hipX - 3, 76, hipX - 11, 83, 4.5, 3), 'm', 'p');
  cv.part(farFoot, 'm', 'p');
  cv.remap(and(farFoot, cv.box(0, BASE - 2, S, 2)), { m: 'n' });

  // ---- Far arm, fist on hip (or flung out when hit).
  if (hit) cv.part(cv.tube([[chest[0] + 6, chest[1] - 3, 2.6], [chest[0] + 15, chest[1] - 9, 2.2], [chest[0] + 19, chest[1] - 16, 2.4]]), 'm', 'p');

  // ---- Torso: a pear, hips wide, chest out.
  const torso = or(cv.ell(hipX, hipY, 13, 12), cv.ell(chest[0] - 1, chest[1], 11, 10.5), cv.cap(hipX, hipY, chest[0], chest[1], 12, 10));
  cv.outline(torso, 'o', 'o');
  cv.relief(torso, 'klmn', { R: 6, th: [0.9, 0.45, 0.1], smooth: 2 });

  // ---- Near leg: a haunch and a long flat foot.
  const haunch = cv.ell(hipX + 3, 77, 8.5, 8);
  cv.outline(haunch, 'o', 'o');
  cv.relief(haunch, 'klmn', { R: 6, th: [0.9, 0.45, 0.1], smooth: 2 });
  const foot = cv.ell(hipX - 2, BASE - 2, 7, 2.4);
  cv.outline(foot, 'p', 'p');
  cv.paint(foot, 'l');
  cv.remap(and(foot, cv.box(0, BASE - 2, S, 2)), { l: 'm' });
  cv.dots('n', [hipX - 7, BASE - 2], [hipX - 5, BASE - 2]);

  // ---- Belly terminal.
  const sx = Math.round(chest[0] - 10 + lean * 0.3), sy = Math.round(chest[1] + 3);
  const screen = and(cv.sup(sx + 6.5, sy + 7, 7, 7.5, 5), torso);
  cv.outline(screen, 'p', 'p');
  cv.paint(screen, hit ? '6' : 'o');
  const lines = hit ? [0, 0, 0, 0, 0, 0] : [6, 3, 7, 4, 5, 2, 6];
  for (let r = 0; r < 6; r++) {
    const y = sy + 2 + r * 2;
    const len = lines[(r + (p.scroll ?? 0)) % lines.length];
    if (len === 0) continue;
    if (screen[y * S + sx + 2]) cv.set(sx + 2, y, 'c');
    for (let i = 0; i < len; i++) if (screen[y * S + sx + 4 + i]) cv.set(sx + 4 + i, y, r === 5 ? 'i' : 'h');
    if (r === 5 && p.cursor && screen[y * S + sx + 5 + len]) cv.set(sx + 5 + len, y, 'j');
  }
  if (hit) {
    // Stack trace: a red cross and a line of red.
    cv.stamp(p.mode === 'hitA' ? `
      8...8
      .8.8.
      ..8..
      .8.8.
      8...8` : `
      .888.
      8...8
      ...8.
      ..8..
      .....
      ..8..`, sx + 4, sy + 2);
    for (let i = 0; i < 8; i++) if (screen[(sy + 11) * S + sx + 3 + i]) cv.set(sx + 3 + i, sy + 11, i % 3 === 2 ? '6' : '7');
  }
  // Glass glint across the corner.
  if (!hit) cv.dots('n', [sx + 11, sy + 2], [sx + 12, sy + 3], [sx + 12, sy + 2]);

  // ---- Head: a skull ball and a long snout, chin up.
  const up = p.chin ?? 0;
  const tip = [head[0] - 21, head[1] - 1 - up];
  const skull = cv.ell(head[0], head[1], 12, 10.5);
  const snout = cv.cap(head[0] - 6, head[1] + 2, tip[0], tip[1], 7, 2.6);
  const hd = or(skull, snout);
  // Ear behind the headband: round, torn at the rim.
  const ear = sub(cv.ell(head[0] + 9, head[1] - 10 + (p.ear ?? 0), 5.5, 6), cv.ell(head[0] + 14, head[1] - 14 + (p.ear ?? 0), 2.2, 2.2));
  cv.part(ear, 'l', 'o');
  cv.paint(and(ear, cv.ell(head[0] + 8.5, head[1] - 9 + (p.ear ?? 0), 3, 3.6)), 't');
  cv.outline(hd, 'o', 'o');
  cv.relief(hd, 'kklm', { R: 6, th: [0.93, 0.45, 0.1], smooth: 2 });
  // Pale muzzle underside and a pink nose.
  cv.remap(and(snout, cv.mask((x, y) => y > head[1] + 2 + (x - head[0]) * 0.12 && x < head[0] - 5)), { l: 'k', m: 'l' });
  cv.part(cv.ell(tip[0] - 0.5, tip[1] - 0.5, 2.3, 2), 't', 'p');
  cv.set(tip[0] - 2, tip[1] - 2, 'j');
  // Smirk (or a yelp).
  if (hit) cv.part(cv.ell(head[0] - 12, head[1] + 6.5, 2.6, 2.2), '7', 'p');
  else cv.stamp(`
    o......
    .oo....
    ...oooo
    ......o`, head[0] - 17, head[1] + 4 - Math.round(up * 0.5));
  // Whiskers twitch.
  const wk = p.whisk ?? 0;
  for (let i = 0; i < (hit ? 0 : 5); i++) {
    cv.set(tip[0] + 4 - i, tip[1] + 5 + Math.round((i * (2 + wk)) / 4), 'j');
    cv.set(tip[0] + 7 - Math.round(i * 0.5), tip[1] + 6 + i + (wk > 0 ? 0 : 0), i < 4 ? 'j' : null);
  }

  // Glasses: two cyan lenses with a hard glare. Knocked up the forehead when hit.
  const gy = hit ? -6 : 0;
  const gx = Math.round(head[0]) - 16, gyy = Math.round(head[1]) - 5 - Math.round(up * 0.6) + gy;
  cv.stamp(`
    .ppppp.ppppppp.
    pijhhhpijjhhhhp
    pjihhhpjjihhhhppp
    phhhhipphhhhihp
    phhhiipphhhiihp
    .ppppp..ppppp..`, gx, gyy, { map: hit ? { j: 'i' } : null });

  if (hit) {
    // The eyes behind them: wide, pupils to pinpricks.
    for (const [ex, ey, r] of [[head[0] - 12, head[1] - 1, 2.4], [head[0] - 5, head[1] - 0.5, 3.2]]) {
      cv.part(cv.ell(ex, ey, r, r), 'j', 'o');
      cv.set(ex - 1, ey, 'p').set(ex - 1, ey + 1, 'p');
    }
  }

  // Headphones: a band over the skull and one big cup with a glowing ring.
  const cup = [head[0] + 5, head[1] + 0.5];
  const band = sub(cv.ell(head[0] + 1.5, head[1] - 2, 12.5, 12.5), or(cv.ell(head[0] + 1.5, head[1] - 1.5, 10.3, 10.3), cv.mask((x, y) => y > head[1] - 3 || x < head[0] - 6)));
  cv.part(band, 'o', 'p');
  cv.remap(and(band, cv.mask((x, y) => y < head[1] - 12.2)), { o: 'n' });
  const cupM = cv.ell(cup[0], cup[1], 6.2, 7);
  cv.outline(cupM, 'p', 'p');
  cv.paint(cupM, 'o');
  cv.paint(and(cupM, sub(cv.ell(cup[0], cup[1], 4.4, 5.2), cv.ell(cup[0], cup[1], 2.8, 3.6))), p.beat ? 'i' : 'h');
  cv.paint(cv.ell(cup[0], cup[1], 1.5, 2.2), p.beat ? 'j' : 'i');
  cv.remap(and(cupM, cv.mask((x, y) => x + y < cup[0] + cup[1] - 6)), { o: 'n' });

  // ---- Near arm: raised, one finger up. Flung wide when hit.
  const sh = [chest[0] + 3, chest[1] - 4];
  const fw = p.finger ?? 0;
  const arm = hit
    ? [[sh[0], sh[1] + 2, 3], [sh[0] - 11, sh[1] + 9, 2.5], [sh[0] - 20, sh[1] + 7, 2.6]]
    : [[sh[0], sh[1] + 2, 3], [sh[0] - 10, sh[1] + 8, 2.6], [sh[0] - 19 + fw, sh[1] + 2, 2.5]];
  const armM = cv.tube(arm);
  cv.outline(armM, 'o', 'o');
  cv.relief(armM, 'klm', { R: 3, th: [0.86, 0.3], smooth: 1 });
  const hand = arm[2];
  const fist = cv.ell(hand[0], hand[1] - 1, 3.2, 3);
  cv.outline(fist, 'o', 'o');
  cv.paint(fist, 'j');
  cv.remap(and(fist, cv.mask((x, y) => y > hand[1] - 0.5)), { j: 'k' });
  if (!hit) {
    const finger = cv.cap(hand[0] - 1, hand[1] - 3, hand[0] - 1.5 + fw * 0.5, hand[1] - 9, 1.5, 1.3);
    cv.outline(finger, 'o', 'o');
    cv.paint(finger, 'j');
  } else {
    for (const a of [-2.2, -3.0, 2.5]) cv.part(cv.cap(hand[0], hand[1] - 1, hand[0] + Math.cos(a) * 5.5, hand[1] - 1 + Math.sin(a) * 5.5, 1.2), 'k', 'o');
  }

  // ---- Vibration marks and sweat.
  for (const [mx, my, flip] of p.buzz ?? []) {
    cv.stamp(`
      i.
      .i
      .i
      i.`, mx + ox, my, { flip });
  }
  if (p.mode === 'hitB') cv.stamp(`
    .i.
    ihi
    ijh
    .h.`, head[0] + 14, head[1] - 4);

  cv.silhouette('p', true);
  return cv;
}

// Twitch: 70 ms frames, a head nod on the beat, a 1 px shiver that never settles.
const idle = [0, 1, 2, 3, 4, 5].map((i) => draw({
  dx: [0, 1, 0, 0, -1, 0][i],
  nod: [1, 0, 0, 1, 0, 0][i],
  chin: [0, 1, 2, 0, 1, 2][i],
  sq: [1, 0, 0, 1, 0, 0][i],
  lean: [0, 0.5, 1, 0, 0.5, 1][i],
  beat: i % 3 === 0,
  finger: [0, 1, 0, -1, 0, 1][i],
  whisk: [0, 2, -1, 1, -2, 0][i],
  ear: [0, -1, 0, 0, 1, 0][i],
  scroll: i,
  cursor: i % 2 === 0,
  tail: [0, 2, 3, 1, -1, -2][i],
  spark: [[[0, 0]], [[-2, -1], [1, -2]], [], [[2, 0]], [[-1, -2], [3, -1], [0, 1]], []][i],
  bug: i % 2,
  buzz: [[], [[26, 44, false], [73, 60, true]], [], [], [[24, 50, false], [75, 66, true]], []][i],
}));

const hit = [
  draw({ mode: 'hitA', dx: 5, lean: 4, nod: 2, chin: -2, sq: 2, tail: -5, ear: -3, whisk: -4, spark: [[-3, -2], [3, -3], [0, -4], [-1, 1]], bug: 1 }),
  draw({ mode: 'hitB', dx: 2, lean: 1.5, nod: 0, chin: 0, tail: 4, ear: 1, whisk: 3, spark: [[2, -1]], bug: 0 }),
];

export default { name: 'vibrat', anims: { idle: { delay: 70, frames: idle }, hit: { delay: 130, frames: hit, loop: false } } };
