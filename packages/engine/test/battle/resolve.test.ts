import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../src/events/types.js';
import { EngineInvariantError } from '../../src/math/bp.js';
import { computeDamage, type DamageMods } from '../../src/math/damage.js';
import { effectiveStat } from '../../src/math/stats.js';
import { resolveAction } from '../../src/battle/resolve.js';
import type { BattleState } from '../../src/battle/state.js';
import { at, battle, draws, entry, type DrawHalves } from './helpers.js';

// Canonical indices (helpers.battle): 0 a-orch sagelet, 1 a-act1 blitzr, 2 a-act2 forkling,
// 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling. Subagents with no trained temperature act at T2.

function fresh(): BattleState {
  const s = battle();
  s.round = 1;
  for (const c of s.creatures) c.hp = c.maxHp = 500; // nothing faints unless a test wants it
  return s;
}

function run(s: BattleState, actor: number, moveId: string, target: number, h: DrawHalves = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveAction(s, entry(actor, moveId, target), draws(h), events);
  return events;
}

const ofType = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) =>
  events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

/** Damage the pipeline should deal with these modifiers, from the creatures' current stats and stages. */
function expected(s: BattleState, actor: number, target: number, power: number, mods: DamageMods): number {
  const u = at(s, actor);
  const t = at(s, target);
  return computeDamage({
    power,
    atk: effectiveStat(u.stats.compute, u.stages.compute ?? 0),
    def: effectiveStat(t.stats.robustness, t.stages.robustness ?? 0),
    level: u.level,
    mods,
  });
}

const dealt = (events: BattleEvent[]) => ofType(events, 'Damage').map((e) => e.amount);

describe('resolveAction: a plain hit', () => {
  it('emits MoveUsed, pays context, deals damage and starts a Handoff chain; records the move', () => {
    const s = fresh();
    const dmg = expected(s, 1, 7, 65, { type: 10000, native: 12500, roll: 10000 });
    expect(run(s, 1, 'ship-it', 7)).toEqual([
      { round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 7 },
      { round: 1, type: 'ContextAdded', target: 1, kind: 'cost', tokens: 1, tokensAfter: 1 },
      { round: 1, type: 'Damage', actor: 1, target: 7, amount: dmg, hpAfter: 500 - dmg },
      { round: 1, type: 'HandoffChain', actor: 1, chain: [1] },
      { round: 1, type: 'ContextAdded', target: 7, kind: 'observation', tokens: 1, tokensAfter: 1 },
      { round: 1, type: 'ObservationGained', target: 7, observation: 'ship-it' },
    ]);
    expect(at(s, 7).hp).toBe(500 - dmg);
    expect(at(s, 1)).toMatchObject({ actedThisBattle: true, lastMoveId: 'ship-it', moveHistory: [{ round: 1, moveId: 'ship-it', damaged: [7] }] });
  });

  it('pins one L5 number: Sagelet Happy to Help on Forkling at T2 deals 16', () => {
    // P 70, Atk 12, Def 11, LF 4: floor(70×12×4×10000 / 550) = 61090 → type 20000: 122180 → native 12500:
    // 152725 → roll 10000 (a first hit takes no Handoff) → floor(/10000) + 1 = 16.
    const s = battle();
    s.round = 1;
    expect(dealt(run(s, 0, 'happy-to-help', 8))).toEqual([16]);
    expect(at(s, 8).hp).toBe(at(s, 8).maxHp - 16);
  });
});

