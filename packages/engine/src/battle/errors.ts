import { moveDef } from '../content/moves.js';
import type { OrchestratorAction, RoundCommand, SideCommand } from './log.js';
import { holdsLiveSlot, isHeadless, legalTarget } from './order.js';
import type { BattleState, CreatureState, SideId } from './state.js';

/**
 * A caller mistake in a RoundCommand (spec §7). `submitRound` returns it as `{ error }` and leaves the
 * input state untouched; it never throws for these. `actorSkipped` (commanding a creature that must
 * skip, e.g. one charging a move) is raised by the tasks that add those skips (A12b).
 */
export type CommandError = {
  code: 'invalidCommand' | 'unknownMove' | 'illegalTarget' | 'actorSkipped' | 'directiveOnFainted' | 'notOrchestratorMove' | 'battleEnded';
  message: string;
};

const SIDES: readonly SideId[] = ['a', 'b'];

function err(code: CommandError['code'], message: string): CommandError {
  return { code, message };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const num = (v: unknown): boolean => typeof v === 'number';
const str = (v: unknown): boolean => typeof v === 'string';

/** The fields each action kind needs, by type (Ruling 33). */
function actionShapeOk(a: Record<string, unknown>): boolean {
  switch (a.kind) {
    case 'move':
      return str(a.moveId) && num(a.target) && (a.injection === undefined || (isObject(a.injection) && str(a.injection.moveId) && num(a.injection.target)));
    case 'directive':
      return num(a.subagent) && str(a.moveId) && num(a.target);
    case 'policyUpdate':
      return a.card !== undefined && a.card !== null;
    case 'swap':
      return num(a.out) && num(a.in);
    case 'none':
      return true;
    default:
      return false;
  }
}

/** invalidCommand: temperature outside the integers 0..4, or a malformed action. */
function shapeError(sc: unknown): CommandError | null {
  if (!isObject(sc)) return err('invalidCommand', 'a side command must be an object');
  const t = sc.temperature;
  if (typeof t !== 'number' || !Number.isSafeInteger(t) || t < 0 || t > 4) {
    return err('invalidCommand', `temperature must be an integer in 0..4, got ${String(t)}`);
  }
  if (!isObject(sc.action) || !actionShapeOk(sc.action)) return err('invalidCommand', 'malformed action (unknown kind or missing fields)');
  return null;
}

function creatureAt(state: BattleState, index: number): CreatureState | null {
  return Number.isSafeInteger(index) ? (state.creatures[index] ?? null) : null;
}

/** A move the user knows, aimed at a target legal for that move's target kind. */
function checkMove(state: BattleState, user: CreatureState, moveId: string, target: number): CommandError | null {
  const def = moveDef(moveId);
  if (def === null || !user.moves.includes(moveId)) return err('unknownMove', `${user.id} does not know ${moveId}`);
  if (!legalTarget(state, user, def, target)) {
    return err('illegalTarget', `${user.id}: ${String(target)} is not a living on-field ${def.target} target for ${moveId}`);
  }
  return null;
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
      if (sub === null || sub.side !== side || sub.isOrchestrator) {
        return err('illegalTarget', `directive: ${String(action.subagent)} is not an allied subagent`);
      }
      if (sub.fainted || !holdsLiveSlot(state, sub)) return err('directiveOnFainted', `directive: ${sub.id} is fainted or not active`);
      return checkMove(state, sub, action.moveId, action.target);
    }
    case 'swap': {
      const out = creatureAt(state, action.out);
      if (out === null || out.side !== side || !holdsLiveSlot(state, out)) {
        return err('illegalTarget', `swap: ${String(action.out)} is not an allied active creature`);
      }
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

/** A headless side's command is accepted and ignored entirely (Ruling 36): only its shape is checked. */
function semanticError(state: BattleState, side: SideId, sc: SideCommand): CommandError | null {
  if (isHeadless(state, side)) return null;
  const orch = state.creatures.find((c) => c.side === side && c.isOrchestrator);
  return orch === undefined ? null : checkAction(state, side, orch, sc.action);
}

/** The first problem with a RoundCommand against `state` (not modified), or null when it is legal. Side A is checked first. */
export function validateCommand(state: BattleState, cmd: RoundCommand): CommandError | null {
  if (state.ended) return err('battleEnded', `the battle ended in round ${state.round}`);
  for (const side of SIDES) {
    const raw: unknown = cmd[side];
    if (raw === undefined) continue;
    const e = shapeError(raw) ?? semanticError(state, side, raw as SideCommand);
    if (e !== null) return { code: e.code, message: `side ${side}: ${e.message}` };
  }
  return null;
}
