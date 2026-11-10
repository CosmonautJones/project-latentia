/* global console */
// Latentia art build: renders text-grid sprite sources to PNG sheets, GIFs,
// a contact sheet and a self-contained HTML preview.
//
// Source format:
//   sprites/<name>/parts.txt  named grids of palette-index characters
//   sprites/<name>/anim.txt   per-frame composition: `part x y [ops]` lines under
//                             each `frame`, drawn in order (later lines on top)
//
// Usage:
//   node src/build.mjs                 render everything to art/style-test/
//   node src/build.mjs --pass 2       also snapshot the contact sheet as passes/pass-2-...
//   node src/build.mjs --debug DIR    also write 8x single-frame PNGs to DIR
//   node src/build.mjs --check        lint only, write nothing

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder } = gifenc;

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, '..');
const ROOT = resolve(PKG, '..', '..');
const OUT = join(ROOT, 'art', 'style-test');

const SIZE = 64;
const BASELINE = 58; // last opaque row of every creature's feet sits on y = BASELINE

// Endesga 32, in Lospec order. A grid character is the index in base 32
// (0-9 then a-v); '.' is transparent.
export const PALETTE = [
  'be4a2f', 'd77643', 'ead4aa', 'e4a672', 'b86f50', '733e39', '3e2731', 'a22633',
  'e43b44', 'f77622', 'feae34', 'fee761', '63c74d', '3e8948', '265c42', '193c3e',
  '124e89', '0099db', '2ce8f5', 'ffffff', 'c0cbdc', '8b9bb4', '5a6988', '3a4466',
  '262b44', '181425', 'ff0044', '68386c', 'b55088', 'f6757a', 'e8b796', 'c28569',
];
const CHARS = '0123456789abcdefghijklmnopqrstuv';
const RGB = PALETTE.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const T = -1; // transparent

const STARTERS = ['sagelet', 'blitzr', 'forkling'];

// ---------------------------------------------------------------- parsing

function parseParts(text, file) {
  const parts = new Map();
  let cur = null;
  const lines = text.split('\n');
  lines.forEach((raw, n) => {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('#')) return;
    if (line.startsWith('@part ')) {
      cur = { name: line.slice(6).trim(), rows: [] };
      if (parts.has(cur.name)) throw new Error(`${file}:${n + 1}: duplicate part ${cur.name}`);
      parts.set(cur.name, cur);
      return;
    }
    if (line === '') return;
    if (!cur) throw new Error(`${file}:${n + 1}: grid row before any @part`);
    const row = [];
    for (const ch of line) {
      if (ch === '.') row.push(T);
      else {
        const idx = CHARS.indexOf(ch);
        if (idx < 0) throw new Error(`${file}:${n + 1}: '${ch}' is not a palette index`);
        row.push(idx);
      }
    }
    cur.rows.push(row);
  });
  for (const p of parts.values()) {
    const w = p.rows.reduce((m, r) => Math.max(m, r.length), 0);
    // Rows are padded, but a ragged part is almost always a typo, so say so.
    p.rows.forEach((r, i) => {
      if (r.length !== w) console.log(`  note: ${file} part '${p.name}' row ${i} is ${r.length} wide, part is ${w}`);
    });
    for (const r of p.rows) while (r.length < w) r.push(T);
  }
  return parts;
}

function parseAnim(text, file) {
  const anim = { delay: 100, frames: [] };
  let cur = null;
  text.split('\n').forEach((raw, n) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') return;
    const tok = line.split(/\s+/);
    if (tok[0] === 'delay') {
      anim.delay = Number(tok[1]);
      return;
    }
    if (tok[0] === 'frame') {
      cur = [];
      anim.frames.push(cur);
      return;
    }
    if (!cur) throw new Error(`${file}:${n + 1}: placement before any frame`);
    const place = { part: tok[0], x: Number(tok[1]), y: Number(tok[2]), ops: [] };
    if (Number.isNaN(place.x) || Number.isNaN(place.y)) throw new Error(`${file}:${n + 1}: bad x/y`);
    for (const op of tok.slice(3)) {
      const m = /^(dr|ir|dc|ic)=(\d+(?:,\d+)*)$/.exec(op);
      if (!m) throw new Error(`${file}:${n + 1}: unknown op '${op}'`);
      for (const v of m[2].split(',')) place.ops.push([m[1], Number(v)]);
    }
    cur.push(place);
  });
  return anim;
}

