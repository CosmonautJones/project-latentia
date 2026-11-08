import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../src/events/types.js';
import { resolveAction } from '../../src/battle/resolve.js';
import type { BattleState } from '../../src/battle/state.js';
import { at, battle, draws, entry, type DrawHalves } from './helpers.js';

// targeting.ts through resolveAction. 0 a-orch sagelet, 1 a-act1 blitzr, 2 a-act2 forkling,
// 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling.

function fresh(): BattleState {
  const s = battle();
  s.round = 1;
  for (const c of s.creatures) c.hp = c.maxHp = 500;
  return s;
}

function run(s: BattleState, actor: number, moveId: string, target: number, h: DrawHalves = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveAction(s, entry(actor, moveId, target), draws(h), events);
  return events;
}

describe('resolveAction: substitution order and usable moves', () => {
  it('runs the hallucination check (D2 hi) before Drift (D1 hi); when both would fire, hallucination wins (Ruling 45)', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'hallucinating', remaining: 3 });
    at(s, 1).context.drift = 5;
    // Drift alone would keep target 7; hallucination retargets to others[hi(d3, 5)] = [0, 2, 6, 7, 8][1] = 2.
    expect(run(s, 1, 'ship-it', 7, { d2hi: 0, d1hi: 0, d4hi: 3, d3hi: 1 })[0]).toMatchObject({ moveId: 'distilled-strike', target: 2 });
    expect(run(s, 1, 'ship-it', 7, { d2hi: 99, d1hi: 0, d4hi: 3, d3hi: 1 })[0]).toMatchObject({ moveId: 'distilled-strike', target: 7 });
  });

  it('a Drift move whose original target is no longer legal uses the default selector (lowest-HP on-field foe)', () => {
    const s = fresh();
    at(s, 1).context.drift = 1;
    Object.assign(at(s, 7), { hp: 0, fainted: true });
    at(s, 8).hp = 100;
    expect(run(s, 1, 'ship-it', 7, { d1hi: 4, d4hi: 3 })[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'distilled-strike', target: 8 });
  });

  it('the D4 hi pick is mod the stored moveset minus moves disabled by status (Ruling 42)', () => {
    // Full moveset: ship-it, token-burst, low-latency, distilled-strike, compact, clear, guardrail.
    const glazed = fresh();
    at(glazed, 1).context.drift = 5;
    at(glazed, 1).statuses.push({ id: 'glazed', remaining: 3, source: 7 }); // no status moves: ship-it, token-burst, distilled-strike
    expect(run(glazed, 1, 'ship-it', 7, { d1hi: 0, d4hi: 2 })[0]).toMatchObject({ moveId: 'distilled-strike' });
    expect(run(glazed, 1, 'ship-it', 7, { d1hi: 0, d4hi: 4 })[0]).toMatchObject({ moveId: 'token-burst' });
    const overfit = fresh();
    Object.assign(at(overfit, 1), { lastMoveId: 'token-burst' });
    at(overfit, 1).context.drift = 5;
    at(overfit, 1).statuses.push({ id: 'overfit', remaining: 2, source: 7 }); // must repeat its last move
    expect(run(overfit, 1, 'ship-it', 7, { d1hi: 0, d4hi: 5 })[0]).toMatchObject({ moveId: 'token-burst' });
    const free = fresh();
    at(free, 1).context.drift = 5;
    expect(run(free, 1, 'ship-it', 7, { d1hi: 0, d4hi: 3 })[0]).toMatchObject({ moveId: 'distilled-strike' });
  });
});

describe('resolveAction: engine-picked targets (Ruling 43)', () => {
  it('foeMostDamage aims at the on-field foe with the highest estimate (roll 10000, no crit); ties → lowest index', () => {
    const s = fresh();
    // Tree Search (reasoning 85): vs sagelet 6 neutral, vs blitzr 7 half, vs forkling 8 double.
    expect(run(s, 0, 'tree-search', 7)[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 0, moveId: 'tree-search', target: 8 });
    const tie = fresh();
    Object.assign(at(tie, 6), { speciesId: 'forkling', stats: { ...at(tie, 8).stats } });
    expect(run(tie, 0, 'tree-search', 7)[0]).toMatchObject({ target: 6 });
    const staged = fresh();
    at(staged, 8).stages.robustness = 3; // a hardened 8 and a softened 6: 6 now takes more
    at(staged, 6).stages.robustness = -3;
    expect(run(staged, 0, 'tree-search', 7)[0]).toMatchObject({ target: 6 });
    const ko = fresh();
    Object.assign(at(ko, 8), { hp: 0, fainted: true });
    expect(run(ko, 0, 'tree-search', 8)[0]).toMatchObject({ target: 6 });
  });

  it('foeOffByOne aims at the on-field foe with the next-lower index than the intended one, wrapping to the highest', () => {
    const s = fresh();
    expect(run(s, 1, 'off-by-one', 7)[0]).toMatchObject({ moveId: 'off-by-one', target: 6 });
    expect(run(s, 1, 'off-by-one', 6)[0]).toMatchObject({ target: 8 });
    expect(run(s, 1, 'off-by-one', 8)[0]).toMatchObject({ target: 7 });
    Object.assign(at(s, 6), { hp: 0, fainted: true });
    expect(run(s, 1, 'off-by-one', 7)[0]).toMatchObject({ target: 8 });
  });
});
