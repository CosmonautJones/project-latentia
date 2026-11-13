import { describe, expect, it } from 'vitest';
import { RECEIPT_CREDIT, virtualWaterReceipt } from '../../src/journey/receipt.js';
import { hasGlyph } from '../../src/text/glyphs.js';

describe('the virtual water receipt (satire: deterministic, obviously fake, clearly labelled)', () => {
  it('is a pure function of the run: the same rounds and moves always give the same receipt', () => {
    expect(virtualWaterReceipt({ rounds: 17, moves: 41 })).toEqual(virtualWaterReceipt({ rounds: 17, moves: 41 }));
  });

  it('reads like the bible line, with figures derived from rounds and moves', () => {
    // 4 + 3 x 6 + 13 = 35 dL; 6 + 13 / 2 = 12 Wh.
    expect(virtualWaterReceipt({ rounds: 6, moves: 13 }).text).toBe('This run used 3.5 L of virtual water and 0.012 kWh. Offsets purchased: 0.');
    expect(RECEIPT_CREDIT).toMatch(/Latentia PR department/);
  });

  it('more play costs more (fake) water and power; nothing ever buys an offset', () => {
    const small = virtualWaterReceipt({ rounds: 5, moves: 10 });
    const big = virtualWaterReceipt({ rounds: 30, moves: 70 });
    expect(big.decilitres).toBeGreaterThan(small.decilitres);
    expect(big.wattHours).toBeGreaterThan(small.wattHours);
    expect(big.text).toMatch(/Offsets purchased: 0\.$/);
  });

  it('formats with fixed decimals, even for an empty run, in glyphs the pixel font has', () => {
    const r = virtualWaterReceipt({ rounds: 0, moves: 0 });
    expect(r.text).toBe('This run used 0.4 L of virtual water and 0.000 kWh. Offsets purchased: 0.');
    expect(virtualWaterReceipt({ rounds: 400, moves: 1000 }).text).toBe('This run used 220.4 L of virtual water and 0.900 kWh. Offsets purchased: 0.');
    for (const ch of r.text + RECEIPT_CREDIT) expect(hasGlyph(ch), ch).toBe(true);
  });
});
