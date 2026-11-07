import { moveDef } from '../content/moves.js';
import type { MoveDef } from '../content/primitives.js';
import { EngineInvariantError } from '../math/bp.js';
import { effectiveStat } from '../math/stats.js';
import { statStage } from '../status/apply.js';
import type { OrchestratorAction, RoundCommand } from './log.js';
import type { BattleState, CreatureState, SideId } from './state.js';

/** Swap and Early Exit resolve at this priority bracket (spec §5 "Orchestrator levers"). */
export const SWAP_PRIORITY = 3;

export type LeverAction = Exclude<OrchestratorAction, { kind: 'move' }>;

/**
 * One creature's action for the round (spec §5 "Round structure", Sort). Entries belong to creatures,
 * not slots. `latency` is effective Latency (stat with its stage); `tieBreak` is the creature's R1 low
 * 16 bits. A self or none move's `target` is the actor. `injection` is a move command's Deepfake Call
 * choice. `lever` is the whole command on an orchestrator entry whose command is not a move: its
 * `moveId` is then the lever name (`directive`, `policy-update`, `swap`, `none`), never resolved as a move.
 */
export type ActionEntry = {
  actor: number;
  priority: number;
  latency: number;
  tieBreak: number;
  moveId: string;
  target: number;
  cardId?: string;
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
 * The intent of a creature with no command and no deck (decks replace this in B2, Autopilot in B4): the
 * first move in its list that is neither universal nor orchestrator-only (its first move if none is).
 * Its target follows the move's target kind (Ruling 38): self/none → the actor; `ally` → the lowest-HP
 * on-field ally, possibly itself; foe kinds and `other` → the lowest-HP on-field foe, or the foe
 * orchestrator when no foe on the field is alive. HP ties go to the lowest canonical index.
 */
export function defaultIntent(state: BattleState, actor: number): { moveId: string; target: number } {
  const c = state.creatures[actor];
  if (c === undefined) throw new EngineInvariantError(`no creature ${actor}`, { round: state.round, actor, seed: state.seed });
  const usable = c.moves.find((m) => {
    const def = moveDef(m);
    return def !== null && def.universal !== true && def.orchestratorOnly !== true;
  });
  const moveId = usable ?? c.moves[0] ?? 'compact';
  const def = moveDef(moveId);
  if (def === null || aimsAtUser(def)) return { moveId, target: actor };
  if (def.target === 'ally') return { moveId, target: (lowestHpOnField(state, (f) => f.side === c.side) ?? c).index };
  const target = lowestHpOnField(state, (f) => f.side !== c.side) ?? state.creatures.find((f) => f.side !== c.side && f.isOrchestrator);
  if (target === undefined) throw new EngineInvariantError('the foe side has no orchestrator', { round: state.round, actor, seed: state.seed });
  return { moveId, target: target.index };
}

type Planned = Pick<ActionEntry, 'moveId' | 'target' | 'priority' | 'injection' | 'lever'>;

function moveEntry(actor: number, moveId: string, target: number): Planned {
  const def = moveDef(moveId);
  return { moveId, target: aimsAtUser(def) ? actor : target, priority: def?.priority ?? 0 };
}

/** Directive and Policy Update carry their move's priority (0); Swap resolves at +3; `none` at 0. */
function leverEntry(actor: number, command: LeverAction): Planned {
  const action = structuredClone(command); // the entry never shares objects with the caller's command
  switch (action.kind) {
    case 'directive':
      return { moveId: 'directive', target: action.subagent, priority: moveDef('directive')?.priority ?? 0, lever: action };
    case 'policyUpdate':
      return { moveId: 'policy-update', target: actor, priority: moveDef('policy-update')?.priority ?? 0, lever: action };
    case 'swap':
      return { moveId: 'swap', target: action.in, priority: SWAP_PRIORITY, lever: action };
    case 'none':
      return { moveId: 'none', target: actor, priority: 0, lever: action };
  }
}

/**
 * A non-headless orchestrator follows its side's command; everything else (an uncommanded or headless
 * orchestrator, every subagent) uses its default intent.
 */
function planFor(state: BattleState, c: CreatureState, cmd: RoundCommand): Planned {
  const action = c.isOrchestrator && !isHeadless(state, c.side) ? cmd[c.side]?.action : undefined;
  if (action === undefined) {
    const intent = defaultIntent(state, c.index);
    return moveEntry(c.index, intent.moveId, intent.target);
  }
  if (action.kind !== 'move') return leverEntry(c.index, action);
  const entry = moveEntry(c.index, action.moveId, action.target);
  return action.injection === undefined ? entry : { ...entry, injection: { ...action.injection } };
}

/**
 * Plan (spec §5 step 2, Ruling 31): one entry per on-field position — each side's orchestrator always
 * (even when KO'd: its entry resolves as a headless skip), plus each living subagent in a non-removed
 * active slot. Bench creatures never get entries. Requires this round's round-start draws.
 */
export function planEntries(state: BattleState, cmd: RoundCommand): ActionEntry[] {
  const entries: ActionEntry[] = [];
  for (const c of state.creatures) {
    if (!c.isOrchestrator && (c.fainted || !holdsLiveSlot(state, c))) continue;
    if (c.roundStart === null) {
      throw new EngineInvariantError('planning before round-start draws', { round: state.round, actor: c.index, seed: state.seed });
    }
    entries.push({
      actor: c.index,
      latency: effectiveStat(c.stats.latency, statStage(c, 'latency')),
      tieBreak: c.roundStart.r1 & 0xffff,
      ...planFor(state, c, cmd),
    });
  }
  return entries;
}
