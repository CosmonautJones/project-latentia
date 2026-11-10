/* global console */
// Drafting aid, NOT part of the build. Prints anim.txt placement lines for
// Sagelet's three orbiting dots so the ellipse spacing is even. The output was
// pasted into sprites/sagelet/anim.txt.
//   node tools/orbit.mjs cx cy rx ry tilt frames
import process from 'node:process';

const [cx, cy, rx, ry, tilt, frames] = process.argv.slice(2).map(Number);
for (let f = 0; f < frames; f++) {
  const back = [], front = [];
  for (let k = 0; k < 3; k++) {
    // Positive angle step with y down = the near side travels right to left.
    const a = ((f * (120 / frames) + k * 120 + 100) * Math.PI) / 180;
    const s = Math.sin(a);
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * s + (x - cx) * tilt;
    const part = s > 0.45 ? 'dot_near' : s > -0.45 ? 'dot_mid' : 'dot_far';
    const size = part === 'dot_near' ? 5 : 4;
    const line = `${part} ${Math.round(x - size / 2)} ${Math.round(y - size / 2)}`;
    (s > 0 ? front : back).push(line);
  }
  console.log(`frame ${f}\n  back: ${back.join(' | ')}\n  front: ${front.join(' | ')}`);
}
