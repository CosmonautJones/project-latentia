import type { BattleEvent, SkipReason } from '../events/types.js';
import { drawAction, drawRoundStart } from '../rng/draws.js';
import { autofillBench, checkCap, checkEnd } from './end.js';
import { validateCommand, type CommandError } from './errors.js';
import { assertInvariants } from './invariants.js';
import type { RoundCommand } from './log.js';
import { holdsLiveSlot, planEntries, sortActions, type ActionEntry } from './order.js';
import { resolveAction } from './resolve.js';
import type { BattleState, SideId } from './state.js';

const SIDES: readonly SideId[] = ['a', 'b'];

/**
 * Round start (spec §5 step 1): advance the round, emit RoundStart, take R1/R2 for every creature in
 * canonical order (alive or not) and keep them on the creature; store each command's temperature on its side.
 */
function startRound(state: BattleState, cmd: RoundCommand, events: BattleEvent[]): void {
  state.round += 1;
  events.push({ round: state.round, type: 'RoundStart' });
  for (const c of state.creatures) c.roundStart = drawRoundStart(state.rng);
  for (const side of SIDES) {
    const sc = cmd[side];
    if (sc !== undefined) state.sides[side].temperature = sc.temperature;
  }
}

/** Why a planned entry cannot act now: a KO'd orchestrator is headless; a subagent may be KO'd or off the field. */
function skipReason(state: BattleState, entry: ActionEntry): SkipReason | null {
  const c = state.creatures[entry.actor];
  if (c === undefined) return 'fainted';
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
  if (entry.lever !== undefined) return;
  resolveAction(state, entry, draws, events);
}

/** End of round (spec §5 steps 5-6): bench auto-fill, win check, RoundEnd, then the round-50 cap. */
function endRound(state: BattleState, events: BattleEvent[]): void {
  events.push(...autofillBench(state, state.round));
  events.push(...checkEnd(state));
  events.push({ round: state.round, type: 'RoundEnd' });
  events.push(...checkCap(state));
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
  for (const entry of sortActions(planEntries(next, cmd))) resolveEntry(next, entry, events);
  endRound(next, events);
  assertInvariants(next);
  return { state: next, events };
}
