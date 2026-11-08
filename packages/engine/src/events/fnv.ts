const HEX = '0123456789abcdef';

function hex16(limb: number): string {
  return (
    HEX.charAt((limb >>> 12) & 15) +
    HEX.charAt((limb >>> 8) & 15) +
    HEX.charAt((limb >>> 4) & 15) +
    HEX.charAt(limb & 15)
  );
}

/**
 * FNV-1a 64-bit over raw bytes, rendered as 16 lowercase hex characters.
 * The 64-bit state is four 16-bit limbs (h0 lowest); the multiply by the prime
 * 0x100000001b3 (= 2^40 + 0x1b3) uses only small Math.imul products (each under 2^26), so
 * every intermediate stays far below 2^53 and no BigInt is needed.
 */
export function fnv1a64Hex(bytes: Uint8Array): string {
  // offset basis 0xcbf29ce484222325
  let h0 = 0x2325;
  let h1 = 0x8422;
  let h2 = 0x9ce4;
  let h3 = 0xcbf2;
  for (let i = 0; i < bytes.length; i++) {
    h0 ^= bytes[i] as number;
    const r0 = Math.imul(h0, 0x1b3);
    const r1 = Math.imul(h1, 0x1b3) + (r0 >>> 16);
    const r2 = Math.imul(h2, 0x1b3) + Math.imul(h0, 0x100) + (r1 >>> 16);
    const r3 = Math.imul(h3, 0x1b3) + Math.imul(h1, 0x100) + (r2 >>> 16);
    h0 = r0 & 0xffff;
    h1 = r1 & 0xffff;
    h2 = r2 & 0xffff;
    h3 = r3 & 0xffff;
  }
  return hex16(h3) + hex16(h2) + hex16(h1) + hex16(h0);
}
