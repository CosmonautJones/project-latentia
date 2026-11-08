import type { BattleView, FieldKind, PendingCost, ViewCreature } from '../cards/model.js';
import type { StatusId } from '../content/ids.js';
import { moveDef } from '../content/moves.js';
import type { MoveDef, StageStat } from '../content/primitives.js';
import { EngineInvariantError } from '../math/bp.js';
import { effectiveStat } from '../math/stats.js';
import type { RoundStartDraws } from '../rng/draws.js';
import { statStage } from '../status/apply.js';
import { typesOf } from './effects/conditions.js';
import { STAGE_STATS } from './effects/stage.js';
import { onField } from './order.js';
import type { BattleState, CreatureState } from './state.js';

// viewFor (spec §5 "Cards"): the read-only, plain-data projection of a battle that one creature's cards are
// evaluated against. It shares no objects with the state.

/** Whether the move's charge (in any of its effect lists) is telegraphed. */
function telegraphed(def: MoveDef | null): boolean {
  if (def === null) return false;
  return [def.effects, def.wild ?? [], def.wildT4 ?? []].some((list) => list.some((e) => e.kind === 'charge' && e.telegraphed));
}

function project(state: BattleState, c: CreatureState): ViewCreature {
  const stages = {} as Record<StageStat, number>;
  for (const s of STAGE_STATS) stages[s] = c.stages[s] ?? 0;
  const fields: FieldKind[] = [];
  for (const f of state.fields) if (f.target === c.index) fields.push(f.effect.kind);
  const statuses: StatusId[] = [];
  for (const h of c.statuses) statuses.push(h.id);
  if (c.context.drift > 0) statuses.push('drift');
  return {
    index: c.index,
    isOrchestrator: c.isOrchestrator,
    hp: c.hp,
    maxHp: c.maxHp,
    types: [...typesOf(c)],
    statuses,
    stages,
    compute: effectiveStat(c.stats.compute, statStage(c, 'compute')),
    lastMove: c.moveHistory.at(-1)?.moveId ?? null,
    telegraphing: c.charging !== null && telegraphed(moveDef(c.charging.moveId)),
    contextUsed: c.context.tokens.length,
    contextWindow: c.context.window,
    fields,
  };
}

const livingOnField = (state: BattleState, c: CreatureState): boolean => !c.fainted && onField(state, c);

/** The last round each move was resolved, one entry per move in first-use order. */
function lastUsed(c: CreatureState): { moveId: string; round: number }[] {
  const out: { moveId: string; round: number }[] = [];
  for (const r of c.moveHistory) {
    const seen = out.find((u) => u.moveId === r.moveId);
    if (seen === undefined) out.push({ moveId: r.moveId, round: r.round });
    else seen.round = r.round;
  }
  return out;
}

/** The actor's pending costSet / costAdd modifiers, copied, oldest first. */
function pendingCost(c: CreatureState): PendingCost[] {
  const out: PendingCost[] = [];
  for (const m of c.nextActionMods) if (m.kind === 'costSet' || m.kind === 'costAdd') out.push({ kind: m.kind, cells: m.cells });
  return out;
}

/**
 * Projections already built from the current state, by canonical index, so a caller that builds several views without
 * changing the state in between (plan.ts planEntries plans every entry from one state) projects each creature once. The
 * views then share ViewCreature objects with each other — never with the state — which is safe: views are read-only.
 */
export type Projections = Map<number, ViewCreature>;

/** The creature's projection from `projections`, projecting (and storing) it on first use. */
function projected(state: BattleState, c: CreatureState, projections: Projections): ViewCreature {
  let p = projections.get(c.index);
  if (p === undefined) {
    p = project(state, c);
    projections.set(c.index, p);
  }
  return p;
}

/**
 * The view of `actor` for planning `round` — `state.round` once round start has run, `state.round + 1` for a
 * preview before it (Ruling 82). `roundStart` is the actor's R1/R2 for that round, passed explicitly so that
 * intents can be previewed before submitRound draws them (Ruling 79: peeked from a cloned rng); null when none
 * are available. `orchestratorTarget` is the target of the allied orchestrator's most recent resolved move, only
 * while that target is a living on-field foe (Ruling 83). `projections` (optional) must have been filled from this
 * same state; each creature is projected once per view either way.
 */
export function viewFor(state: BattleState, actor: number, roundStart: RoundStartDraws | null, round: number, projections: Projections = new Map()): BattleView {
  const self = state.creatures[actor];
  if (self === undefined) throw new EngineInvariantError(`viewFor: no creature ${actor}`, { round: state.round, actor, seed: state.seed });
  const orch = state.creatures.find((c) => c.side === self.side && c.isOrchestrator && !c.fainted);
  const aimed = orch?.moveHistory.at(-1)?.target;
  const aimedAt = aimed === undefined ? undefined : state.creatures[aimed];
  const allies: ViewCreature[] = [];
  const foes: ViewCreature[] = [];
  for (const c of state.creatures) {
    if (c.index === actor || !livingOnField(state, c)) continue;
    (c.side === self.side ? allies : foes).push(projected(state, c, projections));
  }
  return {
    round,
    roundStart: roundStart === null ? null : { r1: roundStart.r1, r2: roundStart.r2 },
    self: projected(state, self, projections),
    orchestrator: orch === undefined ? null : projected(state, orch, projections),
    allies,
    foes,
    orchestratorTarget: aimedAt !== undefined && aimedAt.side !== self.side && livingOnField(state, aimedAt) ? aimedAt.index : null,
    selfLastUsed: lastUsed(self),
    lastMoveId: self.lastMoveId,
    pendingCost: pendingCost(self),
  };
}
