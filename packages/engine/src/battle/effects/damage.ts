import type { CritRule, NextActionMod, NonPassiveEffect } from '../../content/primitives.js';
import type { BattleEvent } from '../../events/types.js';
import { critThreshold } from '../../math/accuracy.js';
import { EngineInvariantError, idiv, mulBp } from '../../math/bp.js';
import { computeDamage, effectivePower, type DamageMods } from '../../math/damage.js';
import { effectiveStat } from '../../math/stats.js';
import { toolStepsFor } from '../../grid/adjacency.js';
import { lo } from '../../rng/draws.js';
import { statusDamageMods } from '../../status/apply.js';
import { sideNumber } from '../end.js';
import { handoffBp } from '../handoff.js';
import type { BattleState, CreatureState } from '../state.js';
import { holds, powerBonus, typeBpAgainst, typesOf } from './conditions.js';
import { creature, temperatureRow, type EffectContext } from './context.js';

export type DamageEffect = Extract<NonPassiveEffect, { kind: 'damage'; who: 'target' }>;
export type RecoilEffect = Extract<NonPassiveEffect, { kind: 'damage'; who: 'self' }>;

const NATIVE_BP = 12500;
const T4_SUPER_EFFECTIVE_BP = 12500;
const CRIT_BP = 15000;
const OBSERVATION_BP = 9000;
const MAX_CRIT_STAGE = 6;

/** The options of a damaging effect that shape one hit (multiHit has none of them). */
export type HitShape = Partial<Pick<DamageEffect, 'bonus' | 'mult' | 'crit' | 'ignoreUserComputeDrops'>>;

/** One hit's outcome; a multi-hit move computes it once and lands it on every hit (spec §5 step 7). */
export type Hit = { damage: number; crit: boolean; typeBp: number | null };

/**
 * Tool steps and Compaction Summary for the move (spec §5 Context): only an orchestrator's move that comes
 * from a grid piece. A Skill gets one step per adjacent Tool; a Skill or Graft that was compacted deals 50%.
 */
function pieceBonus(state: BattleState, user: CreatureState, moveId: string): { toolSteps: number; summary: boolean } {
  const grid = state.sides[user.side].grid;
  if (!user.isOrchestrator || grid === null) return { toolSteps: 0, summary: false };
  const piece = grid.pieces.find((p) => (p.kind === 'skill' || p.kind === 'graft') && p.moveId === moveId);
  if (piece === undefined) return { toolSteps: 0, summary: false };
  return { toolSteps: piece.kind === 'skill' ? toolStepsFor(grid, piece.id) : 0, summary: user.context.summarizedPieces.includes(piece.id) };
}

/** Effective power `P` (spec §5 damage step 1): base + additive bonus → conditional multipliers → Tool steps → Summary. */
function power(ctx: EffectContext, user: CreatureState, shape: HitShape): number {
  const base = ctx.move.power;
  if (base === null) throw new EngineInvariantError(`damage from powerless move ${ctx.move.id}`, { round: ctx.round, actor: ctx.actor, seed: ctx.state.seed });
  const conditional = (shape.mult ?? []).filter((m) => m.when === undefined || holds(ctx, m.when)).map((m) => m.bp);
  return effectivePower({ base, additive: powerBonus(ctx, shape.bonus, base), conditional, ...pieceBonus(ctx.state, user, ctx.move.id) });
}

/**
 * Crit (spec §5): the temperature's base stage, +1 for a Reasoning move at T0/T1, plus the move's stages,
 * capped at 6; crit when lo(D4, 48) is below the stage's threshold. `never` and `always` (on its condition) override.
 */
function rollsCrit(ctx: EffectContext, rule: CritRule | undefined): boolean {
  if (rule?.kind === 'never') return false;
  if (rule?.kind === 'always' && holds(ctx, rule.when)) return true;
  const reasoning = ctx.move.type === 'reasoning' && ctx.temperature <= 1 ? 1 : 0;
  const stage = temperatureRow(ctx).baseCritStage + reasoning + (rule?.kind === 'stages' ? rule.stages : 0);
  return lo(ctx.draws.d4, 48) < critThreshold(Math.min(MAX_CRIT_STAGE, stage));
}

/** Roll basis points: rollMinPct×100 + lo(D5, rollMax − rollMin + 1)×100 (T0 has width 1, always 10000). */
export function rollBp(ctx: EffectContext): number {
  const row = temperatureRow(ctx);
  return row.rollMinPct * 100 + lo(ctx.draws.d5, row.rollMaxPct - row.rollMinPct + 1) * 100;
}

/** The step-4 Refusal/Apology modifier: the actor's penalty times the defender's pending incoming-damage modifier. */
function refusalOrApology(penaltyBp: number | null, incomingBp: number | null): number | null {
  if (penaltyBp === null) return incomingBp;
  return incomingBp === null ? penaltyBp : mulBp(penaltyBp, incomingBp);
}

/** Removes the defender's pending `incomingDamageBp` modifiers (Earnest Apology) and returns their product, or null. */
export function takeIncomingBp(defender: CreatureState): number | null {
  let bp: number | null = null;
  const kept: NextActionMod[] = [];
  for (const m of defender.nextActionMods) {
    if (m.kind === 'incomingDamageBp') bp = bp === null ? m.bp : mulBp(bp, m.bp);
    else kept.push(m);
  }
  defender.nextActionMods = kept;
  return bp;
}

