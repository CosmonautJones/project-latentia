import type { BattleView, FieldKind, PendingCost, ViewCreature } from '../cards/model.js';
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
  const fields: FieldKind[] = state.fields.filter((f) => f.target === c.index).map((f) => f.effect.kind);
  return {
    index: c.index,
    isOrchestrator: c.isOrchestrator,
    hp: c.hp,
    maxHp: c.maxHp,
    types: [...typesOf(c)],
    statuses: [...c.statuses.map((s) => s.id), ...(c.context.drift > 0 ? (['drift'] as const) : [])],
    stages,
    compute: effectiveStat(c.stats.compute, statStage(c, 'compute')),
    lastMove: c.moveHistory.at(-1)?.moveId ?? null,
    telegraphing: c.charging !== null && telegraphed(moveDef(c.charging.moveId)),
    contextUsed: c.context.tokens.length,
    contextWindow: c.context.window,
    junk: c.context.tokens.filter((t) => t.kind === 'junk').length,
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
 * The view of `actor` for planning `round` — `state.round` once round start has run, `state.round + 1` for a
 * preview before it (Ruling 82). `roundStart` is the actor's R1/R2 for that round, passed explicitly so that
 * intents can be previewed before submitRound draws them (Ruling 79: peeked from a cloned rng); null when none
 * are available. `orchestratorTarget` is the target of the allied orchestrator's most recent resolved move, only
 * while that target is a living on-field foe (Ruling 83).
 */
export function viewFor(state: BattleState, actor: number, roundStart: RoundStartDraws | null, round: number): BattleView {
  const self = state.creatures[actor];
  if (self === undefined) throw new EngineInvariantError(`viewFor: no creature ${actor}`, { round: state.round, actor, seed: state.seed });
  const orch = state.creatures.find((c) => c.side === self.side && c.isOrchestrator && !c.fainted);
  const aimed = orch?.moveHistory.at(-1)?.target;
  const aimedAt = aimed === undefined ? undefined : state.creatures[aimed];
  return {
    round,
    roundStart: roundStart === null ? null : { r1: roundStart.r1, r2: roundStart.r2 },
    self: project(state, self),
    orchestrator: orch === undefined ? null : project(state, orch),
    allies: state.creatures.filter((c) => c.side === self.side && c.index !== actor && livingOnField(state, c)).map((c) => project(state, c)),
    foes: state.creatures.filter((c) => c.side !== self.side && livingOnField(state, c)).map((c) => project(state, c)),
    orchestratorTarget: aimedAt !== undefined && aimedAt.side !== self.side && livingOnField(state, aimedAt) ? aimedAt.index : null,
    selfLastUsed: lastUsed(self),
    lastMoveId: self.lastMoveId,
    pendingCost: pendingCost(self),
  };
}
