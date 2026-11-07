import { MOVES, type MoveId } from '../content/moves.js';
import type { MoveDef } from '../content/primitives.js';
import type { OrchestratorAction, RoundCommand } from './log.js';
import type { BattleState, CreatureState, SideId } from './state.js';

/**
 * A caller mistake in a RoundCommand (spec §7). `submitRound` returns it as `{ error }` and leaves the
 * input state untouched; it never throws for these. `actorSkipped` (commanding a creature that must
 * skip, e.g. one charging a move) is raised by the tasks that add those skips (A12b).
 */
export type CommandError = {
  code: 'unknownMove' | 'illegalTarget' | 'actorSkipped' | 'directiveOnFainted' | 'notOrchestratorMove' | 'battleEnded';
  message: string;
};

const SIDES: readonly SideId[] = ['a', 'b'];

export function moveDef(moveId: string): MoveDef | null {
  return Object.prototype.hasOwnProperty.call(MOVES, moveId) ? MOVES[moveId as MoveId] : null;
}

function creatureAt(state: BattleState, index: number): CreatureState | null {
  return Number.isSafeInteger(index) ? (state.creatures[index] ?? null) : null;
}

function err(code: CommandError['code'], message: string): CommandError {
  return { code, message };
}

function livingTarget(state: BattleState, who: string, target: number): CommandError | null {
  const t = creatureAt(state, target);
  if (t === null || t.fainted) return err('illegalTarget', `${who}: target ${String(target)} is not a living creature`);
  return null;
}

/** A move id the user knows, aimed at the canonical index of a living creature. */
function checkMove(state: BattleState, user: CreatureState, moveId: string, target: number): CommandError | null {
  if (!user.moves.includes(moveId)) return err('unknownMove', `${user.id} does not know ${moveId}`);
  return livingTarget(state, user.id, target);
}

function checkAction(state: BattleState, side: SideId, orch: CreatureState, action: OrchestratorAction): CommandError | null {
  switch (action.kind) {
    case 'move': {
      if (moveDef(action.moveId)?.orchestratorOnly === true) {
        return err('notOrchestratorMove', `${action.moveId} is a lever: send it as its own command kind, not as a move`);
      }
      return checkMove(state, orch, action.moveId, action.target);
    }
    case 'directive': {
      const sub = creatureAt(state, action.subagent);
      if (sub === null || sub.side !== side) return err('illegalTarget', `directive: ${String(action.subagent)} is not an allied creature`);
      if (sub.fainted || sub.slot !== 'active') return err('directiveOnFainted', `directive: ${sub.id} is fainted or not active`);
      return checkMove(state, sub, action.moveId, action.target);
    }
    case 'swap': {
      const out = creatureAt(state, action.out);
      if (out === null || out.side !== side || out.slot !== 'active') return err('illegalTarget', `swap: ${String(action.out)} is not an allied active creature`);
      const inc = creatureAt(state, action.in);
      if (inc === null || inc.side !== side || inc.slot !== 'bench' || inc.fainted) {
        return err('illegalTarget', `swap: ${String(action.in)} is not a living allied bench creature`);
      }
      return null;
    }
    case 'policyUpdate':
    case 'none':
      return null;
  }
}

/** The first problem with a RoundCommand against `state` (not modified), or null when it is legal. */
export function validateCommand(state: BattleState, cmd: RoundCommand): CommandError | null {
  if (state.ended) return err('battleEnded', `the battle ended in round ${state.round}`);
  for (const side of SIDES) {
    const sc = cmd[side];
    if (sc === undefined) continue;
    const orch = state.creatures.find((c) => c.side === side && c.isOrchestrator);
    if (orch === undefined) continue; // unreachable: assertInvariants guarantees one orchestrator per side
    const e = checkAction(state, side, orch, sc.action);
    if (e !== null) return { code: e.code, message: `side ${side}: ${e.message}` };
  }
  return null;
}
