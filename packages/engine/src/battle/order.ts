import type { CardSkip } from '../cards/evaluate.js';
import { moveDef } from '../content/moves.js';
import type { MoveDef } from '../content/primitives.js';
import { EngineInvariantError } from '../math/bp.js';
import { moveDisabledByStatus } from '../status/apply.js';
import type { OrchestratorAction } from './log.js';
import type { BattleState, CreatureState, SideId } from './state.js';

export type LeverAction = Exclude<OrchestratorAction, { kind: 'move' }>;

/**
 * One creature's action for the round (spec §5 "Round structure", Sort). Entries belong to creatures,
 * not slots. `latency` is effective Latency (stat with its stage); `tieBreak` is the creature's R1 low
 * 16 bits. A self or none move's `target` is the actor. A deck-driven entry (plan.ts) carries the fired
 * `cardId` and the cards `skipped` above it at plan time, which resolution re-validates (spec §5 "Re-planning").
 * `injection` is a move command's Deepfake Call choice. `lever` is the whole command on an orchestrator entry
 * whose command is not a move: its `moveId` is then the lever name (`directive`, `policy-update`, `swap`, `none`),
 * never resolved as a move.
 */
export type ActionEntry = {
  actor: number;
  priority: number;
  latency: number;
  tieBreak: number;
  moveId: string;
  target: number;
  cardId?: string;
  skipped?: CardSkip[];
  /** Set (true) only on an orchestrator entry planned from its side's Autopilot deck (plan.ts orchestratorEntry; Ruling 96 lists it). */
  autopilot?: true;
  /** Set on the copy resolution acts on when re-planning changed the intent (spec §5 "Re-planning"). */
  replanned?: boolean;
  injection?: { moveId: string; target: number };
  lever?: LeverAction;
};

/** Priority desc, effective latency desc, tie-break desc, canonical index asc. */
function compare(x: ActionEntry, y: ActionEntry): number {
  return y.priority - x.priority || y.latency - x.latency || y.tieBreak - x.tieBreak || x.actor - y.actor;
}

/** A stable, total sort into resolution order (a new array). Two entries for one creature is an engine bug. */
export function sortActions(entries: readonly ActionEntry[]): ActionEntry[] {
  const seen = new Set<number>();
  for (const e of entries) {
    if (seen.has(e.actor)) throw new EngineInvariantError(`creature ${e.actor} has two action entries; turn order is not total`, { actor: e.actor });
    seen.add(e.actor);
  }
  return [...entries].sort(compare);
}

/** A slot is removed for the rest of the battle iff its piece is in the orchestrator's `context.removedSlots`. */
export function slotRemoved(state: BattleState, side: SideId, pieceId: string | null): boolean {
  if (pieceId === null) return false;
  return state.creatures.some((o) => o.side === side && o.isOrchestrator && o.context.removedSlots.includes(pieceId));
}

/** True when the creature holds an active slot that has not been removed. */
export function holdsLiveSlot(state: BattleState, c: CreatureState): boolean {
  if (c.slot !== 'active' || c.activeSlot === null) return false;
  return !slotRemoved(state, c.side, state.sides[c.side].slots[c.activeSlot]?.pieceId ?? null);
}

/** On the field: an orchestrator, or the occupant of a non-removed slot. Bench creatures are off it. */
export function onField(state: BattleState, c: CreatureState): boolean {
  return c.isOrchestrator || holdsLiveSlot(state, c);
}

/** A side is headless once its orchestrator is KO'd (spec §5): its command is ignored. */
export function isHeadless(state: BattleState, side: SideId): boolean {
  return state.sides[side].headless || state.creatures.some((c) => c.side === side && c.isOrchestrator && c.fainted);
}

/** Self and none moves always aim at their user, whatever target was submitted. */
export function aimsAtUser(def: MoveDef | null): boolean {
  return def !== null && (def.target === 'self' || def.target === 'none');
}

/**
 * Whether `target` is legal for `user`'s move (Ruling on illegalTarget): self/none moves accept anything;
 * otherwise the target is a living on-field creature that is a foe (foe kinds), an ally or the user
 * (`ally`), or anyone but the user (`other`).
 */
export function legalTarget(state: BattleState, user: CreatureState, def: MoveDef, target: number): boolean {
  if (aimsAtUser(def)) return true;
  const t = Number.isSafeInteger(target) ? state.creatures[target] : undefined;
  if (t === undefined || t.fainted || !onField(state, t)) return false;
  switch (def.target) {
    case 'ally':
      return t.side === user.side;
    case 'other':
      return t.index !== user.index;
    default:
      return t.side !== user.side;
  }
}

/** Lowest HP first, then lowest canonical index, among living on-field creatures that pass `keep`. */
export function lowestHpOnField(state: BattleState, keep: (c: CreatureState) => boolean): CreatureState | undefined {
  let best: CreatureState | undefined;
  for (const c of state.creatures) if (keep(c) && !c.fainted && onField(state, c) && (best === undefined || c.hp < best.hp)) best = c;
  return best;
}

/**
 * Where a creature's default aims `moveId` (Ruling 38): self/none → the actor; `ally` → the lowest-HP on-field
 * ally, possibly itself; foe kinds and `other` → the lowest-HP on-field foe, or the foe orchestrator when no foe
 * on the field is alive. HP ties go to the lowest canonical index.
 */
export function intentTarget(state: BattleState, c: CreatureState, moveId: string): number {
  const def = moveDef(moveId);
  if (def === null || aimsAtUser(def)) return c.index;
  if (def.target === 'ally') return (lowestHpOnField(state, (f) => f.side === c.side) ?? c).index;
  const target = lowestHpOnField(state, (f) => f.side !== c.side) ?? state.creatures.find((f) => f.side !== c.side && f.isOrchestrator);
  if (target === undefined) throw new EngineInvariantError('the foe side has no orchestrator', { round: state.round, actor: c.index, seed: state.seed });
  return target.index;
}

/**
 * The intent of a creature with no command and no deck (a subagent with a deck, or an orchestrator its side's
 * Autopilot drives, evaluates it: plan.ts): the first move in its list that is neither universal nor
 * orchestrator-only nor disabled by a held status (Glazed / Overfit, Ruling 50); failing that its first move a
 * status allows; failing that its first move. Its target is intentTarget's.
 */
export function defaultIntent(state: BattleState, actor: number): { moveId: string; target: number } {
  const c = state.creatures[actor];
  if (c === undefined) throw new EngineInvariantError(`no creature ${actor}`, { round: state.round, actor, seed: state.seed });
  const allowed = c.moves.filter((m) => {
    const def = moveDef(m);
    return def !== null && !moveDisabledByStatus(c, def, c.lastMoveId);
  });
  const usable = allowed.find((m) => {
    const def = moveDef(m);
    return def !== null && def.universal !== true && def.orchestratorOnly !== true;
  });
  const moveId = usable ?? allowed[0] ?? c.moves[0] ?? 'compact';
  return { moveId, target: intentTarget(state, c, moveId) };
}