describe('resolveAction: accuracy', () => {
  it('hits when lo(d3, 100) < hitChance and misses at the threshold; a miss still pays and skips every effect', () => {
    const s = fresh();
    expect(dealt(run(s, 1, 'ship-it', 7, { d3lo: 94 }))).toHaveLength(1); // ship-it 95 at T2
    const miss = run(s, 1, 'ship-it', 7, { d3lo: 95 });
    expect(miss.slice(0, 3)).toEqual([
      { round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 7 },
      { round: 1, type: 'ContextAdded', target: 1, kind: 'cost', tokens: 1, tokensAfter: 2 },
      { round: 1, type: 'Missed', actor: 1, target: 7 },
    ]);
    expect(dealt(miss)).toEqual([]);
    expect(ofType(miss, 'HandoffChain')).toEqual([]);
    expect(at(s, 1).moveHistory[1]).toEqual({ round: 1, moveId: 'ship-it', damaged: [] });
  });

  it('uses the temperature modifier and -8 per Drift stack (Drift counted after paying)', () => {
    const s = fresh();
    at(s, 1).trainedTemperature = 0; // +10 → 105, clamped to 100
    expect(dealt(run(s, 1, 'ship-it', 7, { d3lo: 99 }))).toHaveLength(1);
    const t = fresh();
    at(t, 1).context.drift = 1; // 95 - 8 = 87
    expect(dealt(run(t, 1, 'ship-it', 7, { d3lo: 86 }))).toHaveLength(1);
    expect(ofType(run(t, 1, 'ship-it', 7, { d3lo: 87 }), 'Missed')).toHaveLength(1);
    const u = fresh();
    const ctx = at(u, 1).context;
    for (let i = 0; i < ctx.window; i++) ctx.tokens.push({ kind: 'junk', seq: i });
    const overflow = run(u, 1, 'ship-it', 7, { d3lo: 87 }); // paying 1 cell overflows into Drift 1 → 87 misses
    expect(overflow[1]).toEqual({ round: 1, type: 'DriftChanged', target: 1, drift: 1 });
    expect(ofType(overflow, 'Missed')).toHaveLength(1);
  });

  it('gives a Robust creature +5 only against a foe not in recordedFoes', () => {
    const robust = fresh();
    at(robust, 1).generalization = 70;
    expect(dealt(run(robust, 1, 'ship-it', 7, { d3lo: 99 }))).toHaveLength(1); // 95 + 5 = 100
    const recorded = fresh();
    Object.assign(at(recorded, 1), { generalization: 90, recordedFoes: ['b-act1'] });
    expect(ofType(run(recorded, 1, 'ship-it', 7, { d3lo: 95 }), 'Missed')).toHaveLength(1);
    const stable = fresh();
    at(stable, 1).generalization = 69;
    expect(ofType(run(stable, 1, 'ship-it', 7, { d3lo: 95 }), 'Missed')).toHaveLength(1);
  });

  it('applies accuracy and evasion stages at 10 points each', () => {
    const s = fresh();
    at(s, 1).stages.accuracy = 1;
    at(s, 7).stages.evasion = 2; // 95 + 10 - 20 = 85
    expect(dealt(run(s, 1, 'ship-it', 7, { d3lo: 84 }))).toHaveLength(1);
    expect(ofType(run(s, 1, 'ship-it', 7, { d3lo: 85 }), 'Missed')).toHaveLength(1);
  });
});

describe('resolveAction: crit and roll', () => {
  it('crits when lo(d4, 48) < the threshold of the temperature base stage (T2 → stage 2 → 2/48)', () => {
    const s = fresh();
    const crit = run(s, 1, 'ship-it', 7, { d4lo: 1 });
    expect(ofType(crit, 'Crit')).toEqual([{ round: 1, type: 'Crit', actor: 1, target: 7 }]);
    expect(dealt(crit)).toEqual([expected(s, 1, 7, 65, { type: 10000, native: 12500, crit: 15000, roll: 10000 })]);
    expect(ofType(run(s, 1, 'ship-it', 7, { d4lo: 2 }), 'Crit')).toEqual([]);
  });

  it('gives Reasoning moves +1 crit stage at T0 and T1 only', () => {
    const t1 = fresh();
    t1.sides.a.temperature = 1; // orchestrator: side temperature; reasoning → stage 2 → 2/48
    expect(ofType(run(t1, 0, 'happy-to-help', 7, { d4lo: 1 }), 'Crit')).toHaveLength(1);
    const t0 = fresh();
    t0.sides.a.temperature = 0; // stage 1 → 1/48
    expect(ofType(run(t0, 0, 'happy-to-help', 7, { d4lo: 0 }), 'Crit')).toHaveLength(1);
    expect(ofType(run(t0, 0, 'happy-to-help', 7, { d4lo: 1 }), 'Crit')).toEqual([]);
    const speed = fresh();
    at(speed, 1).trainedTemperature = 1; // not reasoning: stage 1 → 1/48
    expect(ofType(run(speed, 1, 'ship-it', 7, { d4lo: 1 }), 'Crit')).toEqual([]);
    expect(ofType(run(speed, 1, 'ship-it', 7, { d4lo: 0 }), 'Crit')).toHaveLength(1);
  });

  it('a crit ignores the defender’s positive Robustness stages but keeps negative ones', () => {
    const s = fresh();
    at(s, 7).stages.robustness = 2;
    const [hit] = dealt(run(s, 1, 'ship-it', 7, { d4lo: 0 }));
    at(s, 7).stages.robustness = 0;
    expect(hit).toBe(expected(s, 1, 7, 65, { type: 10000, native: 12500, crit: 15000, roll: 10000 }));
    const t = fresh();
    at(t, 7).stages.robustness = -1;
    expect(dealt(run(t, 1, 'ship-it', 7, { d4lo: 0 }))).toEqual([
      expected(t, 1, 7, 65, { type: 10000, native: 12500, crit: 15000, roll: 10000 }),
    ]);
  });

  it('rolls rollMinPct×100 + lo(d5, width)×100 basis points; T0 is always 10000', () => {
    const s = fresh();
    expect(dealt(run(s, 1, 'ship-it', 7, { d5lo: 10 }))).toEqual([expected(s, 1, 7, 65, { type: 10000, native: 12500, roll: 9500 })]);
    const t4 = fresh();
    at(t4, 1).trainedTemperature = 4; // 60 + lo(d5, 91); 90 → 150%
    expect(dealt(run(t4, 1, 'ship-it', 7, { d5lo: 90 }))).toEqual([expected(t4, 1, 7, 65, { type: 10000, native: 12500, roll: 15000 })]);
    const t0 = fresh();
    at(t0, 1).trainedTemperature = 0;
    expect(dealt(run(t0, 1, 'ship-it', 7, { d5lo: 0xffff }))).toEqual([expected(t0, 1, 7, 65, { type: 10000, native: 12500, roll: 10000 })]);
  });
});

