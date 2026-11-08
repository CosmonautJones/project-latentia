import { eventStreamHash } from '../events/canonical.js';
import type { BattleEvent } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import type { SeedHex } from '../rng/seed.js';
import { ROUND_CAP } from './end.js';
import type { CommandError } from './errors.js';
import { ENGINE_VERSION, type BattleLog, type RoundCommand } from './log.js';
import { playRound } from './round.js';
import { createBattle, type BattleSetup } from './setup.js';
import type { BattleState, Outcome } from './state.js';

/**
 * Where simulate gets each round's command. `recorded`: `rounds[i]` for round i + 1, and `{}` (every side on
 * its default intents) once they run out. `scripted`: `next(state)` with the state before the round.
 * **`next` must not mutate the state it receives**: it is the live battle state, which simulate advances in
 * place (no clone per round), so a change would leak into the battle and break replay. `autopilot`: decks
 * drive both sides — not available until B4 (simulate throws SimulateError `autopilotUnavailable`).
 */
export type CommandSource =
  | { kind: 'recorded'; rounds: RoundCommand[] }
  | { kind: 'scripted'; next: (state: BattleState) => RoundCommand }
  | { kind: 'autopilot' };

/**
 * A finished battle. `events` is the whole event stream, round 1 to the end (createBattle emits no events:
 * battleStart passives are silent), and `hash = eventStreamHash(events)`. `log` holds exactly the commands
 * that were submitted, one per round played, so `replay(log)` reproduces the events and the hash.
 */
export type BattleResult = { winner: Outcome; rounds: number; events: BattleEvent[]; hash: string; log: BattleLog };

/**
 * A caller mistake in a CommandSource: `autopilotUnavailable` (until B4), or `invalidCommand` — the
 * command for `round` was rejected by submitRound's checks (`command` says why).
 */
export class SimulateError extends Error {
  readonly code: 'autopilotUnavailable' | 'invalidCommand';
  readonly round: number | null;
  readonly command: CommandError | null;

  constructor(code: SimulateError['code'], round: number | null = null, command: CommandError | null = null) {
    super(code === 'autopilotUnavailable' ? 'autopilot command sources are not available until B4' : `round ${String(round)}: ${command?.message ?? 'invalid command'}`);
    this.name = 'SimulateError';
    this.code = code;
    this.round = round;
    this.command = command;
  }
}

/**
 * The battle loop shared by simulate and replay: createBattle once, then each round take `next(state)` and
 * play it through playRound — the validate-then-advance path submitRound also takes — on the one state, in
 * place (spec §4: no clone per round), until the battle ends. Each command is copied into the log, so the
 * log shares nothing with the caller. A rejected command stops the run and is returned with its round;
 * `next` returning null (no command left) stops it with `exhausted`. createBattle throws SetupError for an
 * invalid setup or seed.
 */
export function runBattle(
  setup: BattleSetup,
  seed: SeedHex,
  next: (state: BattleState) => RoundCommand | null,
): BattleResult | { round: number; error: CommandError | 'exhausted' } {
  const state = createBattle(setup, seed);
  const log: BattleLog = { engineVersion: ENGINE_VERSION, seed, setup: structuredClone(setup), rounds: [] };
  const events: BattleEvent[] = [];
  const inPlace = (s: BattleState): BattleState => s;
  while (!state.ended) {
    if (state.round >= ROUND_CAP) throw new EngineInvariantError(`battle still running after round ${ROUND_CAP}`, { round: state.round, seed });
    const given = next(state);
    if (given === null) return { round: state.round + 1, error: 'exhausted' };
    const cmd = structuredClone(given);
    const out = playRound(state, cmd, inPlace);
    if ('error' in out) return { round: state.round + 1, error: out.error };
    log.rounds.push(cmd);
    for (const e of out.events) events.push(e);
  }
  if (state.result === null) throw new EngineInvariantError('battle ended with no result', { round: state.round, seed });
  return { winner: state.result, rounds: state.round, events, hash: eventStreamHash(events), log };
}

/**
 * Runs a whole battle (spec §4). Throws SetupError for an invalid setup or seed, and SimulateError for an
 * autopilot source (until B4) or a command submitRound would reject.
 */
export function simulate(setup: BattleSetup, seed: SeedHex, commands: CommandSource): BattleResult {
  if (commands.kind === 'autopilot') throw new SimulateError('autopilotUnavailable');
  // A scripted source is called as a method, so a class-based source keeps its `this` (Ruling 78).
  const next = commands.kind === 'recorded' ? (state: BattleState) => commands.rounds[state.round] ?? {} : (state: BattleState) => commands.next(state);
  const result = runBattle(setup, seed, next);
  if (!('error' in result)) return result;
  // Neither source runs out (recorded pads with `{}`), so the error is a rejected command.
  throw new SimulateError('invalidCommand', result.round, result.error === 'exhausted' ? null : result.error);
}
