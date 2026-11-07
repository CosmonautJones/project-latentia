import { moveDef } from '../content/moves.js';
import type { MoveDef } from '../content/primitives.js';
import { hallucinationChancePct } from '../content/temperature.js';
import { EngineInvariantError } from '../math/bp.js';
import { hi, type ActionDraws } from '../rng/draws.js';
import { computeDamage, type DamageMods } from '../math/damage.js';
import { effectiveStat } from '../math/stats.js';
import { hasStatus, moveDisabledByStatus, statStage } from '../status/apply.js';
import { typeBpAgainst, typesOf } from './effects/conditions.js';
import { aimsAtUser, legalTarget, lowestHpOnField, onField, type ActionEntry } from './order.js';
import { DEFAULT_TEMPERATURE } from './setup.js';
import type { BattleState, CreatureState, Temperature } from './state.js';

/** Drift adds this many percent of random-move chance per stack (spec §5 D1 hi). */
export const DRIFT_RANDOM_MOVE_PCT_PER_STACK = 5;

/**
 * The notch a creature acts at: an orchestrator uses its side's temperature (the command's, or the
 * Autopilot's); a subagent its trained temperature, or the Default notch (T2) when it has none.
 */
export function temperatureOf(state: BattleState, c: CreatureState): Temperature {
  return c.isOrchestrator ? state.sides[c.side].temperature : (c.trainedTemperature ?? DEFAULT_TEMPERATURE);
}

/**
 * The default selector for a move whose target is no longer legal (Ruling 35): `ally` → the lowest-HP
 * living on-field ally (the user included); every foe kind and `other` → the lowest-HP living on-field
 * foe; HP ties → lowest canonical index. Null when there is none.
 */
export function defaultTarget(state: BattleState, user: CreatureState, def: MoveDef): number | null {
  if (aimsAtUser(def)) return user.index;
  const ally = def.target === 'ally';
  return lowestHpOnField(state, (c) => (ally ? c.side === user.side : c.side !== user.side))?.index ?? null;
}

/**
 * Deterministic damage estimate for `foeMostDamage` (Ruling 43): computeDamage at the move's base power with
 * the current stat stages (after Quantized), type and native modifiers, roll 10000 and no crit. 0 for a
 * powerless move.
 */
function estimate(user: CreatureState, foe: CreatureState, def: MoveDef): number {
  if (def.power === null) return 0;
  const mods: DamageMods = { roll: 10000 };
  const typeBp = typeBpAgainst(def, foe);
  if (typeBp !== null) mods.type = typeBp;
  if (def.type !== 'system' && typesOf(user).includes(def.type)) mods.native = 12500;
  return computeDamage({
    power: def.power,
    atk: effectiveStat(user.stats.compute, statStage(user, 'compute')),
    def: effectiveStat(foe.stats.robustness, statStage(foe, 'robustness')),
    level: user.level,
    mods,
  });
}

function livingFoesOnField(state: BattleState, user: CreatureState): CreatureState[] {
  return state.creatures.filter((c) => c.side !== user.side && !c.fainted && onField(state, c));
}

/** `foeMostDamage`: the living on-field foe with the highest estimate; ties → lowest canonical index. */
function mostDamagedFoe(state: BattleState, user: CreatureState, def: MoveDef): number | null {
  let best: { index: number; dmg: number } | null = null;
  for (const foe of livingFoesOnField(state, user)) {
    const dmg = estimate(user, foe, def);
    if (best === null || dmg > best.dmg) best = { index: foe.index, dmg };
  }
  return best?.index ?? null;
}

/** `foeOffByOne`: the living on-field foe with the next-lower canonical index than `intended`, wrapping to the highest. */
function offByOneFoe(state: BattleState, user: CreatureState, intended: number): number | null {
  const foes = livingFoesOnField(state, user);
  const lower = foes.filter((c) => c.index < intended);
  return (lower.at(-1) ?? foes.at(-1))?.index ?? null;
}

/** The move to use and its target, or null when the move has no legal target left (the action is skipped). */
export type Choice = { move: MoveDef; target: number } | null;

/**
 * Aims `def` given the intended target: self/none → the user; `foeMostDamage` and `foeOffByOne` are
 * engine-picked (Ruling 43); otherwise the intended target if still legal, else the default selector.
 */
function keepOrDefault(state: BattleState, user: CreatureState, def: MoveDef, intended: number): Choice {
  let t: number | null;
  if (aimsAtUser(def)) t = user.index;
  else if (def.target === 'foeMostDamage') t = mostDamagedFoe(state, user, def);
  else if (def.target === 'foeOffByOne') t = offByOneFoe(state, user, intended);
  else t = legalTarget(state, user, def, intended) ? intended : defaultTarget(state, user, def);
  return t === null ? null : { move: def, target: t };
}

function known(state: BattleState, user: CreatureState, id: string | undefined): MoveDef {
  const def = id === undefined ? null : moveDef(id);
  if (def === null) throw new EngineInvariantError(`unknown move ${String(id)}`, { round: state.round, actor: user.index, seed: state.seed });
  return def;
}

/**
 * The D4 hi random-move pick (Ruling 42): mod the creature's whole stored moveset (universals included,
 * in order) minus the moves a held status forbids; the whole moveset if every move is forbidden.
 */
function moveAt(state: BattleState, user: CreatureState, d4: number): MoveDef {
  const all = user.moves.map((id) => known(state, user, id));
  const usable = all.filter((def) => !moveDisabledByStatus(user, def, user.lastMoveId));
  const pool = usable.length > 0 ? usable : all;
  return pool[hi(d4, pool.length)] as MoveDef;
}

/**
 * Hallucination and Drift substitution (spec §5 draw table), after the Rate Limited check:
 * - Hallucination when hi(D2, 100) < hallucinationChancePct(T, Hallucinating held): the move becomes
 *   moves[hi(D4, n)] and the target the living on-field combatants excluding the user (canonical order)
 *   [hi(D3, n)] — allies included, whatever the move's target kind; a self/none move still aims at its user.
 * - Otherwise Drift when hi(D1, 100) < 5 × stacks: moves[hi(D4, n)], keeping the original target if legal
 *   for the new move, else the move's default selector.
 * - Otherwise the entry's move; a target that fainted or left the field is re-picked by the default selector.
 * The hallucination check comes first; when it fires the Drift check is ignored (Ruling 45).
 */
export function chooseAction(state: BattleState, user: CreatureState, entry: ActionEntry, draws: ActionDraws, temperature: Temperature): Choice {
  if (hi(draws.d2, 100) < hallucinationChancePct(temperature, hasStatus(user, 'hallucinating'))) {
    const def = moveAt(state, user, draws.d4);
    if (aimsAtUser(def)) return { move: def, target: user.index };
    const others = state.creatures.filter((c) => c.index !== user.index && !c.fainted && onField(state, c));
    const pick = others.length === 0 ? undefined : others[hi(draws.d3, others.length)];
    return pick === undefined ? keepOrDefault(state, user, def, entry.target) : { move: def, target: pick.index };
  }
  if (hi(draws.d1, 100) < DRIFT_RANDOM_MOVE_PCT_PER_STACK * user.context.drift) {
    return keepOrDefault(state, user, moveAt(state, user, draws.d4), entry.target);
  }
  return keepOrDefault(state, user, known(state, user, entry.moveId), entry.target);
}
