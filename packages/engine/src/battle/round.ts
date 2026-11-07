import { recover } from '../context/store.js';
import type { BattleEvent, SkipReason } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import { drawAction, drawRoundStart, lo, type ActionDraws } from '../rng/draws.js';
import { hasStatus } from '../status/apply.js';
import { tickStatuses } from '../status/tick.js';
import { knockOut } from './effects/damage.js';
import { takeSortPriority } from './effects/nextActionModifier.js';
import { notKoPassives, roundEndPassives } from './effects/passive.js';
import { expireSnapshots, revertKo } from './effects/snapshot.js';
import { heldInjection } from './effects/status.js';
import { firstLivingBench, forceBench, swapCreatures } from './effects/swap.js';
import { roundStartReveals, tickFields } from './effects/timedField.js';
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

/**
 * Why a planned entry cannot act now: a KO'd orchestrator is headless; a subagent may be KO'd, off the
 * field, or have left the field earlier this round (even if since brought back, Ruling 52).
 */
function skipReason(state: BattleState, entry: ActionEntry): SkipReason | null {
  const c = state.creatures[entry.actor];
  if (c === undefined) throw new EngineInvariantError(`entry for unknown creature ${entry.actor}`, { round: state.round, actor: entry.actor, seed: state.seed });
  if (c.isOrchestrator) return c.fainted ? 'headless' : null;
  if (c.fainted) return 'fainted';
  return holdsLiveSlot(state, c) && c.leftFieldRound !== state.round ? null : 'leftField';
}

/** Rate Limited loses the turn when lo(D2, 100) is below this (spec §5 D2 lo). */
export const RATE_LIMITED_SKIP_PCT = 25;

/** A Rate Limited creature loses this entry when lo(D2, 100) < 25, from the entry's own draws (Ruling 74). */
function rateLimitedSkip(c: CreatureState, draws: ActionDraws): boolean {
  return hasStatus(c, 'rateLimited') && lo(draws.d2, 100) < RATE_LIMITED_SKIP_PCT;
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
 * the field, an orchestrator cleared by /clear, or a Rate Limited creature whose lo(D2, 100) < 25 — checked
 * before the lever branch, so a lever is rate-limited like a move, Ruling 74) then emits ActionSkipped. An
 * orchestrator holding Prompt Injected goes to resolveAction whatever it was commanded — a move, any lever
 * or `none` — where the hijack replaces the action and consumes the status (Ruling 53). A hijacked lever
 * entry keeps the priority it was sorted with (a Swap's +3, say): the entry's place in the turn order is
 * fixed at Sort, before anyone knows it will be hijacked. Otherwise a lever other than `none` breaks the
 * enemy's Handoff chains and resets the guard streak; Swap exchanges its creatures (a no-op if they are no
 * longer in place); Directive and Policy Update (B3) are not yet executed. A `none` command emits nothing
 * further. Everything else goes to resolveAction. Exported for tests that drive entries one at a time.
 */
export function resolveEntry(state: BattleState, entry: ActionEntry, events: BattleEvent[]): void {
  const draws = drawAction(state.rng);
  events.push({ round: state.round, type: 'ActionStarted', actor: entry.actor, draws: { ...draws } });
  const skipped = skipReason(state, entry);
  const c = state.creatures[entry.actor] as CreatureState; // skipReason has checked it exists
  const reason = skipped ?? (takeClearedSkip(c) ? 'cleared' : rateLimitedSkip(c, draws) ? 'rateLimited' : null);
  if (reason !== null) {
    events.push({ round: state.round, type: 'ActionSkipped', actor: entry.actor, reason });
    return;
  }
  if (entry.lever !== undefined && heldInjection({ state, round: state.round }, c.index) === null) {
    if (entry.lever.kind === 'none') return;
    breakEnemyChains(state, c.side);
    c.guardStreak = 0;
    if (entry.lever.kind === 'swap') swapCreatures(state, entry.lever.out, entry.lever.in, state.round, events);
    return;
  }
  resolveAction(state, entry, draws, events);
}

/**
 * Resolve the sorted entries in BattleState.turnOrder (which Rerank may edit), checking for a win after every
 * one (Ruling 32). Once a side is wiped the remaining entries are not resolved and draw nothing. Returns
 * whether the round was cut short; turnOrder is empty afterwards.
 */
/**
 * resolveEntry, with any EngineInvariantError that escapes it completed by the entry's context (Ruling 78):
 * `action` (its lever kind, else its move id), round, actor and seed, each only where the raiser left it unset.
 */
