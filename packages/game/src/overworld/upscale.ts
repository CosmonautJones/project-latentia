// Fitting v0's 16 px procedural overworld art to v0.1's 24 px tiles until the art pass lands (plan Q1): a clean x1.5
// nearest pattern, where each pair of source pixels becomes three (a a b) along both axes, so every source pixel stays
// one solid block and no colour is blended or invented; and centring a 16 px figure in a 24 px wide frame. Pure.

/** Scale a row-major w x h grid by 1.5 (w and h even): output pixel x reads source pixel floor(x * 2 / 3). */
export function upscaleHalf<T>(px: readonly T[], w: number, h: number): T[] {
  const ow = (w * 3) / 2;
  const oh = (h * 3) / 2;
  const out: T[] = [];
  for (let y = 0; y < oh; y++) {
    const sy = Math.floor((y * 2) / 3);
    for (let x = 0; x < ow; x++) out.push(px[sy * w + Math.floor((x * 2) / 3)] as T);
  }
  return out;
}

/** Centre a w x h grid in a wider `to` x h one, padded with null. */
export function padWidth<T>(px: readonly T[], w: number, h: number, to: number): (T | null)[] {
  const left = Math.floor((to - w) / 2);
  const out: (T | null)[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < to; x++) out.push(x >= left && x < left + w ? (px[y * w + x - left] as T) : null);
  return out;
}
