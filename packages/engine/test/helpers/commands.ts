import fc from 'fast-check';
import { validateCommand } from '../../src/battle/errors.js';
import type { OrchestratorAction, RoundCommand } from '../../src/battle/log.js';
import type { CommandSource } from '../../src/battle/simulate.js';
import type { BattleState, SideId, Temperature } from '../../src/battle/state.js';
import type { Card } from '../../src/cards/model.js';
import { moveDef } from '../../src/content/moves.js';

// Scripted-command arbitraries for the property and fuzz suites (split from arbitraries.ts): every round, each
// side's orchestrator sends one LEGAL action — a move (sometimes with an injection), a Swap, a Directive or a
// Policy Update — each accepted by validateCommand, so the properties exercise battles rather than validation.

/** Choices per round: for each side, temperature, kind, pick and injection pick. */
const PER_SIDE = 4;
const PER_ROUND = 2 * PER_SIDE;
const ROUNDS = 50;

const SIDE_IDS: readonly SideId[] = ['a', 'b'];

const legal = (state: BattleState, side: SideId, action: OrchestratorAction): boolean =>
  validateCommand(state, { [side]: { temperature: 2, action } }) === null;

/** Targets worth trying for `moveId`: the user alone for self/none moves, every creature otherwise. */
function targetsFor(state: BattleState, user: number, moveId: string): number[] {
  const def = moveDef(moveId);
  if (def === null) return [];
  return def.target === 'self' || def.target === 'none' ? [user] : state.creatures.map((c) => c.index);
}

/**
 * Every legal orchestrator action for a side, by kind, each one accepted by validateCommand:
 * - `move`: each orchestrator move × legal target (a self/none move once, aimed at the user);
 * - `swap`: each allied active creature out × each living allied bench creature in;
 * - `directive`: each live allied subagent × each of its moves × legal target;
 * - `policyUpdate` (Ruling 72): simple cards of distinct ids (`policyCards`) for each move an allied active subagent knows.
 * Injections are added at pick time (scriptedFrom), onto a legal move.
 */
export function legalActions(state: BattleState, side: SideId): Record<'move' | 'swap' | 'directive' | 'policyUpdate', OrchestratorAction[]> {
  const out = { move: [] as OrchestratorAction[], swap: [] as OrchestratorAction[], directive: [] as OrchestratorAction[], policyUpdate: [] as OrchestratorAction[] };
  const orch = state.creatures.find((c) => c.side === side && c.isOrchestrator);
  if (orch === undefined) return out;
  const add = (list: OrchestratorAction[], action: OrchestratorAction): void => {
    if (legal(state, side, action)) list.push(action);
  };
  for (const moveId of orch.moves) for (const target of targetsFor(state, orch.index, moveId)) add(out.move, { kind: 'move', moveId, target });
  const allies = state.creatures.filter((c) => c.side === side && !c.isOrchestrator);
  for (const o of allies.filter((c) => c.slot === 'active')) for (const i of allies.filter((c) => c.slot === 'bench')) add(out.swap, { kind: 'swap', out: o.index, in: i.index });
  for (const sub of allies.filter((c) => c.slot === 'active' && !c.fainted)) {
    for (const moveId of sub.moves) for (const target of targetsFor(state, sub.index, moveId)) add(out.directive, { kind: 'directive', subagent: sub.index, moveId, target });
  }
  const moves = new Set(allies.filter((c) => c.slot === 'active').flatMap((c) => c.moves));
  for (const card of [...moves].flatMap(policyCards)) add(out.policyUpdate, { kind: 'policyUpdate', card });
  return out;
}

/**
 * Policy Update cards over `move` (Ruling 72): a coin flip at the lowest-HP foe, or "at 50% HP or more" at a seeded
 * random foe. Each card has its own id (by rule and move), so policies issued in successive rounds stack in force,
 * newest on top; re-issuing the same card replaces it (Ruling 119 m6). Allied subagents that do not know the move
 * trace it moveDisabled.
 */
function policyCards(move: string): Card[] {
  return [
    { id: `policy-coin-${move}`, subject: 'self', condition: { category: 'coin' }, move, target: 'lowestHpFoe' },
    { id: `policy-hp-${move}`, subject: 'self', condition: { category: 'hp', op: 'atLeast', pct: 50 }, move, target: 'randomFoe' },
  ];
}

/**
 * A move with an injection choice (Deepfake Call's Prompt Injected pick, spec §6): a foe's known move and
 * a canonical index, picked by `pick`. No slice species knows Deepfake Call, so the choice is carried to the
 * entry but never applied; it still exercises the command, planning and resolution paths for injections.
 */
function withInjection(state: BattleState, side: SideId, move: OrchestratorAction, pick: number): OrchestratorAction {
  if (move.kind !== 'move') return move;
  const foes = state.creatures.filter((c) => c.side !== side);
  const foe = foes[pick % foes.length];
  const moveId = foe?.moves[(pick >>> 4) % Math.max(1, foe.moves.length)];
  if (moveId === undefined) return move;
  const injected: OrchestratorAction = { ...move, injection: { moveId, target: (pick >>> 8) % state.creatures.length } };
  return legal(state, side, injected) ? injected : move;
}

/**
 * A scripted source from precomputed choices: each round, for each side, a temperature and one legal
 * orchestrator action picked from the current state — a kind among those with a legal action (move, move
 * with an injection, swap, directive, policy update), then one action of that kind; `none` when nothing is legal (e.g.
 * while charging). A side with an Autopilot config sends no command about half the rounds (bit 8 of its
 * temperature choice), so its Autopilot deck drives those rounds (Ruling 94). `next` is a pure function of the
 * state, so the same source replays the same battle every time it is simulated, and it never mutates the state.
 */
export function scriptedFrom(choices: readonly number[]): CommandSource {
  const choice = (round: number, k: number): number => choices[(round * PER_ROUND + k) % choices.length] ?? 0;
  return {
    kind: 'scripted',
    next: (state: BattleState): RoundCommand => {
      const cmd: RoundCommand = {};
      SIDE_IDS.forEach((side, s) => {
        const c = (k: number): number => choice(state.round, s * PER_SIDE + k);
        if (state.sides[side].autopilot !== null && ((c(0) >>> 8) & 1) === 0) return;
        const { move, swap, directive, policyUpdate } = legalActions(state, side);
        const kinds = [move, move, swap, directive, policyUpdate].map((list, k) => ({ list, inject: k === 1 })).filter((x) => x.list.length > 0);
        const kind = kinds[c(1) % Math.max(1, kinds.length)];
        const picked = kind?.list[c(2) % kind.list.length];
        const action = picked === undefined ? { kind: 'none' as const } : kind?.inject === true ? withInjection(state, side, picked, c(3)) : picked;
        cmd[side] = { temperature: (c(0) % 5) as Temperature, action };
      });
      return cmd;
    },
  };
}

/** A scripted command source built from fast-check's seeded random choices. */
export const arbScriptedCommands: fc.Arbitrary<CommandSource> = fc
  .array(fc.integer({ min: 0, max: 0xffff }), { minLength: ROUNDS * PER_ROUND, maxLength: ROUNDS * PER_ROUND })
  .map(scriptedFrom);
