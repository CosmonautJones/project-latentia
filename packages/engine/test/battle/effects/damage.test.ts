import { describe, expect, it } from 'vitest';
import { moveDef } from '../../../src/content/moves.js';
import type { NonPassiveEffect } from '../../../src/content/primitives.js';
import type { BattleEvent } from '../../../src/events/types.js';
import { computeDamage, type DamageMods } from '../../../src/math/damage.js';
import { effectiveStat } from '../../../src/math/stats.js';
import { applyDamage } from '../../../src/battle/effects/damage.js';
import { effectContext } from '../../../src/battle/effects/context.js';
import { resolveAction } from '../../../src/battle/resolve.js';
import type { BattleState, Temperature } from '../../../src/battle/state.js';
import { at, battle, draws, entry, type DrawHalves } from '../helpers.js';

// 0 a-orch sagelet, 1 a-act1 blitzr, 2 a-act2 forkling, 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling.

function fresh(): BattleState {
  const s = battle();
  s.round = 3;
  for (const c of s.creatures) c.hp = c.maxHp = 500;
  return s;
}

function run(s: BattleState, actor: number, moveId: string, target: number, h: DrawHalves = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveAction(s, entry(actor, moveId, target), draws(h), events);
  return events;
}

type DamageEffect = Extract<NonPassiveEffect, { kind: 'damage'; who: 'target' }>;

/** applyDamage alone (no accuracy, no bookkeeping) with `effect` standing in for the move's own. */
function hit(s: BattleState, actor: number, moveId: string, target: number, effect: DamageEffect, h: DrawHalves = {}, temperature: Temperature = 2): BattleEvent[] {
  const move = moveDef(moveId);
  if (move === null) throw new Error(moveId);
  const events: BattleEvent[] = [];
  applyDamage(effectContext(s, actor, target, move, draws(h), temperature, events), effect);
  return events;
}

const dealt = (events: BattleEvent[]) => events.filter((e) => e.type === 'Damage').map((e) => (e as { amount: number }).amount);

function expected(s: BattleState, actor: number, target: number, power: number, mods: DamageMods): number {
  const u = at(s, actor);
  const t = at(s, target);
  return computeDamage({ power, atk: effectiveStat(u.stats.compute, u.stages.compute ?? 0), def: effectiveStat(t.stats.robustness, t.stages.robustness ?? 0), level: u.level, mods });
}

/** Blitzr Ship It on Blitzr: neutral type, native speed, 100% roll at T2. */
const shipIt = (s: BattleState, extra: DamageMods) => expected(s, 1, 7, 65, { type: 10000, native: 12500, roll: 10000, ...extra });

describe('Handoff chain', () => {
  it('counts consecutive allied hits on one target (Ruling 39): none, 11000, 12000, then 13000; an enemy action resets it', () => {
    const s = fresh();
    const chains: BattleEvent[] = [];
    const amounts: number[] = [];
    const hits = [[0, 'happy-to-help'], [1, 'ship-it'], [2, 'hard-fork'], [0, 'happy-to-help'], [1, 'ship-it']] as const;
    for (const [actor, move] of hits) {
      const ev = run(s, actor, move, 8);
      amounts.push(...dealt(ev));
      chains.push(...ev.filter((e) => e.type === 'HandoffChain'));
    }
    expect(chains.map((e) => (e as { chain: number[] }).chain)).toEqual([[0], [0, 1], [0, 1, 2], [0, 1, 2, 0], [0, 1, 2, 0, 1]]);
    const reasoning = { type: 20000, native: 12500, roll: 10000 };
    expect(amounts).toEqual([
      expected(s, 0, 8, 70, reasoning),
      expected(s, 1, 8, 65, { type: 5000, native: 12500, roll: 10000, handoff: 11000 }),
      expected(s, 2, 8, 70, { type: 10000, native: 12500, roll: 10000, handoff: 12000 }),
      expected(s, 0, 8, 70, { ...reasoning, handoff: 13000, observation: 9000 }),
      expected(s, 1, 8, 65, { type: 5000, native: 12500, roll: 10000, handoff: 13000, observation: 9000 }),
    ]);

    run(s, 7, 'ship-it', 1); // an enemy action breaks side a's chains
    expect(s.handoff).toEqual([{ target: 1, side: 'b', actors: [7] }]);
    const after = run(s, 1, 'ship-it', 8);
    expect(after.filter((e) => e.type === 'HandoffChain')).toEqual([{ round: 3, type: 'HandoffChain', actor: 1, chain: [1] }]);
    expect(dealt(after)).toEqual([expected(s, 1, 8, 65, { type: 5000, native: 12500, roll: 10000, observation: 9000 })]);
  });

  it('is not broken by an allied action or a miss, and keys chains by target', () => {
    const s = fresh();
    run(s, 0, 'happy-to-help', 8);
    run(s, 1, 'ship-it', 8, { d3lo: 99 }); // miss: no hit, no break
    run(s, 2, 'hard-fork', 7); // another target
    expect(s.handoff).toEqual([
      { target: 8, side: 'a', actors: [0] },
      { target: 7, side: 'a', actors: [2] },
    ]);
  });
});