/**
 * One hit of the move on `ctx.target` (spec §5 steps 1–5), modifiers in the normative order. A crit
 * ignores the defender's positive Robustness stages; `ignoreUserComputeDrops` ignores negative Compute stages.
 */
export function computeHit(ctx: EffectContext, shape: HitShape, incomingBp: number | null): Hit {
  const user = creature(ctx, ctx.actor);
  const target = creature(ctx, ctx.target);
  const crit = rollsCrit(ctx, shape.crit);
  const atkStage = user.stages.compute ?? 0;
  const defStage = target.stages.robustness ?? 0;
  const typeBp = typeBpAgainst(ctx.move, target);
  const mods: DamageMods = { roll: rollBp(ctx), handoff: handoffBp(ctx.state, user.side, target.index) };
  if (typeBp !== null) mods.type = typeBp;
  if (typeBp !== null && typeBp > 10000 && ctx.temperature === 4) mods.t4se = T4_SUPER_EFFECTIVE_BP;
  if (ctx.move.type !== 'system' && typesOf(user).includes(ctx.move.type)) mods.native = NATIVE_BP;
  if (crit) mods.crit = CRIT_BP;
  Object.assign(mods, statusDamageMods(user, target.index));
  if (target.side !== user.side && target.observedMoves.includes(ctx.move.id)) mods.observation = OBSERVATION_BP;
  const ra = refusalOrApology(ctx.penaltyBp, incomingBp);
  if (ra !== null) mods.refusalOrApology = ra;
  const damage = computeDamage({
    power: power(ctx, user, shape),
    atk: effectiveStat(user.stats.compute, shape.ignoreUserComputeDrops === true ? Math.max(0, atkStage) : atkStage),
    def: effectiveStat(target.stats.robustness, crit ? Math.min(0, defStage) : defStage),
    level: user.level,
    mods,
  });
  return { damage, crit, typeBp };
}

/**
 * A KO: HP is already 0. Emits Fainted; Prompt Injected is cleared (Ruling 19). An orchestrator's side
 * enters Headless Mode (spec §5) and emits HeadlessMode.
 */
function knockOut(state: BattleState, c: CreatureState, round: number, events: BattleEvent[]): void {
  c.fainted = true;
  c.statuses = c.statuses.filter((s) => s.id !== 'promptInjected');
  events.push({ round, type: 'Fainted', target: c.index });
  if (c.isOrchestrator) {
    state.sides[c.side].headless = true;
    events.push({ round, type: 'HeadlessMode', side: sideNumber(c.side), active: true });
  }
}

/** Removes up to `amount` HP from `victim` (never below 0), emits Damage (and Fainted at 0). Returns the HP removed. */
export function dealDamage(ctx: EffectContext, victim: CreatureState, amount: number): number {
  const removed = Math.min(amount, victim.hp);
  victim.hp -= removed;
  ctx.events.push({ round: ctx.round, type: 'Damage', actor: ctx.actor, target: victim.index, amount: removed, hpAfter: victim.hp });
  if (victim.hp === 0) knockOut(ctx.state, victim, ctx.round, ctx.events);
  return removed;
}

/** Crit and TypeEffect (once per move, before its Damage events). */
export function announceHit(ctx: EffectContext, hit: Hit): void {
  if (hit.crit) ctx.events.push({ round: ctx.round, type: 'Crit', actor: ctx.actor, target: ctx.target });
  if (hit.typeBp !== null && hit.typeBp !== 10000) ctx.events.push({ round: ctx.round, type: 'TypeEffect', actor: ctx.actor, target: ctx.target, multiplierBp: hit.typeBp });
}

/** Tallies a landed move on the target and refreshes the attacker's Overfit source to it (Ruling 21). */
export function recordHit(ctx: EffectContext, hit: Hit, removed: number): void {
  const t = ctx.tally;
  t.dealt += removed;
  if (!t.damaged.includes(ctx.target)) t.damaged.push(ctx.target);
  if (hit.typeBp !== null && hit.typeBp > 10000) t.superEffective = true;
  for (const s of creature(ctx, ctx.actor).statuses) if (s.id === 'overfit') s.source = ctx.target;
}

/** `damage` on the target: one hit (nothing if the target is already KO'd). */
function damageTarget(ctx: EffectContext, effect: DamageEffect): void {
  const target = creature(ctx, ctx.target);
  if (target.fainted) return;
  const hit = computeHit(ctx, effect, takeIncomingBp(target));
  announceHit(ctx, hit);
  recordHit(ctx, hit, dealDamage(ctx, target, hit.damage));
}

/** `damage` on the user: recoil of pct% of the HP this action dealt so far (floored; nothing at 0 or if KO'd). */
function recoil(ctx: EffectContext, effect: RecoilEffect): void {
  const user = creature(ctx, ctx.actor);
  const amount = idiv(ctx.tally.dealt * effect.pctOfDealt, 100);
  if (amount > 0 && !user.fainted) dealDamage(ctx, user, amount);
}

export function applyDamage(ctx: EffectContext, effect: DamageEffect | RecoilEffect): void {
  if (effect.who === 'self') recoil(ctx, effect);
  else damageTarget(ctx, effect);
}
