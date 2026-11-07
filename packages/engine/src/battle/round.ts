import type { BattleEvent, SkipReason } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import { drawAction, drawRoundStart } from '../rng/draws.js';
import { autofillBench, checkEnd, winOutcome } from './end.js';
import { validateCommand, type CommandError } from './errors.js';
import { breakEnemyChains } from './handoff.js';
import { assertInvariants } from './invariants.js';
import type { RoundCommand } from './log.js';
import { holdsLiveSlot, isHeadless, planEntries, sortActions, type ActionEntry } from './order.js';
import { resolveAction } from './resolve.js';
import type { BattleState, SideId } from './state.js';

const SIDES: readonly SideId[] = ['a', 'b'];

/**
 * Round start (spec §5 step 1): advance the round, clear the Handoff chains, emit RoundStart, take R1/R2 for every creature in
 * canonical order (alive or not) and keep them on the creature; store each command's temperature on its
 * side, except a headless side's (its command is ignored, Ruling 36).
 */
function startRound(state: BattleState, cmd: RoundCommand, events: BattleEvent[]): void {
  state.round += 1;
  state.handoff = [];
  events.push({ round: state.round, type: 'RoundStart' });
  for (const c of state.creatures) c.roundStart = drawRoundStart(state.rng);
  for (const side of SIDES) {
    const sc = cmd[side];
    if (sc !== undefined && !isHeadless(state, side)) state.sides[side].temperature = sc.temperature;
  }
}

/** Why a planned entry cannot act now: a KO'd orchestrator is headless; a subagent may be KO'd or off the field. */
function skipReason(state: BattleState, entry: ActionEntry): SkipReason | null {
  const c = state.creatures[entry.actor];
  if (c === undefined) throw new EngineInvariantError(`entry for unknown creature ${entry.actor}`, { round: state.round, actor: entry.actor, seed: state.seed });
  if (c.isOrchestrator) return c.fainted ? 'headless' : null;
  if (c.fainted) return 'fainted';
  return holdsLiveSlot(state, c) ? null : 'leftField';
}

/**
 * Resolve one entry (spec §5 step 4): the six action draws are taken before anything is decided and
 * recorded on ActionStarted, whether or not the creature acts. A skipped creature then emits
 * ActionSkipped. A `none` command emits nothing further; Directive and Policy Update (B3) and Swap (A12b)
 * are validated but not yet executed. Everything else goes to resolveAction.
 */
function resolveEntry(state: BattleState, entry: ActionEntry, events: BattleEvent[]): void {
  const draws = drawAction(state.rng);
  events.push({ round: state.round, type: 'ActionStarted', actor: entry.actor, draws: { ...draws } });
  const reason = skipReason(state, entry);
  if (reason !== null) {
    events.push({ round: state.round, type: 'ActionSkipped', actor: entry.actor, reason });
    return;
  }
  if (entry.lever !== undefined) {
    // A lever is still an action in the order: it breaks the enemy's Handoff chains (bible Handoff Chain).
    const c = state.creatures[entry.actor];
    if (entry.lever.kind !== 'none' && c !== undefined) breakEnemyChains(state, c.side);
    return;
  }
  resolveAction(state, entry, draws, events);
}

/**
 * Resolve the sorted entries, checking for a win after every one (Ruling 32). Once a side is wiped the
 * remaining entries are not resolved and draw nothing. Returns whether the round was cut short.
 */
function resolveAll(state: BattleState, entries: readonly ActionEntry[], events: BattleEvent[]): boolean {
  for (const entry of entries) {
    resolveEntry(state, entry, events);
    if (winOutcome(state) !== null) return true;
  }
  return false;
}

/**
 * End of round (spec §5 steps 5-6): bench auto-fill (skipped when the round was cut short by a wipe),
 * RoundEnd, then the win check and round-50 cap, which emit at most one BattleEnd.
 */
function endRound(state: BattleState, cutShort: boolean, events: BattleEvent[]): void {
  if (!cutShort) events.push(...autofillBench(state, state.round));
  events.push({ round: state.round, type: 'RoundEnd' });
  events.push(...checkEnd(state));
}

/**
 * Advance one round. An illegal command returns `{ error }` before anything is cloned, so the input is
 * untouched; otherwise the input is cloned once and the clone is advanced, invariant-checked and returned.
 */
export function submitRound(state: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } | { error: CommandError } {
  const error = validateCommand(state, cmd);
  if (error !== null) return { error };
  const next = structuredClone(state);
  const events: BattleEvent[] = [];
  startRound(next, cmd, events);
  const cutShort = resolveAll(next, sortActions(planEntries(next, cmd)), events);
  endRound(next, cutShort, events);
  assertInvariants(next);
  return { state: next, events };
}
