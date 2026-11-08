import { moveDef } from '../content/moves.js';
import { moveDisabledByStatus } from '../status/apply.js';
import type { Card } from '../cards/model.js';
import type { OrchestratorAction, RoundCommand, SideCommand } from './log.js';
import { holdsLiveSlot, isHeadless, legalTarget } from './order.js';
import type { BattleState, CreatureState, SideId } from './state.js';
import { cardShapeOk, policyCardErrors } from './validate-deck.js';

/**
 * A caller mistake in a RoundCommand (spec §7). `submitRound` returns it as `{ error }` and leaves the
 * input state untouched; it never throws for these. `actorSkipped`: any action but `none` for an
 * orchestrator that is charging a move (its entry is the release, Ruling 13), or a Directive to a charging
 * subagent. `moveDisabled`: a move a held status forbids its user (Glazed / Overfit, Ruling 50), the directed
 * subagent included. An orchestrator cleared by /clear is not an error:
 * its command is accepted and skipped (Ruling 11).
 */
export type CommandError = {
  code: 'invalidCommand' | 'unknownMove' | 'illegalTarget' | 'actorSkipped' | 'moveDisabled' | 'directiveOnFainted' | 'notOrchestratorMove' | 'battleEnded';
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
      return cardShapeOk(a.card);
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

/**
 * invalidCommand for a Policy Update card (its shape is checked with the command's): a card the deck rules reject
 * (policyCardErrors), or an id a card of an allied deck already uses (traces and re-planning name cards by id). A
 * policy in force with the same id is no clash: re-issuing it replaces it.
 */
function policyError(state: BattleState, side: SideId, card: Card): CommandError | null {
  const bad = policyCardErrors(card)[0];
  if (bad !== undefined) return err('invalidCommand', `policyUpdate: ${bad.message}`);
  const clash = state.creatures.find((c) => c.side === side && c.deck !== null && [...c.deck.cards, c.deck.default].some((k) => k.id === card.id));
  return clash === undefined ? null : err('invalidCommand', `policyUpdate: card id ${card.id} is already used by ${clash.id}'s deck`);
}

function checkAction(state: BattleState, side: SideId, orch: CreatureState, action: OrchestratorAction): CommandError | null {
  if (orch.charging !== null && action.kind !== 'none') {
    return err('actorSkipped', `${orch.id} is charging ${orch.charging.moveId}: its action this round is the release (send none)`);
  }
  switch (action.kind) {
    case 'move': {
      const def = moveDef(action.moveId);
      if (def?.orchestratorOnly === true) {
        return err('notOrchestratorMove', `${action.moveId} is a lever: send it as its own command kind, not as a move`);
      }
      const bad = checkMove(state, orch, action.moveId, action.target);
      if (bad !== null || def === null) return bad;
      return moveDisabledByStatus(orch, def, orch.lastMoveId) ? err('moveDisabled', `${orch.id}: a held status forbids ${action.moveId}`) : null;
    }
    case 'directive': {
      const sub = creatureAt(state, action.subagent);
      if (sub === null || sub.side !== side || sub.isOrchestrator) {
        return err('illegalTarget', `directive: ${String(action.subagent)} is not an allied subagent`);
      }
      if (sub.fainted || !holdsLiveSlot(state, sub)) return err('directiveOnFainted', `directive: ${sub.id} is fainted or not active`);
      if (sub.charging !== null) return err('actorSkipped', `directive: ${sub.id} is charging ${sub.charging.moveId}: its action this round is the release`);
      const bad = checkMove(state, sub, action.moveId, action.target);
      const def = moveDef(action.moveId);
      if (bad !== null || def === null) return bad;
      return moveDisabledByStatus(sub, def, sub.lastMoveId) ? err('moveDisabled', `directive: a held status forbids ${sub.id} ${action.moveId}`) : null;
    }
    case 'policyUpdate':
      return policyError(state, side, action.card);
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
    case 'none':
      return null;
  }
}

/**
 * invalidCommand (Ruling 54): a move command's `injection` must name a known move and a canonical index
 * (a safe integer within the roster). Checked for headless sides too, so NaN or fractions never reach state.
 */
function injectionError(state: BattleState, sc: SideCommand): CommandError | null {
  if (sc.action.kind !== 'move' || sc.action.injection === undefined) return null;
  const { moveId, target } = sc.action.injection;
  if (moveDef(moveId) === null) return err('invalidCommand', `injection: unknown move ${moveId}`);
  if (!Number.isSafeInteger(target) || target < 0 || target >= state.creatures.length) {
    return err('invalidCommand', `injection: target ${String(target)} is not a canonical index`);
  }
  return null;
}

/** A headless side's command is accepted and ignored entirely (Ruling 36): only its shape is checked. */
function semanticError(state: BattleState, side: SideId, sc: SideCommand): CommandError | null {
  if (isHeadless(state, side)) return null;
  const orch = state.creatures.find((c) => c.side === side && c.isOrchestrator);
  return orch === undefined ? null : checkAction(state, side, orch, sc.action);
}

/**
 * The first problem with a RoundCommand against `state` (not modified), or null when it is legal. A round
 * command that is not a plain object (null, undefined, a number, a string, an array) is `invalidCommand`
 * (Ruling 78). Side A is checked first.
 */
export function validateCommand(state: BattleState, cmd: RoundCommand): CommandError | null {
  const given: unknown = cmd;
  if (!isObject(given) || Array.isArray(given)) return err('invalidCommand', 'a round command must be an object');
  if (state.ended) return err('battleEnded', `the battle ended in round ${state.round}`);
  for (const side of SIDES) {
    const raw: unknown = cmd[side];
    if (raw === undefined) continue;
    const e = shapeError(raw) ?? injectionError(state, raw as SideCommand) ?? semanticError(state, side, raw as SideCommand);
    if (e !== null) return { code: e.code, message: `side ${side}: ${e.message}` };
  }
  return null;
}
