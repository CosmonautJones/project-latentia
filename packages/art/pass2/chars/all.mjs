// The overworld cast. Each look is original to Latentia: no caps-and-vests trainer, no borrowed
// silhouettes. Character notes are from docs/design-bible.md.

import { sheet } from './figure.mjs';

const SKIN = { fair: { m: 'u', d: 'v' }, tan: { m: 'v', d: '4' }, brown: { m: '4', d: '5' } };

// The player: a kid from Localhost. Sky jacket, amber pack, a brown mop with one tuft that won't lie flat.
export const player = sheet('player', {
  skin: SKIN.fair,
  hair: { l: '4', m: '5', d: '6' },
  fringe: [5, 4, 3, 3, 4, 3, 2, 3, 3, 2, 3, 3, 4, 5],
  top: { l: 'i', m: 'h', d: 'g' },
  bottom: { m: 'n', d: 'o' },
  shoe: ['8', '7'],
  torso(cv, dir, { b }) {
    if (dir === 'down') {
      cv.rect(11, 17 + b, 2, 7, 'g'); // zip
      cv.rect(11, 17 + b, 2, 1, 'j'); // collar
      cv.rect(9, 17 + b, 1, 4, 'a').rect(14, 17 + b, 1, 4, 'a'); // pack straps
    } else if (dir === 'up') {
      cv.rect(8, 17 + b, 8, 6, 'a').rect(8, 22 + b, 8, 1, '9').rect(15, 17 + b, 1, 6, '9');
      cv.rect(10, 19 + b, 4, 1, '9').rect(8, 17 + b, 8, 1, 'b');
    } else {
      cv.rect(7, 18 + b, 2, 5, 'a').rect(7, 22 + b, 2, 1, '9').rect(7, 18 + b, 2, 1, 'b');
    }
  },
  over(cv, dir, { b }) {
    const x = dir === 'right' ? 11 : 13;
    cv.rect(x, 3 + b, 2, 1, '5').set(x + 1, 2 + b, '5');
  },
});

// Prof. Ilse Epoch: weary deadpan, underfunded. Grey bun, glasses, a lab coat over slate.
export const professor = sheet('professor', {
  skin: SKIN.fair,
  hair: { l: 'k', m: 'l', d: 'm' },
  fringe: [4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 4],
  top: { l: 'j', m: 'k', d: 'l' },
  bottom: { m: 'n', d: 'o' },
  shoe: ['6', 'p'],
  torso(cv, dir, { b }) {
    // The coat hangs past the hips.
    if (dir === 'right') {
      cv.rect(9, 24 + b, 6, 3, 'k').rect(9, 24 + b, 1, 3, 'j').rect(14, 24 + b, 1, 3, 'l').rect(9, 26 + b, 6, 1, 'l');
    } else {
      cv.rect(8, 24 + b, 8, 3, 'k').rect(8, 24 + b, 1, 3, 'j').rect(15, 24 + b, 1, 3, 'l').rect(8, 26 + b, 8, 1, 'l');
      if (dir === 'down') {
        cv.rect(11, 17 + b, 2, 4, 'n').rect(11, 21 + b, 2, 6, 'l'); // shirt, then the coat's opening
        cv.rect(11, 17 + b, 2, 1, 'i');
        cv.rect(14, 20 + b, 1, 2, 'i'); // badge
      } else cv.rect(11, 22 + b, 2, 5, 'l'); // back vent
    }
  },
  over(cv, dir, { b }) {
    if (dir === 'down') {
      cv.rect(10, 2 + b, 4, 3, 'l').rect(10, 2 + b, 2, 1, 'k').rect(13, 3 + b, 1, 2, 'm');
      for (const x of [8, 13]) cv.set(x, 11 + b, 'j').set(x + 2, 11 + b, 'j').set(x, 12 + b, 'i').set(x + 2, 12 + b, 'i');
      cv.rect(11, 11 + b, 2, 1, 'm');
    } else if (dir === 'up') {
      cv.rect(10, 4 + b, 4, 4, 'm').rect(10, 4 + b, 3, 1, 'k').rect(10, 5 + b, 1, 2, 'l').rect(11, 5 + b, 2, 2, 'l');
    } else {
      cv.rect(5, 4 + b, 4, 4, 'l').rect(5, 4 + b, 3, 1, 'k').rect(5, 7 + b, 4, 1, 'm');
      cv.set(15, 11 + b, 'j').set(17, 11 + b, 'j').set(15, 12 + b, 'i').set(17, 12 + b, 'i').rect(11, 11 + b, 4, 1, 'm');
    }
  },
});