describe('Observation', () => {
  it('first sighting gives the defender an Observation token; that move’s later hits on it take 9000', () => {
    const s = fresh();
    const first = run(s, 1, 'ship-it', 7);
    expect(first.filter((e) => e.type === 'ObservationGained')).toEqual([{ round: 3, type: 'ObservationGained', target: 7, observation: 'ship-it' }]);
    expect(at(s, 7).context.tokens.map((t) => t.kind)).toEqual(['observation']);
    s.handoff = [];
    const second = run(s, 1, 'ship-it', 7);
    expect(second.filter((e) => e.type === 'ObservationGained')).toEqual([]);
    expect(dealt(second)).toEqual([shipIt(s, { observation: 9000 })]);
    s.handoff = [];
    expect(dealt(run(s, 1, 'token-burst', 7))).toEqual([expected(s, 1, 7, 40, { type: 10000, native: 12500, roll: 10000 })]);
  });

  it('with no free cell nothing happens, and the sighting is used up', () => {
    const s = fresh();
    const ctx = at(s, 7).context;
    for (let i = 0; i < ctx.window; i++) ctx.tokens.push({ kind: 'junk', seq: i });
    expect(run(s, 1, 'ship-it', 7).filter((e) => e.type === 'ObservationGained' || (e.type === 'ContextAdded' && e.target === 7))).toEqual([]);
    ctx.tokens.pop();
    s.handoff = [];
    const again = run(s, 1, 'ship-it', 7);
    expect(again.filter((e) => e.type === 'ObservationGained')).toEqual([]);
    expect(dealt(again)).toEqual([shipIt(s, {})]);
  });

  it('allies never observe each other (a hallucinated hit on an ally)', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'hallucinating', remaining: 2 });
    const events = run(s, 1, 'ship-it', 7, { d2hi: 0, d4hi: 0, d3hi: 1 }); // others 0, 2, 6, 7, 8 → 2
    expect(events.filter((e) => e.type === 'Damage').map((e) => (e as { target: number }).target)).toEqual([2]);
    expect(events.filter((e) => e.type === 'ObservationGained')).toEqual([]);
    expect(at(s, 2).seenMoves).toEqual([]);
  });
});