describe('resolveAction: Wild effect lists', () => {
  // Hot Take: 90 power; wild ×1.5, wildT4 ×2. Voice is not native to Blitzr; voice vs speed is neutral.
  const at_ = (temp: 2 | 3 | 4) => {
    const s = fresh();
    at(s, 1).trainedTemperature = temp;
    const roll = { 2: 10000, 3: 7500 + 15 * 100, 4: 6000 + 15 * 100 }[temp];
    return { got: dealt(run(s, 1, 'hot-take', 7)), s, roll };
  };

  it('fires only at T3+, and wildT4 replaces wild at T4', () => {
    const t2 = at_(2);
    expect(t2.got).toEqual([expected(t2.s, 1, 7, 90, { type: 10000, roll: t2.roll })]);
    const t3 = at_(3);
    expect(t3.got).toEqual([expected(t3.s, 1, 7, 135, { type: 10000, roll: t3.roll })]);
    const t4 = at_(4);
    expect(t4.got).toEqual([expected(t4.s, 1, 7, 180, { type: 10000, roll: t4.roll })]);
  });

  it('applies the T4 super-effective 12500 and emits TypeEffect; a super-effective hit frees the oldest non-Junk token', () => {
    const s = fresh();
    s.sides.a.temperature = 4;
    at(s, 0).context.tokens.push({ kind: 'junk', seq: 90 });
    const events = run(s, 0, 'happy-to-help', 8, { d5lo: 40 }); // 60 + 40 → 100%
    expect(ofType(events, 'TypeEffect')).toEqual([{ round: 1, type: 'TypeEffect', actor: 0, target: 8, multiplierBp: 20000 }]);
    expect(dealt(events)).toEqual([expected(s, 0, 8, 70, { type: 20000, t4se: 12500, native: 12500, roll: 10000 })]);
    expect(ofType(events, 'ContextAdded').filter((e) => e.target === 0)).toEqual([
      { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 3, tokensAfter: 4 },
      { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: -1, tokensAfter: 3 },
    ]);
    expect(at(s, 0).context.tokens.map((t) => t.kind)).toEqual(['junk', 'cost', 'cost']);
    const t3 = fresh();
    t3.sides.a.temperature = 3;
    expect(dealt(run(t3, 0, 'happy-to-help', 8, { d5lo: 25 }))).toEqual([expected(t3, 0, 8, 70, { type: 20000, native: 12500, roll: 10000 })]);
  });
});

