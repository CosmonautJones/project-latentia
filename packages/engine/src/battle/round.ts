import { recover } from '../context/store.js';
import type { BattleEvent, SkipReason } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import { drawAction, drawRoundStart } from '../rng/draws.js';
import { tickStatuses } from '../status/tick.js';
import { knockOut } from './effects/damage.js';
import { firstLivingBench, forceBench, swapCreatures } from './effects/swap.js';
import { autofillBench, checkEnd, winOutcome } from './end.js';
import { validateCommand, type CommandError } from './errors.js';
import { breakEnemyChains } from './handoff.js';
import { assertInvariants } from './invariants.js';
import type { RoundCommand } from './log.js';
import { holdsLiveSlot, isHeadless, planEntries, sortActions, type ActionEntry } from './order.js';
import { resolveAction } from './resolve.js';
import type { BattleState, CreatureState, SideId } from './state.js';

const SIDES: readonly SideId[] = ['a', 'b'];
/** Context cells a living bench creature recovers at end of round (spec §5 step 5). */
export const BENCH_RECOVERY_CELLS = 2;

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

/** /clear (Ruling 11): an orchestrator holding the `skip` modifier loses this entry, which uses the modifier up. */
function takeClearedSkip(c: CreatureState): boolean {
  const at = c.nextActionMods.findIndex((m) => m.kind === 'skip');
  if (!c.isOrchestrator || at < 0) return false;
  c.nextActionMods.splice(at, 1);
  return true;
}

/**
 * Resolve one entry (spec §5 step 4): the six action draws are taken before anything is decided and
 * recorded on ActionStarted, whether or not the creature acts. A skipped creature (headless, KO'd, off
 * the field, or an orchestrator cleared by /clear) then emits ActionSkipped. A lever other than `none`
 * breaks the enemy's Handoff chains and resets the guard streak; Swap exchanges its creatures (a no-op if
 * they are no longer in place); Directive and Policy Update (B3) are not yet executed. A `none` command
 * emits nothing further. Everything else goes to resolveAction.
 */
function resolveEntry(state: BattleState, entry: ActionEntry, events: BattleEvent[]): void {
  const draws = drawAction(state.rng);
  events.push({ round: state.round, type: 'ActionStarted', actor: entry.actor, draws: { ...draws } });
  const reason = skipReason(state, entry);
  const c = state.creatures[entry.actor] as CreatureState; // skipReason has checked it exists
  if (reason !== null || takeClearedSkip(c)) {
    events.push({ round: state.round, type: 'ActionSkipped', actor: entry.actor, reason: reason ?? 'cleared' });
    return;
  }
  if (entry.lever !== undefined) {
    if (entry.lever.kind === 'none') return;
    breakEnemyChains(state, c.side);
    c.guardStreak = 0;
    if (entry.lever.kind === 'swap') swapCreatures(state, entry.lever.out, entry.lever.in, state.round, events);
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
 * Status ticks (spec §5 step 5) for every living creature in canonical order. Deprecated at 0 (Ruling 21):
 * a subagent on the field with a living bench creature to replace it is force-benched at 1 HP to the end
 * of the bench (announced by its Swapped); an orchestrator, or a subagent with no living bench creature, is
 * KO'd (announced by Fainted). Neither emits Damage.
 */
function tickAll(state: BattleState, events: BattleEvent[]): void {
  const round = state.round;
  for (const c of state.creatures) {
    if (c.fainted) continue;
    const tick = tickStatuses(c, round, firstLivingBench(state, c) !== null);
    events.push(...tick.events);
    if (tick.ko) {
      c.hp = 0;
      knockOut(state, c, round, events);
    } else if (tick.forceBench) {
      c.hp = 1;
      if (c.slot === 'active') forceBench(state, c, round, events);
    }
  }
}

/** Each living bench creature frees its BENCH_RECOVERY_CELLS oldest tokens, in canonical order. */
function recoverBench(state: BattleState, events: BattleEvent[]): void {
  for (const c of state.creatures) {
    if (c.slot === 'bench' && !c.fainted) events.push(...recover(c.context, BENCH_RECOVERY_CELLS, state.round, c.index));
  }
}

/**
 * End of round (spec §5 steps 5-6): status ticks and Deprecated, bench recovery, bench auto-fill — all
 * skipped when the round was cut short by a wipe — then RoundEnd, then the win check and round-50 cap,
 * which emit at most one BattleEnd. (Timed field effects tick here from A13.)
 */
function endRound(state: BattleState, cutShort: boolean, events: BattleEvent[]): void {
  if (!cutShort) {
    tickAll(state, events);
    recoverBench(state, events);
    events.push(...autofillBench(state, state.round));
  }
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