// Per-frame edits. Each works on the part's own coordinates:
//   dr=N drop row N        ir=N duplicate row N
//   dc=N drop column N     ic=N duplicate column N
// They are how squash and stretch are expressed without redrawing a part.
function applyOps(rows, ops) {
  let g = rows.map((r) => r.slice());
  for (const [op, n] of ops) {
    if (op === 'dr') g.splice(n, 1);
    else if (op === 'ir') g.splice(n, 0, g[n].slice());
    else if (op === 'dc') g = g.map((r) => r.filter((_, i) => i !== n));
    else if (op === 'ic') g = g.map((r) => [...r.slice(0, n), r[n], ...r.slice(n)]);
  }
  return g;
}

function composeFrame(parts, placements, where) {
  const px = new Int8Array(SIZE * SIZE).fill(T);
  for (const pl of placements) {
    const part = parts.get(pl.part);
    if (!part) throw new Error(`${where}: unknown part '${pl.part}'`);
    const g = applyOps(part.rows, pl.ops);
    g.forEach((row, dy) => {
      row.forEach((c, dx) => {
        if (c === T) return;
        const x = pl.x + dx;
        const y = pl.y + dy;
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
          throw new Error(`${where}: part '${pl.part}' leaves the canvas at ${x},${y}`);
        }
        px[y * SIZE + x] = c;
      });
    });
  }
  return px;
}

function loadSprite(name) {
  const dir = join(PKG, 'sprites', name);
  const parts = parseParts(readFileSync(join(dir, 'parts.txt'), 'utf8'), `${name}/parts.txt`);
  const anim = parseAnim(readFileSync(join(dir, 'anim.txt'), 'utf8'), `${name}/anim.txt`);
  const frames = anim.frames.map((f, i) => composeFrame(parts, f, `${name} frame ${i}`));
  return { name, delay: anim.delay, frames };
}

// ---------------------------------------------------------------- lint

function bbox(px) {
  let x0 = SIZE, y0 = SIZE, x1 = -1, y1 = -1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (px[y * SIZE + x] === T) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// An orphan is an opaque pixel with no 8-neighbour of its own colour. Some are
// deliberate (a 1px eye glint), so this reports instead of failing.
function orphans(px) {
  const out = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = px[y * SIZE + x];
      if (c === T) continue;
      let friend = false;
      for (let dy = -1; dy <= 1 && !friend; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= SIZE || yy >= SIZE) continue;
          if (px[yy * SIZE + xx] === c) { friend = true; break; }
        }
      }
      if (!friend) out.push(`${x},${y}:${CHARS[c]}`);
    }
  }
  return out;
}

function lint(sprite) {
  const report = [];
  const used = new Set();
  sprite.frames.forEach((px, i) => {
    for (const c of px) if (c !== T) used.add(c);
    const b = bbox(px);
    const o = orphans(px);
    report.push(
      `  frame ${i}: bbox ${b.w}x${b.h} at ${b.x0},${b.y0}  bottom y=${b.y1}` +
        (o.length ? `  orphans(${o.length}): ${o.slice(0, 12).join(' ')}` : ''),
    );
  });
  const cols = [...used].sort((a, b) => a - b).map((c) => `${CHARS[c]}=#${PALETTE[c]}`);
  report.unshift(`${sprite.name}: ${sprite.frames.length} frames @ ${sprite.delay} ms, ${used.size} colours: ${cols.join(' ')}`);
  return report.join('\n');
}