function resolveWithContext(state: BattleState, entry: ActionEntry, events: BattleEvent[]): void {
  try {
    resolveEntry(state, entry, events);
  } catch (e) {
    if (e instanceof EngineInvariantError) {
      e.action ??= entry.lever?.kind ?? entry.moveId;
      e.round ??= state.round;
      e.actor ??= entry.actor;
      e.seed ??= state.seed;
    }
    throw e;
  }
}

function resolveAll(state: BattleState, entries: readonly ActionEntry[], events: BattleEvent[]): boolean {
  const byActor = new Map(entries.map((e) => [e.actor, e]));
  state.turnOrder = entries.map((e) => e.actor);
  for (let actor = state.turnOrder.shift(); actor !== undefined; actor = state.turnOrder.shift()) {
    const entry = byActor.get(actor);
    if (entry === undefined) throw new EngineInvariantError(`turn order names creature ${actor} with no entry`, { round: state.round, actor, seed: state.seed });
    resolveWithContext(state, entry, events);
    if (winOutcome(state) !== null) {
      state.turnOrder = [];
      return true;
    }
  }
  return false;
}

/**
 * Status ticks (spec §5 step 5) for every living creature in canonical order. Deprecated at 0 (Ruling 21):
 * a subagent on the field with a living bench creature to replace it is force-benched at 1 HP to the end
 * of the bench (announced by its Swapped); an orchestrator, or a subagent with no living bench creature, is
 * KO'd (announced by Fainted) unless a Save State snapshot reverts it (Healed / Damage to the saved HP).
 * Neither emits a Damage for the tick itself.
 */
function tickAll(state: BattleState, events: BattleEvent[]): void {
  const round = state.round;
  for (const c of state.creatures) {
    if (c.fainted) continue;
    const tick = tickStatuses(c, round, firstLivingBench(state, c) !== null);
    events.push(...tick.events);
    if (tick.ko) {
      // A Save State snapshot reverts the KO from the HP the creature had (the tick itself emits no Damage).
      if (revertKo(c, round, events)) continue;
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
 * End of round (spec §5 steps 5-6, Ruling 57): roundEnd passives, status ticks and Deprecated, timed field
 * ticks, notKoThisRound passives for every creature still alive, expired snapshots dropped, bench recovery,
 * bench auto-fill — all skipped when the round was cut short by a wipe — then every guard is cleared, then
 * RoundEnd, then the win check and round-50 cap, which emit at most one BattleEnd.
 */
function endRound(state: BattleState, cutShort: boolean, events: BattleEvent[]): void {
  if (!cutShort) {
    roundEndPassives(state, events);
    tickAll(state, events);
    tickFields(state, events);
    notKoPassives(state, events);
    expireSnapshots(state);
    recoverBench(state, events);
    events.push(...autofillBench(state, state.round));
  }
  for (const c of state.creatures) c.guard = null; // guards last only the round they were raised in
  events.push({ round: state.round, type: 'RoundEnd' });
  events.push(...checkEnd(state));
}

/**
 * Sort (spec §5 step 3): the entries in resolution order; each creature with an entry uses up its pending
 * `priority` modifiers (Move Fast: its first Sort). Then the reveal fields show their holders (Revealed).
 */
function sortRound(state: BattleState, entries: ActionEntry[], events: BattleEvent[]): ActionEntry[] {
  const sorted = sortActions(entries);
  for (const e of sorted) {
    const c = state.creatures[e.actor];
    if (c !== undefined) takeSortPriority(c);
  }
  roundStartReveals(state, events);
  return sorted;
}

/**
 * Validate-then-advance, the one path every round takes (Ruling 71). An illegal command returns `{ error }`
 * before `into` is called, so `state` is untouched. Otherwise `into(state)` gives the state to advance —
 * a clone for submitRound, `state` itself for simulate and replay (spec §4: they mutate one state in place)
 * — which runs one full round, is invariant-checked and is returned with the round's events.
 */
export function playRound(
  state: BattleState,
  cmd: RoundCommand,
  into: (state: BattleState) => BattleState,
): { state: BattleState; events: BattleEvent[] } | { error: CommandError } {
  const error = validateCommand(state, cmd);
  if (error !== null) return { error };
  const next = into(state);
  const events: BattleEvent[] = [];
  startRound(next, cmd, events);
  const cutShort = resolveAll(next, sortRound(next, planEntries(next, cmd), events), events);
  endRound(next, cutShort, events);
  assertInvariants(next);
  return { state: next, events };
}

/**
 * Advance one round. An illegal command returns `{ error }` before anything is cloned, so the input is
 * untouched; otherwise the input is cloned once and the clone is advanced, invariant-checked and returned.
 */
export function submitRound(state: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } | { error: CommandError } {
  return playRound(state, cmd, structuredClone);
}