// Kip Velocity (@KipShips): the rival. Relentless hype: gelled lemon spikes, mirrored shades,
// a magenta bomber and a phone that is always recording.
export const kip = sheet('kip', {
  skin: SKIN.fair,
  hair: { l: 'b', m: 'a', d: '9' },
  fringe: [3, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3],
  sideburn: 4,
  top: { l: 't', m: 's', d: 'r' },
  bottom: { m: 'o', d: 'p' },
  shoe: ['j', 'k'],
  torso(cv, dir, { b, step }) {
    if (dir === 'right') {
      cv.rect(11, 19 + b, 2, 1, 'j'); // sleeve stripe
      cv.rect(15 + (step < 0 ? 1 : 0), 19 + b, 2, 4, 'o').rect(15 + (step < 0 ? 1 : 0), 20 + b, 2, 2, 'i'); // phone
    } else {
      cv.rect(6, 19 + b, 2, 1, 'j').rect(16, 19 + b, 2, 1, 'j');
      cv.rect(8, 23 + b, 8, 1, 'j'); // waistband
      if (dir === 'down') {
        cv.rect(10, 17 + b, 4, 1, 'j').rect(11, 18 + b, 2, 5, 'r');
        cv.rect(17, 20 + b, 2, 4, 'o').rect(17, 21 + b, 2, 2, 'i').set(17, 21 + b, 'j'); // phone, held up
      } else cv.rect(10, 19 + b, 4, 2, 'j').rect(11, 19 + b, 2, 1, 'b'); // a logo patch on the back
    }
  },
  over(cv, dir, { b }) {
    // Spikes, swept up and forward.
    const spikes = dir === 'right' ? [[7, 3, 2], [10, 1, 3], [13, 0, 3], [16, 2, 2]] : [[6, 3, 2], [9, 1, 3], [12, 0, 3], [15, 1, 3], [18, 3, 1]];
    for (const [x, y, w] of spikes) {
      for (let i = 0; y + i < 5; i++) cv.rect(x - Math.floor(i / 2) + (dir === 'right' ? 0 : 0), y + i + b, w + Math.floor(i / 2), 1, i === 0 ? 'b' : 'a');
      cv.set(x + w - 1, y + 1 + b, '9');
    }
    if (dir === 'down') {
      cv.rect(7, 10 + b, 10, 3, 'o').rect(11, 12 + b, 2, 1, 'u');
      cv.set(8, 11 + b, 'i').set(9, 10 + b, 'i').set(13, 11 + b, 'i').set(14, 10 + b, 'i');
      cv.rect(10, 15 + b, 4, 1, 'j'); // the grin
    } else if (dir === 'right') {
      cv.rect(13, 10 + b, 6, 3, 'o').set(16, 11 + b, 'i').set(17, 10 + b, 'i').rect(9, 11 + b, 4, 1, 'o');
      cv.rect(16, 15 + b, 2, 1, 'j');
    } else {
      for (const [x, y] of [[8, 7], [12, 6], [15, 8], [10, 11], [14, 12]]) cv.rect(x, y + b, 1, 3, '9'); // combed-up strands
    }
  },
});