// ---------------------------------------------------------------- raster

function makeImage(w, h, bg) {
  const png = new PNG({ width: w, height: h });
  if (bg) fillRect(png, 0, 0, w, h, bg);
  return png;
}

function fillRect(png, x, y, w, h, rgb) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const o = (yy * png.width + xx) * 4;
      png.data[o] = rgb[0];
      png.data[o + 1] = rgb[1];
      png.data[o + 2] = rgb[2];
      png.data[o + 3] = 255;
    }
  }
}

// Nearest-neighbour blit of one frame. `flat` paints every opaque pixel in one
// colour (the silhouette pass).
function blit(png, px, ox, oy, scale, flat) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = px[y * SIZE + x];
      if (c === T) continue;
      fillRect(png, ox + x * scale, oy + y * scale, scale, scale, flat ?? RGB[c]);
    }
  }
}

function sheet(sprite, scale) {
  const png = makeImage(SIZE * scale * sprite.frames.length, SIZE * scale, null);
  sprite.frames.forEach((px, i) => blit(png, px, i * SIZE * scale, 0, scale));
  return PNG.sync.write(png);
}

function gif(sprite, scale) {
  const enc = GIFEncoder();
  const palette = [...RGB, [0, 0, 0]];
  const TI = RGB.length;
  const w = SIZE * scale;
  for (const px of sprite.frames) {
    const index = new Uint8Array(w * w);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const c = px[Math.floor(y / scale) * SIZE + Math.floor(x / scale)];
        index[y * w + x] = c === T ? TI : c;
      }
    }
    enc.writeFrame(index, w, w, { palette, delay: sprite.delay, transparent: true, transparentIndex: TI, dispose: 2 });
  }
  enc.finish();
  return Buffer.from(enc.bytes());
}

const DARK = RGB[25];
const LIGHT = RGB[2];

function contactSheet(sprites) {
  const pad = 8;
  const cellW = SIZE + SIZE * 2 + SIZE * 4 + pad * 4; // 1x, 2x, 4x side by side
  const rowH = SIZE * 4 + pad * 2;
  const silH = SIZE * 2 + pad * 2;
  const w = cellW * sprites.length;
  const h = rowH * 2 + silH;
  const png = makeImage(w, h, DARK);
  fillRect(png, 0, rowH, w, rowH, LIGHT);
  fillRect(png, 0, rowH * 2, w, silH, RGB[19]);
  sprites.forEach((s, i) => {
    const px = s.frames[0];
    const ox = i * cellW + pad;
    for (const row of [0, 1]) {
      const oy = row * rowH + pad;
      // Smaller scales are bottom-aligned with the 4x copy so baselines line up.
      blit(png, px, ox, oy + SIZE * 3, 1);
      blit(png, px, ox + SIZE + pad, oy + SIZE * 2, 2);
      blit(png, px, ox + SIZE * 3 + pad * 2, oy, 4);
    }
    const sy = rowH * 2 + pad;
    blit(png, px, ox, sy + SIZE, 1, [0, 0, 0]);
    blit(png, px, ox + SIZE + pad, sy, 2, [0, 0, 0]);
    // A second silhouette from mid-cycle, to check the read survives the animation.
    blit(png, s.frames[Math.floor(s.frames.length / 2)], ox + SIZE * 3 + pad * 2, sy, 2, [0, 0, 0]);
  });
  return PNG.sync.write(png);
}

