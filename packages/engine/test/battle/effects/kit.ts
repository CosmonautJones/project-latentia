import type { BattleEvent } from '../../../src/events/types.js';
import { computeDamage, type DamageMods } from '../../../src/math/damage.js';
import { effectiveStat } from '../../../src/math/stats.js';
import type { ActionEntry } from '../../../src/battle/order.js';
import { resolveAction } from '../../../src/battle/resolve.js';
import type { BattleState } from '../../../src/battle/state.js';
import { at, battle, draws, entry, type DrawHalves } from '../helpers.js';

// Shared by the A12b effect tests. Canonical indices (helpers.battle): 0 a-orch sagelet, 1 a-act1 blitzr,
// 2 a-act2 forkling, 3-5 a bench, 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling, 9-11 b bench.

/** The default battle in round 1 with every creature at 500/500 HP, so nothing faints unless a test wants it. */
export function fresh(): BattleState {
  const s = battle();
  s.round = 1;
  for (const c of s.creatures) c.hp = c.maxHp = 500;
  return s;
}

/** Resolves one move entry directly (no submitRound); `extra` adds fields to the entry (e.g. `injection`). */
export function run(s: BattleState, actor: number, moveId: string, target: number, h: DrawHalves = {}, extra: Partial<ActionEntry> = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  resolveAction(s, { ...entry(actor, moveId, target), ...extra }, draws(h), events);
  return events;
}

export const ofType = <T extends BattleEvent['type']>(events: BattleEvent[], type: T) =>
  events.filter((e): e is Extract<BattleEvent, { type: T }> => e.type === type);

export const dealt = (events: BattleEvent[]) => ofType(events, 'Damage').map((e) => e.amount);

/** Damage the pipeline should deal with these modifiers, from the creatures' current stats and stages. */
export function expected(s: BattleState, actor: number, target: number, power: number, mods: DamageMods): number {
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
