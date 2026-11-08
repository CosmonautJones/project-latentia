import { describe, expect, it } from 'vitest';
import type { BattleEvent } from '../../../src/events/types.js';
import { computeDamage, type DamageMods } from '../../../src/math/damage.js';
import { effectiveStat } from '../../../src/math/stats.js';
import { resolveAction } from '../../../src/battle/resolve.js';
import type { BattleState } from '../../../src/battle/state.js';
import { at, battle, draws, entry, type DrawHalves } from '../helpers.js';

// 1 a-act1 blitzr, 2 a-act2 forkling, 7 b-act1 blitzr. Speculative Decoding: speed, 22 per hit, 2–5 hits
// (Wild 2–6, WildT4 2–7) from hi(d5, span). Swarm of Fine-Tunes: open, 20 per hit, 1 + other open allies.

function fresh(): BattleState {
  const s = battle();
  s.round = 2;
  for (const c of s.creatures) c.hp = c.maxHp = 500;
  return s;
}

function run(s: BattleState, actor: number, moveId: string, target: number, h: DrawHalves = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveAction(s, entry(actor, moveId, target), draws(h), events);
  return events;
}

const damages = (events: BattleEvent[]) => events.filter((e): e is Extract<BattleEvent, { type: 'Damage' }> => e.type === 'Damage');

function expected(s: BattleState, actor: number, target: number, power: number, mods: DamageMods): number {
  const u = at(s, actor);
  const t = at(s, target);
  return computeDamage({ power, atk: effectiveStat(u.stats.compute, u.stages.compute ?? 0), def: effectiveStat(t.stats.robustness, t.stages.robustness ?? 0), level: u.level, mods });
}

describe('multiHit', () => {
  it('hits min + hi(d5, span) times with one shared accuracy, crit and roll', () => {
    const s = fresh();
    const events = run(s, 1, 'speculative-decoding', 7, { d5hi: 2, d5lo: 10, d4lo: 0 });
    const per = expected(s, 1, 7, 22, { type: 10000, native: 12500, crit: 15000, roll: 9500 });
    expect(events.filter((e) => e.type === 'Crit')).toHaveLength(1);
    expect(damages(events).map((e) => [e.amount, e.hpAfter])).toEqual([1, 2, 3, 4].map((k) => [per, 500 - k * per]));
    expect(at(s, 1).moveHistory).toEqual([{ round: 2, moveId: 'speculative-decoding', target: 7, damaged: [7] }]);
  });

  it('hi(d5, span) wraps the span: 2–5 has span 4', () => {
    const s = fresh();
    expect(damages(run(s, 1, 'speculative-decoding', 7, { d5hi: 4 }))).toHaveLength(2);
    expect(damages(run(s, 1, 'speculative-decoding', 7, { d5hi: 3 }))).toHaveLength(5);
  });

  it('uses the Wild hit range at T3 and the WildT4 range at T4', () => {
    const t3 = fresh();
    at(t3, 1).trainedTemperature = 3;
    expect(damages(run(t3, 1, 'speculative-decoding', 7, { d5hi: 4 }))).toHaveLength(6);
    const t4 = fresh();
    at(t4, 1).trainedTemperature = 4;
    expect(damages(run(t4, 1, 'speculative-decoding', 7, { d5hi: 5 }))).toHaveLength(7);
  });

  it('counts once for the Handoff chain: the next allied hit is the second (11500)', () => {
    const s = fresh();
    const multi = run(s, 1, 'speculative-decoding', 7, { d5hi: 3 });
    expect(multi.filter((e) => e.type === 'HandoffChain')).toEqual([{ round: 2, type: 'HandoffChain', actor: 1, chain: [1] }]);
    const next = run(s, 2, 'hard-fork', 7);
    expect(damages(next).map((e) => e.amount)).toEqual([expected(s, 2, 7, 70, { type: 20000, native: 12500, roll: 10000, handoff: 11500 })]);
  });

  it('stops when the target faints and emits Fainted once', () => {
    const s = fresh();
    at(s, 7).hp = 1;
    const events = run(s, 1, 'speculative-decoding', 7, { d5hi: 3 });
    expect(damages(events)).toEqual([{ round: 2, type: 'Damage', actor: 1, target: 7, amount: 1, hpAfter: 0 }]);
    expect(events.filter((e) => e.type === 'Fainted')).toEqual([{ round: 2, type: 'Fainted', target: 7 }]);
  });

  it('perAllyOfType: base + other living on-field allies of the type', () => {
    const s = fresh();
    expect(damages(run(s, 2, 'swarm-of-fine-tunes', 7))).toHaveLength(1);
    at(s, 1).speciesId = 'forkling';
    at(s, 0).speciesId = 'forkling';
    expect(damages(run(s, 2, 'swarm-of-fine-tunes', 7))).toHaveLength(3);
    Object.assign(at(s, 1), { hp: 0, fainted: true });
    at(s, 3).speciesId = 'forkling'; // bench: not on the field
    expect(damages(run(s, 2, 'swarm-of-fine-tunes', 7))).toHaveLength(2);
  });
});
