import { describe, expect, it } from 'vitest';
import { HINTS, HINT_IDS } from '../../src/battle/hints.js';
import { sanitize } from '../../src/text/wrap.js';

describe('first-time battle hints', () => {
  it('cover PROMPT, context and Drift (and the DR chip), the temperature dial, WHY? and the intent preview', () => {
    expect(HINT_IDS).toEqual(['battle.prompt', 'battle.context', 'battle.temperature', 'battle.why', 'battle.intents']);
    expect(HINTS['battle.prompt']).toMatch(/PROMPT/);
    expect(HINTS['battle.context']).toMatch(/CX/);
    expect(HINTS['battle.context']).toMatch(/COST/);
    expect(HINTS['battle.context']).toMatch(/Drift/);
    expect(HINTS['battle.context']).toMatch(/DR2/);
    expect(HINTS['battle.temperature']).toMatch(/T2 · 1\.0/);
    expect(HINTS['battle.why']).toMatch(/WHY\?/);
    expect(HINTS['battle.intents']).toMatch(/\?/);
  });

  it('are short (at most two dialogue pages) and drawable in the pixel font', () => {
    for (const id of HINT_IDS) {
      expect(HINTS[id].length).toBeLessThanOrEqual(200);
      expect(sanitize(HINTS[id])).toBe(HINTS[id]);
    }
  });
});
