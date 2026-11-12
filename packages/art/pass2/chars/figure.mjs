// Overworld people, 24x32: a chibi base (big head, short body) drawn in four facings and three
// frames (standing, step A, step B). Left is right mirrored. Each look supplies colours, a fringe
// and its own `under`/`over` details (hats, coats, packs), so the cast shares proportions and
// reads as one set, the way the creatures share a palette.
//
// Layout (standing): hair from y=3, head y 5-16, torso y 17-23, legs y 24-28, shoes y 29-30,
// outline on y 31. On a step the body drops 1 px, one leg lifts and the arms swing opposite.

import { Cv, and, or } from '../../src/draw.mjs';

const W = 24, H = 32;

function hair(cv, L, dir, b) {
  const { l, m, d } = L.hair;
  if (L.fringe === null) return;
  const side = dir === 'right';
  const cx = side ? 12.5 : 12;
  const grown = cv.sup(cx, 10.3 + b, side ? 7.4 : 7.8, 6.9, 3);
  const fr = (x) => L.fringe[Math.max(0, Math.min(13, Math.floor(x) - 5))];
  let region;
  if (dir === 'down') region = cv.mask((x, y) => y < 5 + b + fr(x) || ((x < 6 || x > 18) && y < 5 + b + (L.sideburn ?? 6)));
  else if (dir === 'up') region = cv.mask((x, y) => y < 15 + b + (L.long ?? 0));
  else region = cv.mask((x, y) => y < 5 + b + fr(x) - (x > 15 ? 1 : 0) || (x < 11 && y < 14 + b + (L.long ?? 0)) || (x < 13 && y < 9 + b));
  const h = and(grown, region);
  cv.paint(h, m);
  cv.paint(and(h, cv.mask((x, y) => y < 6 + b && y > 4 + b && x > 7 && x < (side ? 13 : 12))), l); // sheen
  cv.paint(and(h, cv.mask((x, y) => (dir !== 'down' && y > 12 + b) || x > (side ? 8.9 : 18) && dir === 'up' || (side && x < 7 && y > 8 + b))), d);
  if (dir === 'up') cv.paint(and(h, cv.mask((x, y) => x > 17 && y > 7 + b)), d);
}

/** One frame. f: 0 standing, 1 step A, 2 step B. */
export function figure(L, dir, f) {
  if (dir === 'left') return figure(L, 'right', f).mirrored();
  const cv = new Cv(W, H);
  const b = f ? 1 : 0;
  const step = f === 1 ? 1 : f === 2 ? -1 : 0;
  const { top, bottom, skin } = L;
  const shoe = L.shoe ?? ['5', '6'];
  const ctx = { b, step, f };
  L.under?.(cv, dir, ctx);

  if (dir === 'right') {
    // Legs: scissor on the steps. The far leg is the darker one.
    const legs = step === 0 ? [[10, 0, 0]] : step === 1 ? [[8, 1, 1], [12, 0, 0]] : [[12, 1, 1], [9, 0, 0]];
    legs.forEach(([x, lift, far]) => {
      cv.rect(x, 24 + b, step === 0 ? 4 : 3, 5 - b - lift, far ? bottom.d : bottom.m);
      cv.rect(x, 29 - lift, step === 0 ? 5 : 4, 2, shoe[far ? 1 : 0]);
      cv.rect(x, 30 - lift, step === 0 ? 5 : 4, 1, shoe[1]);
    });
    cv.rect(9, 17 + b, 6, 7, top.m);
    cv.rect(9, 17 + b, 1, 7, top.l);
    cv.rect(14, 18 + b, 1, 6, top.d);
    L.torso?.(cv, dir, ctx);
    // Near arm, swinging against the legs.
    cv.rect(11, 18 + b, 2, 3, top.d);
    cv.rect(11 - step, 21 + b, 2, 2, top.d);
    cv.rect(11 - step, 23 + b, 2, 1, skin.m);
    const head = cv.sup(12.5, 10.5 + b, 6.5, 6, 3);
    cv.paint(head, skin.m);
    cv.paint(and(head, cv.mask((x, y) => y > 15 + b || x < 8)), skin.d);
    cv.set(19, 12 + b, skin.m); // nose
    cv.rect(16, 11 + b, 1, 2, 'p');
    cv.set(17, 14 + b, skin.d);
  } else {
    const liftL = step === -1 ? 2 : 0, liftR = step === 1 ? 2 : 0;
    for (const [x, lift] of [[8, liftL], [13, liftR]]) {
      cv.rect(x, 24 + b, 3, 5 - b - lift, x === 8 ? bottom.m : bottom.d);
      cv.rect(x, 29 - lift, 3, 2, shoe[0]);
      cv.rect(x, 30 - lift, 3, 1, shoe[1]);
    }
    cv.rect(11, 24 + b, 2, 1, bottom.d);
    cv.rect(8, 17 + b, 8, 7, top.m);
    cv.rect(8, 17 + b, 1, 7, top.l);
    cv.rect(15, 17 + b, 1, 7, top.d);
    cv.rect(8, 23 + b, 8, 1, top.d);
    // Arms swing opposite the legs.
    for (const [x, sw, c] of [[6, -step, top.m], [16, step, top.d]]) {
      cv.rect(x, 17 + b, 2, 6 + (sw > 0 ? 1 : 0) - (sw < 0 ? 1 : 0), c);
      cv.rect(x, 22 + b + sw, 2, 1, skin.m);
    }
    cv.set(6, 17 + b, top.l).set(7, 17 + b, top.l);
    L.torso?.(cv, dir, ctx);
    const head = cv.sup(12, 10.5 + b, 7, 6, 3);
    cv.paint(head, skin.m);
    cv.paint(and(head, cv.mask((x, y) => y > 15 + b || x > 18)), skin.d);
    if (dir === 'down') {
      cv.rect(9, 11 + b, 1, 2, 'p').rect(14, 11 + b, 1, 2, 'p');
      cv.rect(11, 14 + b, 2, 1, skin.d);
    }
  }
  hair(cv, L, dir, b);
  L.over?.(cv, dir, ctx);
  cv.outline(cv.opaque(), 'p');
  return cv;
}

export const sheet = (name, L) => ({
  name,
  frames: Object.fromEntries(['down', 'up', 'left', 'right'].map((d) => [d, [0, 1, 2].map((f) => figure(L, d, f))])),
});
void or;