describe('status damage modifiers', () => {
  it('Overfit: 11500 against its source, 7000 against others; a hit refreshes the source (Ruling 21)', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'overfit', remaining: 2, source: 7 });
    expect(dealt(hit(s, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))).toEqual([shipIt(s, { overfit: 11500 })]);
    expect(dealt(hit(s, 1, 'ship-it', 6, { kind: 'damage', who: 'target' }))).toEqual([
      expected(s, 1, 6, 65, { type: 20000, native: 12500, roll: 10000, overfit: 7000 }),
    ]);
    expect(at(s, 1).statuses[0]).toMatchObject({ id: 'overfit', source: 6 });
  });

  it('Glazed: 7000 only against its glazer', () => {
    const s = fresh();
    at(s, 1).statuses.push({ id: 'glazed', remaining: 3, source: 7 });
    expect(dealt(hit(s, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))).toEqual([shipIt(s, { glazed: 7000 })]);
    expect(dealt(hit(s, 1, 'ship-it', 8, { kind: 'damage', who: 'target' }))).toEqual([expected(s, 1, 8, 65, { type: 5000, native: 12500, roll: 10000 })]);
  });

  it('Refusal’s powerBp penalty is the step-4 modifier, consumed by the next move even on a miss; incomingDamageBp is consumed by the next hit taken', () => {
    const s = fresh();
    at(s, 1).nextActionMods.push({ kind: 'powerBp', bp: 5000 });
    at(s, 7).nextActionMods.push({ kind: 'incomingDamageBp', bp: 7000 });
    expect(dealt(run(s, 1, 'ship-it', 7))).toEqual([shipIt(s, { refusalOrApology: 3500 })]);
    expect(at(s, 1).nextActionMods).toEqual([]);
    expect(at(s, 7).nextActionMods).toEqual([]);
    at(s, 1).nextActionMods.push({ kind: 'powerBp', bp: 5000 });
    run(s, 1, 'ship-it', 7, { d3lo: 99 });
    expect(at(s, 1).nextActionMods).toEqual([]);
  });
});

