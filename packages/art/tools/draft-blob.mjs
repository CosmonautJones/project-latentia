/* global console */
// One-off drafting aid, NOT part of the build. Prints a shaded, outlined
// egg/ellipse as a text grid to stdout so a round base form starts with clean
// pixel curves. Its output was the reference for Sagelet's first body outline,
// which was then redrawn by hand; the build never runs this file.
//
//   node tools/draft-blob.mjs W H cy ryTop ryBot power hi main shade deep outLit outDark
//   e.g. node tools/draft-blob.mjs 34 32 15 14 19 2.6 i h g o o p
import process from 'node:process';

const [W, H, cy, ryTop, ryBot, pow, hi, main, shade, deep, outLit, outDark] = process.argv.slice(2);
const w = Number(W), h = Number(H);
const cx = (w - 1) / 2, rx = w / 2 - 1;
const L = [-0.52, -0.6, 0.61];
const inside = (x, y) => {
  const dx = (x - cx) / rx;
  const ry = y < Number(cy) ? Number(ryTop) : Number(ryBot);
  const dy = (y - Number(cy)) / ry;
  const p = y < Number(cy) ? 2 : Number(pow);
  return Math.abs(dx) ** p + Math.abs(dy) ** p <= 1;
};
const rows = [];
for (let y = 0; y < h; y++) {
  let row = '';
  for (let x = 0; x < w; x++) {
    const a = x > 0 && x < w - 1 && y > 0 && y < h - 1 && inside(x, y);
    const fill = a && inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1);
    if (!a) { row += '.'; continue; }
    const dx = (x - cx) / rx;
    const ry = y < Number(cy) ? Number(ryTop) : Number(ryBot);
    const dy = (y - Number(cy)) / ry;
    if (!fill) { row += dx * L[0] + dy * L[1] > 0.25 ? outLit : outDark; continue; }
    const nz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const d = dx * L[0] + dy * L[1] + nz * L[2];
    row += d > 0.93 ? hi : d > 0.32 ? main : d > -0.05 ? shade : deep;
  }
  rows.push(row);
}
console.log(rows.join('\n'));
