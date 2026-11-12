import { moveDef } from '../content/moves.js';
import type { NonPassiveEffect } from '../content/primitives.js';
import { TEMPERATURE } from '../content/temperature.js';
import type { ActionDraws } from '../rng/draws.js';
import { effectList } from './effects/apply.js';
import { chargesFirst } from './effects/charge.js';
import { effectContext } from './effects/context.js';
import { computeHit, takeIncomingBp, type HitShape } from './effects/damage.js';
import { takePenaltyBp } from './effects/nextActionModifier.js';
import type { Intent } from './plan.js';
import type { BattleState } from './state.js';
import { temperatureOf } from './targeting.js';

// previewDamage (engine 0.4.2, a read-only helper for the game's foe telegraph; plan v0.1 Q2): the range of HP an
// intent's move would take from its target, read from the state before the round. Pure: it works on a clone and
// draws nothing from the battle's rng.

/** The HP a move would remove: the lowest and highest damage roll (and hit count), capped at the target's HP. */
export interface DamagePreview {
  readonly min: number;
  readonly max: number;
}

/** Low 16 bits pick the roll (lo D5), high 16 bits the multi-hit count (hi D5): both at their lowest or highest. */
function d5(rollWidth: number, hitSpan: number, high: boolean): number {
  return high ? (((hitSpan - 1) << 16) | (rollWidth - 1)) >>> 0 : 0;
}

/** A crit is rolled as lo(D4, 48) < threshold: 47 is the highest value, so only a guaranteed crit still crits. */
const NO_CRIT_D4 = 47;

type Hitter = { shape: HitShape; hits: (high: boolean) => number; hitSpan: number; mayMiss: boolean };

/** Each effect of the list that deals move damage to the target: its hit shape and its hit count at either end. */
function hitters(effects: readonly NonPassiveEffect[], allies: number): Hitter[] {
  const out: Hitter[] = [];
  for (const e of effects) {
    const mayMiss = e.chance !== undefined;
    if (e.kind === 'damage' && e.who === 'target') out.push({ shape: e, hits: () => 1, hitSpan: 1, mayMiss });
    if (e.kind === 'multiHit') {
      const c = e.count;
      if (c.kind === 'range') out.push({ shape: {}, hits: (high) => (high ? c.max : c.min), hitSpan: c.max - c.min + 1, mayMiss });
      else out.push({ shape: {}, hits: () => c.base + allies, hitSpan: 1, mayMiss });
    }
  }
  return out;
}

/**
 * The damage `intent`'s move would deal to its target if it hits and does not crit, from `state` as it stands before
 * the round: its lowest and highest damage roll at the actor's temperature (and, for a multi-hit move, its fewest and
 * most hits), with every modifier the state already holds (types, stages, statuses, Observation, a pending Earnest
 * Apology or Refusal penalty, grid Tool steps); a Handoff chain the user's side holds counts toward the high end only,
 * since an enemy acting first breaks it. What the round itself may change first (a guard raised this round,
 * stages or statuses from an earlier action, a shield, a re-planned card) is not foreseen. Null when the move deals no
 * damage to its target this round: a status move, a move aimed at its user, a charge round, or a missing creature.
 * Pure: `state` is not modified and no rng draw is taken.
 */
export function previewDamage(state: BattleState, intent: Intent): DamagePreview | null {
  const move = moveDef(intent.moveId);
  const user0 = state.creatures[intent.actor];
  const target0 = state.creatures[intent.target];
  if (move === null || move.power === null || user0 === undefined || target0 === undefined) return null;
  if (intent.target === intent.actor || target0.fainted) return null;
  const temperature = temperatureOf(state, user0);
  const listed = effectList(move, temperature);
  // A charging user waits until its count reaches 0, then releases the charged move (resolve.ts planAction).
  if (user0.charging !== null && user0.charging.remaining > 1) return null;
  const release = user0.charging !== null && user0.charging.moveId === move.id;
  if (!release && chargesFirst(listed)) return null;
  const clone = structuredClone(state);
  // The action resolves in the coming round: round-relative rules (consecutive-round bonuses, guards, last round's
  // moves) read it as round + 1, as getIntents plans it.
  clone.round = state.round + 1;
  const user = clone.creatures[intent.actor];
  const target = clone.creatures[intent.target];
  if (user === undefined || target === undefined) return null;
  const allies = clone.creatures.filter((c) => c.side === user.side && c.index !== user.index && !c.fainted).length;
  const list = hitters(listed, allies);
  if (list.length === 0) return null;
  const penalty = takePenaltyBp(user);
  const incoming = takeIncomingBp(target);
  const row = TEMPERATURE[temperature];
  const width = row === undefined ? 1 : row.rollMaxPct - row.rollMinPct + 1;
  // The user's side's Handoff chains carry over until an enemy acts (handoff.ts): whether one acts first this round is
  // the round's business, so the low end assumes a break and the high end that the chain holds.
  const kept = clone.handoff;
  const broken = kept.filter((h) => h.side !== user.side);
  const at = (high: boolean): number => {
    clone.handoff = high ? kept : broken;
    let total = 0;
    for (const h of list) {
      if (!high && h.mayMiss) continue;
      const draws: ActionDraws = { d1: 0, d2: 0, d3: 0, d4: NO_CRIT_D4, d5: d5(width, h.hitSpan, high), d6: 0 };
      const ctx = effectContext(clone, user.index, target.index, move, draws, temperature, [], penalty);
      if (release && user0.charging !== null) ctx.powerAdd = user0.charging.powerDelta;
      total += computeHit(ctx, h.shape, incoming).damage * h.hits(high);
    }
    return Math.min(total, target.hp);
  };
  const shielded = target.shields.some((s) => s.against === 'hit' && s.count > 0);
  return { min: shielded ? 0 : at(false), max: at(true) };
}