// Bootcamp Grad: twelve weeks in, senior by self-appointment. Bootcamp-orange hoodie, lanyard still on,
// laptop under one arm.
export const grad = sheet('grad', {
  skin: SKIN.brown,
  hair: { l: 'n', m: 'o', d: 'p' },
  fringe: [4, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 4],
  sideburn: 5,
  top: { l: 'a', m: '9', d: '0' },
  bottom: { m: 'm', d: 'n' },
  shoe: ['k', 'l'],
  under(cv, dir, { b }) {
    if (dir === 'down') cv.rect(6, 15 + b, 12, 3, 'a'); // hood behind the neck
  },
  torso(cv, dir, { b, step }) {
    if (dir === 'down') {
      cv.set(10, 17 + b, 'j').set(11, 18 + b, 'j').set(12, 18 + b, 'j').set(13, 17 + b, 'j'); // lanyard
      cv.rect(11, 19 + b, 2, 2, 'i').rect(11, 19 + b, 2, 1, 'j'); // badge
      cv.rect(9, 22 + b, 6, 1, '0'); // pocket
      cv.rect(4, 19 + b + step, 3, 5, 'k').rect(4, 19 + b + step, 1, 5, 'j').rect(4, 23 + b + step, 3, 1, 'l'); // laptop
    } else if (dir === 'up') {
      cv.rect(8, 16 + b, 8, 4, '0').rect(8, 16 + b, 8, 1, '9').rect(9, 19 + b, 6, 1, '5');
      cv.rect(10, 21 + b, 4, 1, 'j'); // bootcamp wordmark
      cv.rect(17, 19 + b - step, 3, 5, 'l').rect(17, 23 + b - step, 3, 1, 'm');
    } else {
      cv.rect(8, 16 + b, 3, 4, '0').rect(8, 16 + b, 3, 1, '9'); // hood
      cv.rect(12, 19 + b, 4, 5, 'k').rect(12, 19 + b, 4, 1, 'j').rect(12, 23 + b, 4, 1, 'l').rect(13, 21 + b, 2, 1, 'i'); // laptop, stickered
    }
  },
  over(cv, dir, { b }) {
    if (dir === 'down') cv.rect(10, 14 + b, 4, 1, 'j'); // a big, certain smile
    if (dir === 'up') cv.rect(8, 11 + b, 8, 1, 'n').rect(9, 13 + b, 6, 1, 'n'); // a fade
  },
});

// The farmer: his irrigation now feeds the cooling towers. Straw hat, green shirt, blue overalls,
// a rust neckerchief.
export const farmer = sheet('farmer', {
  skin: SKIN.tan,
  hair: { l: '3', m: '4', d: '5' },
  fringe: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  top: { l: 'c', m: 'd', d: 'e' },
  bottom: { m: 'g', d: 'o' },
  shoe: ['5', '6'],
  torso(cv, dir, { b }) {
    if (dir === 'right') {
      cv.rect(9, 20 + b, 6, 4, 'g').rect(9, 20 + b, 1, 4, 'h').rect(12, 17 + b, 1, 3, 'g');
      cv.rect(13, 17 + b, 2, 1, '0');
    } else {
      cv.rect(9, 20 + b, 6, 4, 'g').rect(9, 20 + b, 1, 4, 'h').rect(14, 20 + b, 1, 4, 'o');
      cv.rect(9, 17 + b, 1, 3, 'g').rect(14, 17 + b, 1, 3, 'g');
      if (dir === 'down') {
        cv.set(9, 20 + b, 'b').set(14, 20 + b, 'b'); // buttons
        cv.rect(10, 17 + b, 4, 1, '0').rect(11, 18 + b, 2, 1, '0').set(11, 18 + b, '1'); // neckerchief
        cv.rect(11, 22 + b, 2, 1, 'h'); // bib pocket
      } else cv.rect(10, 19 + b, 4, 1, 'g'); // crossed straps
    }
  },
  over(cv, dir, { b }) {
    // Straw hat: a tall crown, a rust band, a brim wider than his shoulders.
    const cx = dir === 'right' ? 13 : 12;
    cv.rect(cx - 4, 2 + b, 9, 4, 'b').rect(cx - 4, 2 + b, 9, 1, 'j').rect(cx + 3, 3 + b, 2, 3, 'a');
    cv.set(cx - 4, 2 + b, null).set(cx + 4, 2 + b, null);
    cv.rect(cx - 4, 5 + b, 9, 1, '0');
    const [x0, w] = dir === 'right' ? [4, 18] : [3, 18];
    cv.rect(x0, 6 + b, w, 2, 'b').rect(x0, 7 + b, w, 1, 'a').rect(x0 + w - 4, 6 + b, 4, 1, 'a');
    cv.rect(x0 + 3, 6 + b, 2, 1, 'j');
    if (dir === 'down') cv.rect(6, 8 + b, 12, 1, '4'); // the brim's shadow across his brow
    if (dir === 'right') cv.rect(8, 8 + b, 11, 1, '4');
  },
});


export const CAST = { player, professor, kip, grad, farmer };