describe('effective power (step 1)', () => {
  const gridded = () => {
    const s = fresh();
    // Skill (0,0)-(1,0) holding Chain of Thought with a Tool at (2,0).
    s.sides.a.grid = {
      width: 5,
      height: 4,
      pieces: [
        { id: 'sk', kind: 'skill', shape: [[0, 0], [1, 0]], anchor: [0, 0], rotation: 0, moveId: 'chain-of-thought' },
        { id: 'tl', kind: 'tool', shape: [[0, 0]], anchor: [2, 0], rotation: 0 },
      ],
    };
    return s;
  };
  const cot = (s: BattleState, actor: number) => dealt(hit(s, actor, 'chain-of-thought', 8, moveDef('chain-of-thought')?.effects[0] as DamageEffect));

  it('a Tool step raises an orchestrator Skill’s power by 11000; a compacted Skill deals 50% power (summary)', () => {
    const s = gridded();
    expect(cot(s, 0)).toEqual([expected(s, 0, 8, 66, { type: 20000, native: 12500, roll: 10000 })]);
    at(s, 0).context.summarizedPieces.push('sk');
    expect(cot(s, 0)).toEqual([expected(s, 0, 8, 33, { type: 20000, native: 12500, roll: 10000 })]);
    const sub = gridded();
    at(sub, 2).speciesId = 'sagelet'; // a subagent using the same move gets no grid bonus
    expect(cot(sub, 2)).toEqual([expected(sub, 2, 8, 60, { type: 20000, native: 12500, roll: 10000 })]);
  });

  it('additive bonuses: Chain of Thought +20 per consecutive Reasoning round (cap +60); Long-Term Recall +10 per hit taken (power cap 120)', () => {
    const s = fresh();
    at(s, 0).moveHistory.push({ round: 1, moveId: 'happy-to-help', damaged: [] }, { round: 2, moveId: 'proof-by-contradiction', damaged: [] });
    expect(cot(s, 0)).toEqual([expected(s, 0, 8, 100, { type: 20000, native: 12500, roll: 10000 })]);
    at(s, 0).moveHistory.unshift({ round: 0, moveId: 'happy-to-help', damaged: [] }, { round: -1, moveId: 'chain-of-thought', damaged: [] });
    at(s, 0).moveHistory.sort((x, y) => x.round - y.round);
    expect(cot(s, 0)).toEqual([expected(s, 0, 8, 120, { type: 20000, native: 12500, roll: 10000 })]);
    const gap = fresh();
    at(gap, 0).moveHistory.push({ round: 1, moveId: 'happy-to-help', damaged: [] }); // round 2 missing → streak 0
    expect(cot(gap, 0)).toEqual([expected(gap, 0, 8, 60, { type: 20000, native: 12500, roll: 10000 })]);

    const ltr = (n: number) => {
      const t = fresh();
      for (let r = 0; r < n; r++) at(t, 7).moveHistory.push({ round: r, moveId: 'ship-it', damaged: [1] });
      at(t, 7).moveHistory.push({ round: n, moveId: 'ship-it', damaged: [2] }); // hit someone else
      const effect = moveDef('long-term-recall')?.effects[0] as DamageEffect;
      return { got: dealt(hit(t, 1, 'long-term-recall', 7, effect)), t };
    };
    const three = ltr(3);
    expect(three.got).toEqual([expected(three.t, 1, 7, 70, { type: 10000, roll: 10000 })]);
    const many = ltr(12);
    expect(many.got).toEqual([expected(many.t, 1, 7, 120, { type: 10000, roll: 10000 })]);
  });

  it('flat bonus: Leaderboard Flex +30 when the user’s HP% is above the target’s (cross-multiplied)', () => {
    const s = fresh();
    const flex = () => dealt(run(s, 2, 'leaderboard-flex', 7));
    expect(flex()).toEqual([expected(s, 2, 7, 65, { type: 20000, native: 12500, roll: 10000 })]);
    at(s, 7).hp = 400;
    s.handoff = [];
    const [got] = flex();
    expect(got).toBe(expected(s, 2, 7, 95, { type: 20000, native: 12500, roll: 10000, observation: 9000 }));
  });

  it('conditional multipliers: Proof by Contradiction ×2 if the target buffed or used a status move last round', () => {
    const proof = (last: string | null, round = 2) => {
      const s = fresh();
      if (last !== null) at(s, 8).moveHistory.push({ round, moveId: last, damaged: [] });
      return { got: dealt(run(s, 0, 'proof-by-contradiction', 8)), s };
    };
    const plain = proof(null);
    expect(plain.got).toEqual([expected(plain.s, 0, 8, 70, { type: 20000, native: 12500, roll: 10000 })]);
    for (const last of ['community-patch', 'observer-effect']) {
      const r = proof(last); // a status move; a damage move with a self buff
      expect(r.got).toEqual([expected(r.s, 0, 8, 140, { type: 20000, native: 12500, roll: 10000 })]);
    }
    expect(proof('hard-fork').got).toEqual(plain.got);
    expect(proof('community-patch', 1).got).toEqual(plain.got); // two rounds ago
  });

  it('targetHasStatus multiplier (Citation Needed ×2 against Hallucinating)', () => {
    const s = fresh();
    const effect = moveDef('citation-needed')?.effects[0] as DamageEffect;
    const base = { type: 5000, roll: 10000 };
    expect(dealt(hit(s, 1, 'citation-needed', 7, effect))).toEqual([expected(s, 1, 7, 60, base)]);
    at(s, 7).statuses.push({ id: 'hallucinating', remaining: 2 });
    expect(dealt(hit(s, 1, 'citation-needed', 7, effect))).toEqual([expected(s, 1, 7, 120, base)]);
  });

  it('ignoreUserComputeDrops treats a negative Compute stage as 0 and keeps a positive one', () => {
    const s = fresh();
    const effect = moveDef('retrieval-strike')?.effects[0] as DamageEffect;
    at(s, 1).stages.compute = -2;
    const [dropped] = dealt(hit(s, 1, 'retrieval-strike', 7, effect));
    at(s, 1).stages.compute = 0;
    expect(dropped).toBe(expected(s, 1, 7, 70, { type: 5000, roll: 10000 }));
    at(s, 1).stages.compute = 2;
    const [raised] = dealt(hit(s, 1, 'retrieval-strike', 7, effect));
    expect(raised).toBe(expected(s, 1, 7, 70, { type: 5000, roll: 10000 }));
    expect(raised).toBeGreaterThan(dropped as number);
  });
});