function previewHtml(sprites, sheets) {
  const css = [];
  const blocks = [];
  for (const s of sprites) {
    const n = s.frames.length;
    const uri = `data:image/png;base64,${sheets.get(s.name).toString('base64')}`;
    css.push(`.${s.name}{background-image:url(${uri});animation-duration:${n * s.delay}ms}`);
    const cells = [1, 3, 6]
      .map((k) => `<div class="cell"><div class="spr ${s.name}" style="--k:${k}"></div><small>${k}x</small></div>`)
      .join('');
    blocks.push(
      `<section><h2>${s.name} <small>${n} frames @ ${s.delay} ms</small></h2>` +
        `<div class="row dark">${cells}</div><div class="row light">${cells}</div></section>`,
    );
  }
  return `<!doctype html>
<meta charset="utf-8">
<title>Latentia style test: starter idles</title>
<style>
body{margin:24px;background:#262b44;color:#c0cbdc;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace}
h1{font-size:18px;color:#fff}h2{font-size:15px;color:#fee761;margin:24px 0 8px;text-transform:capitalize}
small{color:#8b9bb4;font-weight:normal}
.row{display:flex;align-items:flex-end;gap:24px;padding:16px;width:max-content}
.dark{background:#181425}.light{background:#ead4aa}.light small{color:#3a4466}
.cell{display:flex;flex-direction:column;align-items:center;gap:6px}
.spr{--n:6;width:calc(64px*var(--k));height:calc(64px*var(--k));background-repeat:no-repeat;
background-size:calc(64px*var(--k)*var(--n)) calc(64px*var(--k));
image-rendering:pixelated;image-rendering:crisp-edges;image-rendering:pixelated;
animation-name:run;animation-timing-function:steps(var(--n));animation-iteration-count:infinite}
@keyframes run{from{background-position-x:0}to{background-position-x:calc(-64px*var(--k)*var(--n))}}
${css.join('\n')}
</style>
<h1>Latentia style test: starter battle-front idles</h1>
<p>64x64 frames, Endesga 32, shown at 1x, 3x and 6x on #181425 and #ead4aa. Self-contained: the sheets are inlined.</p>
${blocks.join('\n')}
`;
}

// ---------------------------------------------------------------- main

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? null : args[i + 1] ?? '';
  };
  const only = flag('--only');
  const names = only ? only.split(',') : STARTERS;
  const sprites = names.map(loadSprite);
  for (const s of sprites) {
    console.log(lint(s));
    const bottoms = new Set(s.frames.map((f) => bbox(f).y1));
    if (Math.max(...bottoms) !== BASELINE) console.log(`  WARNING: lowest pixel is not on the common baseline y=${BASELINE}`);
  }
  if (args.includes('--check')) return;

  mkdirSync(join(OUT, 'passes'), { recursive: true });
  const sheets = new Map();
  for (const s of sprites) {
    const one = sheet(s, 1);
    sheets.set(s.name, one);
    writeFileSync(join(OUT, `${s.name}-idle-sheet.png`), one);
    writeFileSync(join(OUT, `${s.name}-idle-sheet@4x.png`), sheet(s, 4));
    writeFileSync(join(OUT, `${s.name}-idle.gif`), gif(s, 4));
  }
  if (!only) {
    writeFileSync(join(OUT, 'contact-sheet.png'), contactSheet(sprites));
    writeFileSync(join(OUT, 'preview.html'), previewHtml(sprites, sheets));
    const pass = flag('--pass');
    if (pass) copyFileSync(join(OUT, 'contact-sheet.png'), join(OUT, 'passes', `pass-${pass}-contact-sheet.png`));
  }
  const debug = flag('--debug');
  if (debug) {
    mkdirSync(debug, { recursive: true });
    for (const s of sprites) {
      // 8x frames, three per image, on a split dark/light ground for critique.
      for (let i = 0; i < s.frames.length; i += 3) {
        const k = 8;
        const png = makeImage(SIZE * k * 3, SIZE * k, DARK);
        fillRect(png, SIZE * k * 2, 0, SIZE * k, SIZE * k, LIGHT);
        for (let j = 0; j < 3 && i + j < s.frames.length; j++) blit(png, s.frames[i + j], j * SIZE * k, 0, k);
        writeFileSync(join(debug, `${s.name}-f${i}.png`), PNG.sync.write(png));
      }
    }
  }
  console.log(`wrote ${OUT}`);
}

main();
