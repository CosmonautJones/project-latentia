/* global console */
// Latentia art pass 2 build: battle creatures (96x96), overworld tiles (24x24)
// and overworld characters (24x32), rendered to packages/art/out/.
//
// Sources are the modules in packages/art/pass2/. Each draws its frames with
// src/draw.mjs (shapes plus hand-authored text-grid stamps) on Endesga 32
// indices, so nothing off-palette can be expressed.
//
// Usage:
//   node src/pass2.mjs                 build everything listed in pass2/index.mjs
//   node src/pass2.mjs --only a,b      build only these assets (manifest is not rewritten)
//   node src/pass2.mjs --zoom DIR      also write 8x frame-0 close-ups to DIR, for critique
//
// Outputs:
//   out/battle/<name>.png        frames in one row, 1x
//   out/tiles.png                tile frames in one row, 1x
//   out/characters/<name>.png    12 frames in one row, 1x
//   out/manifest.json            frame sizes, counts, animations, tile kind -> frames
//   out/contact/*@4x.png         review sheets;  out/contact/*.gif  4x animated previews

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
import { RGB, T } from './draw.mjs';
import { ASSETS } from '../pass2/index.mjs';

const { GIFEncoder } = gifenc;
const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(PKG, 'out');
const DARK = RGB[25], LIGHT = RGB[2], WHITE = RGB[19], NIGHT = RGB[24];

// ---------------------------------------------------------------- raster

function image(w, h, bg) {
  const png = new PNG({ width: w, height: h });
  if (bg) fill(png, 0, 0, w, h, bg);
  return png;
}

function fill(png, x, y, w, h, rgb) {
  for (let yy = Math.max(0, y); yy < Math.min(png.height, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(png.width, x + w); xx++) {
      const o = (yy * png.width + xx) * 4;
      png.data[o] = rgb[0]; png.data[o + 1] = rgb[1]; png.data[o + 2] = rgb[2]; png.data[o + 3] = 255;
    }
  }
}

function blit(png, cv, ox, oy, k = 1, flat = null) {
  for (let y = 0; y < cv.h; y++) {
    for (let x = 0; x < cv.w; x++) {
      const c = cv.px[y * cv.w + x];
      if (c !== T) fill(png, ox + x * k, oy + y * k, k, k, flat ?? RGB[c]);
    }
  }
}

const save = (rel, png) => {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.isBuffer(png) ? png : PNG.sync.write(png));
};

function row(frames) {
  const { w, h } = frames[0];
  const png = image(w * frames.length, h, null);
  frames.forEach((f, i) => blit(png, f, i * w, 0));
  return png;
}

