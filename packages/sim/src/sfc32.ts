import type { SeedHex } from '@latentia/engine';

// The deck search's own PRNG (Ruling 139 e). The engine keeps its sfc32 internal (it is not in src/index.ts), so the
// sim carries this small copy: the same generator and seeding (four big-endian words of a 32-character lowercase hex
// seed, 12 outputs discarded). Never Math.random: one seed always gives the same stream.

/** Whether `hex` is a usable seed: 32 lowercase hex characters, not all zero (the engine's parseSeed rule). */
export function isSeedHex(hex: string): boolean {
  return /^[0-9a-f]{32}$/.test(hex) && /[1-9a-f]/.test(hex);
}

export class Sfc32 {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: SeedHex) {
    if (!isSeedHex(seed)) throw new RangeError(`a seed is 32 lowercase hex characters, not all zero; got ${seed}`);
    const w = (i: number): number => parseInt(seed.slice(i * 8, i * 8 + 8), 16) >>> 0;
    [this.a, this.b, this.c, this.d] = [w(0), w(1), w(2), w(3)];
    for (let i = 0; i < 12; i++) this.next();
  }

  /** The next uint32. */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + ((this.c << 3) >>> 0)) >>> 0;
    this.c = ((((this.c << 21) | (this.c >>> 11)) >>> 0) + t) >>> 0;
    return t;
  }

  /** A uniform-enough integer in 0..n-1 (n ≥ 1; modulo bias is negligible for the small n the search uses). */
  below(n: number): number {
    if (!(Number.isSafeInteger(n) && n >= 1)) throw new RangeError(`below needs a positive integer, got ${n}`);
    return this.next() % n;
  }

  /** A uniformly chosen element of a non-empty list. */
  pick<T>(xs: readonly T[]): T {
    if (xs.length === 0) throw new RangeError('pick from an empty list');
    return xs[this.below(xs.length)] as T;
  }
}
