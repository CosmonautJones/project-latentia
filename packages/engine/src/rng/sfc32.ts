export type RngState = { a: number; b: number; c: number; d: number };

/** Advance sfc32 and return the next uint32. Mutates `s`. */
export function nextU32(s: RngState): number {
  const t = (((s.a + s.b) >>> 0) + s.d) >>> 0;
  s.d = (s.d + 1) >>> 0;
  s.a = (s.b ^ (s.b >>> 9)) >>> 0;
  s.b = (s.c + ((s.c << 3) >>> 0)) >>> 0;
  s.c = ((((s.c << 21) | (s.c >>> 11)) >>> 0) + t) >>> 0;
  return t;
}

/** Seed from four uint32 words, then discard 12 outputs. */
export function seedRng(words: readonly [number, number, number, number]): RngState {
  const s: RngState = {
    a: words[0] >>> 0,
    b: words[1] >>> 0,
    c: words[2] >>> 0,
    d: words[3] >>> 0,
  };
  for (let i = 0; i < 12; i++) nextU32(s);
  return s;
}