describe('Quantized', () => {
  it('a Quantized attacker uses Compute stage − 1 and a Quantized defender Robustness stage − 1 (floor −3)', () => {
    const s = fresh();
    const plain = dealt(hit(s, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))[0] as number;
    at(s, 1).statuses.push({ id: 'quantized', remaining: 4 });
    const weaker = dealt(hit(s, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))[0] as number;
    at(s, 1).stages.compute = -1;
    expect(weaker).toBe(shipIt(s, {}));
    expect(weaker).toBeLessThan(plain);
    at(s, 1).stages.compute = -3; // already at the floor: stays −3
    const floored = dealt(hit(s, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))[0];
    expect(floored).toBe(shipIt(s, {}));

    const d = fresh();
    at(d, 7).statuses.push({ id: 'quantized', remaining: 4 });
    const softer = dealt(hit(d, 1, 'ship-it', 7, { kind: 'damage', who: 'target' }))[0];
    at(d, 7).stages.robustness = -1;
    expect(softer).toBe(shipIt(d, {}));
  });

  it('every move cost it pays is cost − 1, never below 0', () => {
    const s = fresh();
    at(s, 2).statuses.push({ id: 'quantized', remaining: 4 });
    expect(run(s, 2, 'hard-fork', 7)[1]).toEqual({ round: 3, type: 'ContextAdded', target: 2, kind: 'cost', tokens: 1, tokensAfter: 1 });
    at(s, 1).statuses.push({ id: 'quantized', remaining: 4 });
    expect(run(s, 1, 'ship-it', 7).filter((e) => e.type === 'ContextAdded' && e.target === 1)).toEqual([]);
    expect(at(s, 1).context.tokens).toEqual([]);
  });
});

describe('crit rules and failsIf', () => {
  it('stages add to the temperature base; never blocks; always fires on its condition', () => {
    const s = fresh();
    const peep = run(s, 1, 'pixel-peep', 7, { d4lo: 3 }); // T2 stage 2 + 1 → 4/48
    expect(peep.filter((e) => e.type === 'Crit')).toHaveLength(1);
    expect(run(s, 1, 'distilled-strike', 7, { d4lo: 0 }).filter((e) => e.type === 'Crit')).toEqual([]);
    const always: DamageEffect = { kind: 'damage', who: 'target', crit: { kind: 'always', when: { kind: 'targetWeakToMove' } } };
    expect(hit(s, 0, 'happy-to-help', 8, always).filter((e) => e.type === 'Crit')).toHaveLength(1); // reasoning → open
    expect(hit(s, 0, 'happy-to-help', 7, always).filter((e) => e.type === 'Crit')).toEqual([]); // reasoning → speed
  });

  it('Flash Inference fails (Missed, no effects) when the target already acted this round; context is still paid', () => {
    const s = fresh();
    at(s, 7).moveHistory.push({ round: 3, moveId: 'ship-it', damaged: [] });
    const events = run(s, 1, 'flash-inference', 7);
    expect(events).toEqual([
      { round: 3, type: 'MoveUsed', actor: 1, moveId: 'flash-inference', target: 7 },
      { round: 3, type: 'ContextAdded', target: 1, kind: 'cost', tokens: 3, tokensAfter: 3 },
      { round: 3, type: 'Missed', actor: 1, target: 7 },
      { round: 3, type: 'ContextAdded', target: 7, kind: 'observation', tokens: 1, tokensAfter: 1 },
      { round: 3, type: 'ObservationGained', target: 7, observation: 'flash-inference' },
    ]);
    at(s, 7).moveHistory[0] = { round: 2, moveId: 'ship-it', damaged: [] };
    expect(dealt(run(s, 1, 'flash-inference', 7))).toHaveLength(1);
  });
});

describe('recoil (damage who: self)', () => {
  it('the user takes pct% of the damage this action dealt (floored); nothing when that is 0', () => {
    const s = fresh();
    const move = moveDef('ship-it');
    if (move === null) throw new Error('ship-it');
    const events: BattleEvent[] = [];
    const ctx = effectContext(s, 1, 7, move, draws(), 2, events);
    applyDamage(ctx, { kind: 'damage', who: 'target' });
    const done = ctx.tally.dealt;
    applyDamage(ctx, { kind: 'damage', who: 'self', pctOfDealt: 50 });
    expect(events.at(-1)).toEqual({ round: 3, type: 'Damage', actor: 1, target: 1, amount: Math.floor(done / 2), hpAfter: 500 - Math.floor(done / 2) });
    const none: BattleEvent[] = [];
    applyDamage(effectContext(s, 1, 7, move, draws(), 2, none), { kind: 'damage', who: 'self', pctOfDealt: 10 });
    expect(none).toEqual([]);
  });
});
