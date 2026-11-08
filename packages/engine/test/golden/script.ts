import { validateCommand } from '../../src/battle/errors.js';
import type { OrchestratorAction, RoundCommand, SideCommand } from '../../src/battle/log.js';
import type { CommandSource } from '../../src/battle/simulate.js';
import type { Card } from '../../src/cards/model.js';
import type { BattleState, CreatureState, SideId, Temperature } from '../../src/battle/state.js';

// Scripted command sources for the golden battles and the benchmark. A script is a cycle of steps per
// side; each round's step is resolved against the state before the round into one action that
// validateCommand accepts, so every command is a pure function of the state (the same script replays the
// same battle) and nothing here mutates the state it reads.

/** Who a move step aims at first; any later candidate is tried when the first is not a legal target. */
export type Aim = 'lowestFoe' | 'foeOrch' | 'foeSub' | 'ally';

export type Step =
  /** A move the orchestrator knows; `inject` adds a (Deepfake Call) injection payload to the command. */
  | { move: string; aim?: Aim; inject?: { moveId: string; target: number } }
  /** Swap: the occupant of active slot `out` for the `in`-th living bench creature (bench order). */
  | { swap: { out: 0 | 1; in: number } }
  /** Directive to the occupant of active slot `slot`: `moveId`, or its first move with a legal target. */
  | { directive: { slot: 0 | 1; moveId?: string } }
  /** Policy Update with this card. */
  | { policy: Card }
  | 'none';

/**
 * The round after r completed rounds uses `temps[r % length]` and `opening[r]`, then (once the opening is
 * used up) `steps[(r - opening.length) % length]`.
 */
export type SideScript = { temps: readonly Temperature[]; opening?: readonly Step[]; steps: readonly Step[] };

const orchestratorOf = (state: BattleState, side: SideId): CreatureState | undefined =>
  state.creatures.find((c) => c.side === side && c.isOrchestrator);

const legal = (state: BattleState, side: SideId, sc: SideCommand): boolean => validateCommand(state, { [side]: sc }) === null;

const byHp = (cs: readonly CreatureState[]): CreatureState[] => [...cs].sort((x, y) => x.hp - y.hp || x.index - y.index);

/** Target candidates in preference order (duplicates allowed); validateCommand decides which are legal. */
function candidates(state: BattleState, user: CreatureState, aim: Aim): number[] {
  const foes = state.creatures.filter((c) => c.side !== user.side);
  const allies = state.creatures.filter((c) => c.side === user.side);
  const subs = (cs: readonly CreatureState[]): CreatureState[] => cs.filter((c) => !c.isOrchestrator);
  const orchs = (cs: readonly CreatureState[]): CreatureState[] => cs.filter((c) => c.isOrchestrator);
  const order =
    aim === 'foeOrch' ? [...orchs(foes), ...byHp(foes)]
    : aim === 'foeSub' ? [...subs(foes), ...orchs(foes)]
    : aim === 'ally' ? [...byHp(subs(allies)), user, ...byHp(foes)]
    : [...byHp(foes), ...byHp(allies)];
  return order.map((c) => c.index);
}

/** The first of `user`'s moves with a legal target (lowest-HP foe first), as `wrap` builds the action. */
function firstMoveOf(state: BattleState, side: SideId, user: CreatureState, temperature: Temperature, wrap: (moveId: string, target: number) => OrchestratorAction): OrchestratorAction | null {
  for (const moveId of user.moves) {
    for (const target of candidates(state, user, 'lowestFoe')) {
      const action = wrap(moveId, target);
      if (legal(state, side, { temperature, action })) return action;
    }
  }
  return null;
}

/**
 * The orchestrator's first usable move at a legal target (its move list in order, lowest-HP foe first),
 * `none` while it charges, is headless or has nothing legal. The benchmark's command for every round.
 */
export function firstUsable(state: BattleState, side: SideId, temperature: Temperature = 2): SideCommand {
  const orch = orchestratorOf(state, side);
  const none: SideCommand = { temperature, action: { kind: 'none' } };
  if (orch === undefined || orch.fainted || orch.charging !== null) return none;
  const action = firstMoveOf(state, side, orch, temperature, (moveId, target) => ({ kind: 'move', moveId, target }));
  return action === null ? none : { temperature, action };
}

function livingBench(state: BattleState, side: SideId): CreatureState[] {
  return state.creatures
    .filter((c) => c.side === side && c.slot === 'bench' && !c.fainted)
    .sort((x, y) => (x.benchOrder ?? 0) - (y.benchOrder ?? 0) || x.index - y.index);
}

/** The step's action if it resolves to a legal one, else null. */
function stepAction(state: BattleState, side: SideId, orch: CreatureState, step: Step, temperature: Temperature): OrchestratorAction | null {
  const ok = (action: OrchestratorAction): boolean => legal(state, side, { temperature, action });
  if (step === 'none') return { kind: 'none' };
  if ('move' in step) {
    for (const target of candidates(state, orch, step.aim ?? 'lowestFoe')) {
      const action: OrchestratorAction = step.inject === undefined ? { kind: 'move', moveId: step.move, target } : { kind: 'move', moveId: step.move, target, injection: { ...step.inject } };
      if (ok(action)) return action;
    }
    return null;
  }
  if ('policy' in step) {
    const action: OrchestratorAction = { kind: 'policyUpdate', card: structuredClone(step.policy) };
    return ok(action) ? action : null;
  }
  if ('swap' in step) {
    const out = state.sides[side].slots[step.swap.out]?.occupant ?? null;
    const inc = livingBench(state, side)[step.swap.in];
    if (out === null || inc === undefined) return null;
    const action: OrchestratorAction = { kind: 'swap', out, in: inc.index };
    return ok(action) ? action : null;
  }
  const sub = state.creatures[state.sides[side].slots[step.directive.slot]?.occupant ?? -1];
  if (sub === undefined) return null;
  const wanted = step.directive.moveId;
  return firstMoveOf(state, side, { ...sub, moves: wanted === undefined ? sub.moves : [wanted] }, temperature, (moveId, target) => ({ kind: 'directive', subagent: sub.index, moveId, target }));
}

/** One side's command for this round: its step if legal, else its first usable move, else `none`. */
export function scriptCommand(state: BattleState, side: SideId, script: SideScript): SideCommand {
  const r = state.round;
  const temperature = script.temps[r % script.temps.length] ?? 2;
  const opening = script.opening ?? [];
  const step = opening[r] ?? script.steps[(r - opening.length) % script.steps.length] ?? 'none';
  const orch = orchestratorOf(state, side);
  if (orch === undefined || orch.fainted || orch.charging !== null) return { temperature, action: { kind: 'none' } };
  const action = stepAction(state, side, orch, step, temperature);
  return action === null ? firstUsable(state, side, temperature) : { temperature, action };
}

/** A scripted source from per-side scripts; a side with no script sends no command (default intents). */
export function scriptedSource(scripts: { a?: SideScript; b?: SideScript }): CommandSource {
  return {
    kind: 'scripted',
    next: (state: BattleState): RoundCommand => {
      const cmd: RoundCommand = {};
      if (scripts.a !== undefined) cmd.a = scriptCommand(state, 'a', scripts.a);
      if (scripts.b !== undefined) cmd.b = scriptCommand(state, 'b', scripts.b);
      return cmd;
    },
  };
}