function gif(frames, delay, k, bg = DARK) {
  const enc = GIFEncoder();
  const palette = [...RGB, bg];
  const { w, h } = frames[0];
  for (const cv of frames) {
    const index = new Uint8Array(w * k * h * k);
    for (let y = 0; y < h * k; y++) {
      for (let x = 0; x < w * k; x++) {
        const c = cv.px[Math.floor(y / k) * w + Math.floor(x / k)];
        index[y * w * k + x] = c === T ? RGB.length : c;
      }
    }
    enc.writeFrame(index, w * k, h * k, { palette, delay });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}

function check(name, frames, size) {
  let orphans = 0;
  for (const f of frames) {
    if (f.w !== size[0] || f.h !== size[1]) throw new Error(`${name}: a frame is ${f.w}x${f.h}, expected ${size.join('x')}`);
    orphans += f.orphans();
  }
  return orphans;
}

// ---------------------------------------------------------------- battle

const BATTLE = 96;
export const BASELINE = 87; // last opaque row of every creature's feet

function buildBattle(a, zoom) {
  const names = Object.keys(a.anims);
  const frames = names.flatMap((n) => a.anims[n].frames);
  const orphans = check(a.name, frames, [BATTLE, BATTLE]);
  const b = frames[0].bbox();
  const bottoms = a.anims.idle.frames.map((f) => f.bbox().y1);
  console.log(`battle/${a.name}: ${frames.length} frames, body ${b.w}x${b.h}, idle bottoms ${[...new Set(bottoms)].join('/')} (baseline ${BASELINE}), orphans ${orphans}`);
  save(`battle/${a.name}.png`, row(frames));

  // Review sheet: all frames at 4x on dark, then frame 0 on light, 1x/2x samples and silhouettes.
  const k = 4, cols = 4, S = BATTLE * k;
  const rows = Math.ceil(frames.length / cols);
  const png = image(S * cols, S * (rows + 1), DARK);
  frames.forEach((f, i) => blit(png, f, (i % cols) * S, Math.floor(i / cols) * S, k));
  const y = S * rows;
  fill(png, 0, y, S, S, LIGHT);
  blit(png, frames[0], 0, y, k);
  fill(png, S, y, S, S, NIGHT);
  blit(png, frames[0], S + 16, y + S - BATTLE - 16, 1);
  blit(png, frames[0], S + 140, y + S - BATTLE * 2 - 16, 2);
  fill(png, S * 2, y, S * 2, S, WHITE);
  blit(png, frames[0], S * 2, y, k, [0, 0, 0]);
  blit(png, a.anims.hit.frames[0], S * 3, y, k, [0, 0, 0]);
  save(`contact/battle-${a.name}@4x.png`, png);
  save(`contact/battle-${a.name}-idle.gif`, gif(a.anims.idle.frames, a.anims.idle.delay, k));
  if (zoom) {
    const z = image(BATTLE * 8 * 2, BATTLE * 8, RGB[22]);
    blit(z, frames[0], 0, 0, 8);
    blit(z, a.anims.hit.frames[0], BATTLE * 8, 0, 8);
    mkdirSync(zoom, { recursive: true });
    writeFileSync(join(zoom, `${a.name}.png`), PNG.sync.write(z));
  }

  let at = 0;
  const animations = {};
  for (const n of names) {
    const an = a.anims[n];
    animations[n] = { frames: an.frames.map(() => at++), frameMs: an.delay, loop: an.loop ?? n === 'idle' };
  }
  return {
    file: `battle/${a.name}.png`, kind: 'battle', frameWidth: BATTLE, frameHeight: BATTLE, frameCount: frames.length,
    facing: 'left', baseline: BASELINE, animations,
  };
}

// ---------------------------------------------------------------- tiles

function buildTiles(a) {
  const TILE = 24;
  const frames = a.tiles.flatMap((t) => t.frames);
  check('tiles', frames, [TILE, TILE]);
  for (const f of frames) if (!a.overlays.includes(f) && f.px.includes(T)) throw new Error('tiles: a map tile has a transparent pixel');
  const all = [...frames, ...a.overlays];
  console.log(`tiles: ${frames.length} tile frames + ${a.overlays.length} overlay frames`);
  save('tiles.png', row(all));

  // Review sheet: every frame at 4x with a gap, then a mock map at 2x built from the real map rows.
  const k = 4, gap = 8, perRow = 7;
  const swRows = Math.ceil(all.length / perRow);
  const mock = a.mock;
  const mw = Math.max(...mock.map((m) => m[0].length)) * TILE * 2;
  const mh = mock.reduce((s, m) => s + m.length * TILE * 2 + gap, 0);
  const W = Math.max(perRow * (TILE * k + gap) + gap, mw + gap * 2);
  const png = image(W, swRows * (TILE * k + gap) + gap + mh, NIGHT);
  all.forEach((f, i) => blit(png, f, gap + (i % perRow) * (TILE * k + gap), gap + Math.floor(i / perRow) * (TILE * k + gap), k));
  let y = swRows * (TILE * k + gap) + gap;
  const byChar = a.legend;
  for (const m of mock) {
    m.forEach((line, ty) => [...line].forEach((ch, tx) => {
      const f = byChar[ch];
      if (f) blit(png, f, gap + tx * TILE * 2, y + ty * TILE * 2, 2);
    }));
    for (const [f, tx, ty] of a.mockActors?.[mock.indexOf(m)] ?? []) blit(png, f, gap + tx * TILE * 2, y + ty * TILE * 2 - 16 - 8, 2);
    y += m.length * TILE * 2 + gap;
  }
  save('contact/tiles@4x.png', png);
  save('contact/tiles-patch.gif', gif(a.tiles.find((t) => t.kind === 'patch').frames, a.patchMs, 8));

  let at = 0;
  const tiles = {};
  for (const t of a.tiles) tiles[t.kind] = t.frames.map(() => at++);
  const overlays = {};
  for (const [n, count] of Object.entries(a.overlayNames)) overlays[n] = Array.from({ length: count }, () => at++);
  return {
    file: 'tiles.png', kind: 'tiles', frameWidth: TILE, frameHeight: TILE, frameCount: all.length, tiles, overlays,
    animations: { patch: { frames: tiles.patch, frameMs: a.patchMs, loop: true }, lurk: { frames: overlays.lurk, frameMs: a.patchMs, loop: true } },
  };
}

// ---------------------------------------------------------------- characters

export const DIRS = ['down', 'up', 'left', 'right'];

function buildChar(a) {
  // a.frames: { down: [idle, walkA, walkB], up: [...], left: [...], right: [...] }
  const frames = DIRS.flatMap((d) => a.frames[d]);
  const orphans = check(a.name, frames, [24, 32]);
  console.log(`characters/${a.name}: ${frames.length} frames, orphans ${orphans}`);
  save(`characters/${a.name}.png`, row(frames));
  const animations = {};
  DIRS.forEach((d, i) => {
    animations[`idle-${d}`] = { frames: [i * 3], frameMs: 0, loop: false };
    // The walk cycle passes through the standing frame between steps.
    animations[`walk-${d}`] = { frames: [i * 3 + 1, i * 3, i * 3 + 2, i * 3], frameMs: a.walkMs ?? 130, loop: true };
  });
  return {
    sheet: { file: `characters/${a.name}.png`, kind: 'character', frameWidth: 24, frameHeight: 32, frameCount: frames.length, directions: DIRS, framesPerDirection: 3, footY: 30, animations },
    frames,
  };
}

function charContact(chars) {
  // One row per character at 4x: 12 frames on grass green, then the down idle at 1x and 2x.
  const k = 4, W = 24 * k, H = 32 * k, gap = 6;
  const png = image(12 * W + gap * 2 + 120, chars.length * (H + gap) + gap, RGB[13]);
  chars.forEach(({ frames }, r) => {
    const y = gap + r * (H + gap);
    if (r % 2) fill(png, 0, y - gap / 2, png.width, H + gap, RGB[3]);
    frames.forEach((f, i) => blit(png, f, gap + i * W, y, k));
    blit(png, frames[0], gap + 12 * W + 10, y + H - 32, 1);
    blit(png, frames[0], gap + 12 * W + 50, y + H - 64, 2);
  });
  save('contact/characters@4x.png', png);
  for (const { name, frames } of chars) {
    const walk = [1, 0, 2, 0].flatMap((i) => [frames[i]]);
    save(`contact/character-${name}-walk.gif`, gif(walk, 130, 4, RGB[13]));
  }
}

// ---------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] ?? '' : null);
  const only = flag('--only')?.split(',');
  const zoom = flag('--zoom');
  const sheets = {};
  const chars = [];
  for (const entry of ASSETS) {
    if (only && !only.includes(entry.name)) continue;
    const a = (await entry.load()).default;
    if (entry.type === 'battle') sheets[`battle/${a.name}`] = buildBattle(a, zoom);
    else if (entry.type === 'tiles') sheets.tiles = buildTiles(a);
    else {
      const c = buildChar(a);
      sheets[`characters/${a.name}`] = c.sheet;
      chars.push({ name: a.name, frames: c.frames });
    }
  }
  if (chars.length) charContact(chars);
  if (only) return;
  const manifest = {
    version: 2,
    palette: 'endesga-32',
    note: 'Frames are laid out in one row per sheet, left to right. Battle creatures face the viewer\'s left; mirror them for the player\'s side.',
    sheets,
  };
  save('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  console.log(`wrote ${OUT}`);
}

await main();
