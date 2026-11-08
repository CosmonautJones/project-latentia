export type SeedHex = string;

export type ParsedSeed =
  | { ok: true; words: [number, number, number, number] }
  | { ok: false; error: 'length' | 'charset' | 'allZero' };

/** Parse 32 lowercase hex chars into four big-endian uint32 words. */
export function parseSeed(hex: SeedHex): ParsedSeed {
  if (hex.length !== 32) return { ok: false, error: 'length' };
  if (!/^[0-9a-f]{32}$/.test(hex)) return { ok: false, error: 'charset' };
  const w = (i: number): number => parseInt(hex.slice(i * 8, i * 8 + 8), 16) >>> 0;
  const words: [number, number, number, number] = [w(0), w(1), w(2), w(3)];
  if (words.every((x) => x === 0)) return { ok: false, error: 'allZero' };
  return { ok: true, words };
}
