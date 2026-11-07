import type { Chance, DrawSlot, MoveDef, Who } from '../../content/primitives.js';
import { TEMPERATURE, type TemperatureRow } from '../../content/temperature.js';
import type { BattleEvent } from '../../events/types.js';
import { EngineInvariantError } from '../../math/bp.js';
import { hi, lo, type ActionDraws } from '../../rng/draws.js';
import { onField } from '../order.js';
import type { BattleState, CreatureState, Temperature } from '../state.js';

/** What the action has done so far; the resolver's bookkeeping reads it after the effect list. */
export type ActionTally = {
  /** HP this action removed with `damage`/`multiHit` aimed at a target (recoil reads it). */
  dealt: number;
  /** Canonical indices this action damaged, in first-hit order (a multi-hit target appears once). */
  damaged: number[];
  /** A landed hit had a type multiplier above 10000 (Efficient Answer). */
  superEffective: boolean;
  /** Set by an effect that ends the move early (a failed guard): the rest of the effect list is skipped. */
  halted: boolean;
};

/**
 * Everything an effect handler needs for one action (spec §5 step 4). `target` is the final target
 * after hallucination, Drift and re-targeting; `temperature` is the actor's notch for this action.
 * `penaltyBp` is the product of the actor's consumed `powerBp` next-action modifiers (Refusal, Ruling 14),
 * applied as the step-4 Refusal/Apology modifier; null when none. `guardBp` is the target's step-4 Guard
 * modifier against this move (Guardrail, or Captcha Wall vs a non-Speed attack), null when none.
 * `powerAdd` is added to the move's power in damage step 1 (a charge released after a hit: −30).
 * `injection` is the command's Prompt Injected choice for the victim (players), null when none.
 */
export type EffectContext = {
  state: BattleState;
  actor: number;
  target: number;
  draws: ActionDraws;
  move: MoveDef;
  temperature: Temperature;
  events: BattleEvent[];
  round: number;
  penaltyBp: number | null;
  guardBp: number | null;
  powerAdd: number;
  injection: { moveId: string; target: number } | null;
  tally: ActionTally;
};

export function effectContext(
  state: BattleState,
  actor: number,
  target: number,
  move: MoveDef,
  draws: ActionDraws,
  temperature: Temperature,
  events: BattleEvent[],
  penaltyBp: number | null = null,
): EffectContext {
  return {
    state, actor, target, draws, move, temperature, events, round: state.round, penaltyBp,
    guardBp: null, powerAdd: 0, injection: null,
    tally: { dealt: 0, damaged: [], superEffective: false, halted: false },
  };
}

/** The creature at a canonical index; a missing one is an engine bug. */
export function creature(ctx: Pick<EffectContext, 'state' | 'round'>, index: number): CreatureState {
  const c = ctx.state.creatures[index];
  if (c === undefined) throw new EngineInvariantError(`no creature ${index}`, { round: ctx.round, actor: index, seed: ctx.state.seed });
  return c;
}

/** The temperature table row of the action's notch. */
export function temperatureRow(ctx: EffectContext): TemperatureRow {
  const row = TEMPERATURE[ctx.temperature];
  if (row === undefined) throw new EngineInvariantError(`temperature ${String(ctx.temperature)}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
  return row;
}

/** A slot's value as a percent roll (mod 100): `dNlo`/`dNhi` from this action's draws, `r2hi` from the actor's round start. */
function slotPercent(ctx: EffectContext, slot: DrawSlot): number {
  if (slot === 'r2hi') {
    const rs = creature(ctx, ctx.actor).roundStart;
    if (rs === null) throw new EngineInvariantError('r2hi read before round-start draws', { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
    return hi(rs.r2, 100);
  }
  const d = ctx.draws[slot.slice(0, 2) as keyof ActionDraws];
  return slot.endsWith('lo') ? lo(d, 100) : hi(d, 100);
}

/** An effect's optional chance gate: passes when the named slot's value mod 100 is below `pct` (spec §5 draw table). */
export function chancePasses(ctx: EffectContext, chance: Chance | undefined): boolean {
  return chance === undefined || slotPercent(ctx, chance.slot) < chance.pct;
}

/**
 * The living creatures an effect lands on (primitives `Who`), in canonical order: `target` the move's
 * target, `self` the actor, `allAllies` every on-field creature of the actor's side (itself included),
 * `allFoes` every on-field foe, `everyone` every on-field creature.
 */
export function recipients(ctx: EffectContext, who: Who): CreatureState[] {
  const user = creature(ctx, ctx.actor);
  let list: CreatureState[];
  if (who === 'target') list = [creature(ctx, ctx.target)];
  else if (who === 'self') list = [user];
  else {
    list = ctx.state.creatures.filter((c) => onField(ctx.state, c) && (who === 'everyone' || (who === 'allAllies') === (c.side === user.side)));
  }
  return list.filter((c) => !c.fainted);
}
