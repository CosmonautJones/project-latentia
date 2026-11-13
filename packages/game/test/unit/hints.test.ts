import { describe, expect, it } from 'vitest';
import { dueRoundHint, hintText, HINTS, HINT_IDS, PROMPT_DIRECT_HINT } from '../../src/battle/hints.js';
import { sanitize } from '../../src/text/wrap.js';

describe('first-time battle hints', () => {
  it('cover PROMPT, the foe telegraph, context pips and Drift (and the DR chip), the temperature dial, WHY? and the teammate plan', () => {
    expect(HINT_IDS).toEqual(['battle.prompt', 'battle.telegraph', 'battle.context', 'battle.temperature', 'battle.why', 'battle.intents']);
    expect(HINTS['battle.telegraph']).toMatch(/ATTACK ~6/);
    expect(HINTS['battle.telegraph']).toMatch(/GUARD, BUFF, DEBUFF and SPECIAL/);
    expect(HINTS['battle.context']).toMatch(/pips/);
    expect(HINTS['battle.prompt']).toMatch(/PROMPT/);
    expect(HINTS['battle.context']).toMatch(/CX/);
    expect(HINTS['battle.context']).toMatch(/Drift/);
    expect(HINTS['battle.context']).toMatch(/DR2/);
    expect(HINTS['battle.temperature']).toMatch(/T2 · 1\.0/);
    expect(HINTS['battle.why']).toMatch(/WHY\?/);
    expect(HINTS['battle.intents']).toMatch(/card/);
    // V11: the "?" is gone from the main battles.
    for (const id of HINT_IDS) expect(HINTS[id]).not.toMatch(/: \?$/);
  });

  it('in direct mode (no PROMPT button) the PROMPT hint names the moves instead', () => {
    expect(hintText('battle.prompt', true)).toBe(PROMPT_DIRECT_HINT);
    expect(PROMPT_DIRECT_HINT).not.toMatch(/PROMPT/);
    expect(PROMPT_DIRECT_HINT.length).toBeLessThanOrEqual(200);
    expect(sanitize(PROMPT_DIRECT_HINT)).toBe(PROMPT_DIRECT_HINT);
    expect(hintText('battle.prompt', false)).toBe(HINTS['battle.prompt']);
    expect(hintText('battle.why', true)).toBe(HINTS['battle.why']);
    expect(HINTS['battle.telegraph']).toMatch(/under the foe's name/);
  });

  it('are short (at most two dialogue pages) and drawable in the pixel font', () => {
    for (const id of HINT_IDS) {
      expect(HINTS[id].length).toBeLessThanOrEqual(200);
      expect(sanitize(HINTS[id])).toBe(HINTS[id]);
    }
  });
});

describe('dueRoundHint', () => {
  it('PROMPT first, then the foe telegraph once a foe telegraphs, then WHY? and the teammate plan', () => {
    const seen = (ids: string[]) => (id: string) => ids.includes(id);
    expect(dueRoundHint(seen([]), { whyFresh: false, ownIntent: false, foeIntent: true })).toBe('battle.prompt');
    expect(dueRoundHint(seen(['battle.prompt']), { whyFresh: true, ownIntent: true, foeIntent: true })).toBe('battle.telegraph');
    expect(dueRoundHint(seen(['battle.prompt']), { whyFresh: false, ownIntent: false, foeIntent: false })).toBeUndefined();
    expect(dueRoundHint(seen(['battle.prompt', 'battle.telegraph']), { whyFresh: false, ownIntent: true, foeIntent: true })).toBe('battle.intents');
  });
});
