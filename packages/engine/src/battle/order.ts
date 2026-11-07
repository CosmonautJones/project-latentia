import { EngineInvariantError } from '../math/bp.js';
import { effectiveStat } from '../math/stats.js';
import { moveDef } from './errors.js';
import type { OrchestratorAction, RoundCommand } from './log.js';
import type { BattleState, CreatureState, SideId } from './state.js';

/** Swap and Early Exit resolve at this priority bracket (spec §5 "Orchestrator levers"). */
export const SWAP_PRIORITY = 3;

/**
 * One creature's action for the round (spec §5 "Round structure", Sort). Entries belong to creatures,
 * not slots. `latency` is effective Latency (stat with its stage); `tieBreak` is the creature's R1 low
 * 16 bits. `lever` is set only on an orchestrator entry whose command is not a move: its `moveId` is
 * then the lever name (`directive`, `policy-update`, `swap`, `none`) and is never resolved as a move.
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
  lever?: Exclude<OrchestratorAction['kind'], 'move'>;
};

/** Priority desc, effective latency desc, tie-break desc, canonical index asc. */
function compare(x: ActionEntry, y: ActionEntry): number {
  return y.priority - x.priority || y.latency - x.latency || y.tieBreak - x.tieBreak || x.actor - y.actor;
}

/** A stable, total sort into resolution order (a new array). Two entries for one creature is an engine bug. */
export function sortActions(entries: readonly ActionEntry[]): ActionEntry[] {
  const sorted = [...entries].sort(compare);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev !== undefined && cur !== undefined && prev.actor === cur.actor) {
      throw new EngineInvariantError(`creature ${cur.actor} has two action entries; turn order is not total`, { actor: cur.actor });
    }
  }
  return sorted;
}

function isOnField(c: CreatureState): boolean {
  return c.slot !== 'bench';
}

/** Lowest HP first, then lowest canonical index. */
function lowestHp(cs: readonly CreatureState[]): CreatureState | undefined {
  let best: CreatureState | undefined;
  for (const c of cs) if (best === undefined || c.hp < best.hp) best = c;
  return best;
}

/**
 * The intent of a creature with no command and no deck (decks replace this in B2, Autopilot in B4): the
 * first move in its list that is neither universal nor orchestrator-only (its first move if none is),
 * aimed at the lowest-HP living foe on the field (ties: lowest canonical index). With no living foe on
 * the field it aims at the lowest-HP living foe anywhere, and with none at all at the foe orchestrator.
 */
export function defaultIntent(state: BattleState, actor: number): { moveId: string; target: number } {
  const c = state.creatures[actor];
  if (c === undefined) throw new EngineInvariantError(`no creature ${actor}`, { round: state.round, actor, seed: state.seed });
  const usable = c.moves.find((m) => {
    const def = moveDef(m);
    return def !== null && def.universal !== true && def.orchestratorOnly !== true;
  });
  const moveId = usable ?? c.moves[0] ?? 'compact';
  const foes = state.creatures.filter((f) => f.side !== c.side);
  const living = foes.filter((f) => !f.fainted);
  const target = lowestHp(living.filter(isOnField)) ?? lowestHp(living) ?? foes.find((f) => f.isOrchestrator);
  if (target === undefined) throw new EngineInvariantError('the foe side has no orchestrator', { round: state.round, actor, seed: state.seed });
  return { moveId, target: target.index };
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

type Planned = Pick<ActionEntry, 'moveId' | 'target' | 'priority' | 'lever'>;

function moveEntry(moveId: string, target: number): Planned {
  return { moveId, target, priority: moveDef(moveId)?.priority ?? 0 };
}

/** Directive and Policy Update carry their move's priority (0); Swap resolves at +3; `none` at 0. */
function leverEntry(action: Exclude<OrchestratorAction, { kind: 'move' }>): Planned {
  switch (action.kind) {
    case 'directive':
      return { ...moveEntry('directive', action.subagent), lever: 'directive' };
    case 'policyUpdate':
      return { ...moveEntry('policy-update', -1), lever: 'policyUpdate' };
    case 'swap':
      return { moveId: 'swap', target: action.in, priority: SWAP_PRIORITY, lever: 'swap' };
    case 'none':
      return { moveId: 'none', target: -1, priority: 0, lever: 'none' };
  }
}

/** The orchestrator follows its side's command; everything else (and an uncommanded orchestrator) its default intent. */
function planFor(state: BattleState, c: CreatureState, cmd: RoundCommand): Planned {
  const action = c.isOrchestrator ? cmd[c.side]?.action : undefined;
  if (action === undefined) {
    const intent = defaultIntent(state, c.index);
    return moveEntry(intent.moveId, intent.target);
  }
  return action.kind === 'move' ? moveEntry(action.moveId, action.target) : leverEntry(action);
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
      latency: effectiveStat(c.stats.latency, c.stages.latency ?? 0),
      tieBreak: c.roundStart.r1 & 0xffff,
      ...planFor(state, c, cmd),
    });
  }
  return entries;
}