describe('resolveAction: Rate Limited, hallucination and Drift', () => {
  it('a Rate Limited creature loses its turn when lo(d2, 100) < 25: ActionSkipped only, nothing paid', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'rateLimited', remaining: 3 });
    expect(run(s, 1, 'ship-it', 7, { d2lo: 24 })).toEqual([{ round: 1, type: 'ActionSkipped', actor: 1, reason: 'rateLimited' }]);
    expect(at(s, 1).context.tokens).toEqual([]);
    expect(at(s, 1)).toMatchObject({ actedThisBattle: false, lastMoveId: null, moveHistory: [] });
    expect(dealt(run(s, 1, 'ship-it', 7, { d2lo: 25 }))).toHaveLength(1);
  });

  it('Hallucinating: hi(d2, 100) < chance swaps in moves[hi(d4, n)] aimed at living combatants (excluding the user)[hi(d3, n)]', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'hallucinating', remaining: 3 });
    // moves: ship-it, token-burst, low-latency, distilled-strike, compact, clear, guardrail; others: 0, 2, 6, 7, 8.
    const events = run(s, 1, 'ship-it', 7, { d2hi: 24, d4hi: 1, d3hi: 1 });
    expect(events[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'token-burst', target: 2 });
    expect(ofType(events, 'Damage').map((e) => e.target)).toEqual([2]);
    expect(at(s, 1).lastMoveId).toBe('token-burst');
    expect(run(s, 1, 'ship-it', 7, { d2hi: 25, d4hi: 1, d3hi: 1 })[0]).toMatchObject({ moveId: 'ship-it', target: 7 });
  });

  it('self-hallucinates at T3 (5%) without the status, and the retarget skips fainted and benched creatures', () => {
    const s = fresh();
    at(s, 1).trainedTemperature = 3;
    at(s, 2).hp = 0;
    at(s, 2).fainted = true; // others: 0, 6, 7, 8
    expect(run(s, 1, 'ship-it', 7, { d2hi: 4, d4hi: 3, d3hi: 6 })[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'distilled-strike', target: 7 });
    expect(run(s, 1, 'ship-it', 7, { d2hi: 5, d4hi: 3 })[0]).toMatchObject({ moveId: 'ship-it' });
  });

  it('Drift: hi(d1, 100) < 5 × stacks picks moves[hi(d4, n)] and keeps the original target when legal', () => {
    const s = fresh();
    at(s, 1).context.drift = 2;
    expect(run(s, 1, 'ship-it', 8, { d1hi: 9, d4hi: 3 })[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'distilled-strike', target: 8 });
    expect(run(s, 1, 'ship-it', 8, { d1hi: 10, d4hi: 3 })[0]).toMatchObject({ moveId: 'ship-it', target: 8 });
  });
});

describe('resolveAction: targets that are gone (Ruling 35)', () => {
  it('re-targets a foe move to the lowest-HP on-field foe (ties → lowest index) when its target fainted', () => {
    const s = fresh();
    at(s, 7).hp = 0;
    at(s, 7).fainted = true;
    at(s, 6).hp = 100;
    at(s, 8).hp = 100;
    expect(run(s, 1, 'ship-it', 7)[0]).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'ship-it', target: 6 });
  });

  it('skips with ActionSkipped { reason: "fainted" } and pays nothing when no foe is left on the field', () => {
    const s = fresh();
    for (const i of [6, 7, 8]) Object.assign(at(s, i), { hp: 0, fainted: true }); // b's bench still stands
    expect(run(s, 1, 'ship-it', 7)).toEqual([{ round: 1, type: 'ActionSkipped', actor: 1, reason: 'fainted' }]);
    expect(at(s, 1).context.tokens).toEqual([]);
  });
});

describe('resolveAction: knockouts', () => {
  it('a KO emits Fainted, clears Prompt Injected; an orchestrator KO also turns its side headless', () => {
    const s = fresh();
    Object.assign(at(s, 6), { hp: 1 });
    at(s, 6).statuses.push({ id: 'promptInjected', remaining: 1, injected: { moveId: 'happy-to-help', target: 7 } });
    const events = run(s, 1, 'ship-it', 6);
    const i = events.findIndex((e) => e.type === 'Damage');
    expect(events.slice(i, i + 3)).toEqual([
      { round: 1, type: 'Damage', actor: 1, target: 6, amount: 1, hpAfter: 0 },
      { round: 1, type: 'Fainted', target: 6 },
      { round: 1, type: 'HeadlessMode', side: 1, active: true },
    ]);
    expect(at(s, 6)).toMatchObject({ hp: 0, fainted: true, statuses: [] });
    expect(s.sides.b.headless).toBe(true);
    expect(ofType(events, 'ObservationGained')).toEqual([]); // a KO'd defender observes nothing
  });
});

describe('resolveAction: dispatcher', () => {
  it('throws EngineInvariantError for an effect kind not implemented yet', () => {
    expect(() => run(fresh(), 1, 'low-latency', 1)).toThrow(EngineInvariantError);
  });
});
