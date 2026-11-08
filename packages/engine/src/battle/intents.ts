import type { BattleEvent } from '../events/types.js';
import { drawRoundStart } from '../rng/draws.js';
import type { ActionEntry } from './order.js';
import { autopilotDrives, orchestratorEntry, plansAsSubagent, subagentEntry, type Intent } from './plan.js';
import type { BattleState } from './state.js';

// Intents (spec §4 getIntents, §5 step 2): the listings of planned intents — the IntentsPlanned event and the
// next-round preview. Planning itself is plan.ts.

export type { Intent } from './plan.js';

function intentOf(actor: number, p: Pick<ActionEntry, 'moveId' | 'target' | 'cardId'>): Intent {
  return { actor, moveId: p.moveId, target: p.target, cardId: p.cardId ?? null, replanned: false };
}

/**
 * IntentsPlanned (spec §5 step 2; Ruling 96): the intents of the subagent entries and of the Autopilot-driven
 * orchestrator entries (those marked `autopilot`), in canonical order. A commanded, uncommanded-without-
 * Autopilot, headless or charging orchestrator is not listed.
 */
export function intentsPlanned(state: BattleState, entries: readonly ActionEntry[]): BattleEvent {
  const listed = (e: ActionEntry): boolean => state.creatures[e.actor]?.isOrchestrator === false || e.autopilot === true;
  const intents = entries.filter(listed).map((e) => {
    const { actor, moveId, target, cardId } = intentOf(e.actor, e);
    return { actor, moveId, target, cardId };
  });
  return { round: state.round, type: 'IntentsPlanned', intents };
}

/**
 * The next round's intents, before submitRound (Rulings 79, 82, 96): every planned subagent's, and every orchestrator
 * its Autopilot will drive assuming the side sends no command next round. The round-start draws are taken for every
 * creature in canonical order from a CLONE of the rng and each view is built for round `state.round + 1`, so the
 * intents equal what submitRound plans for `{}` when nothing changes. The state is not modified. Empty once the
 * battle has ended.
 */
export function getIntents(state: BattleState): Intent[] {
  if (state.ended) return [];
  const rng = structuredClone(state.rng);
  const draws = state.creatures.map(() => drawRoundStart(rng));
  const round = state.round + 1;
  return state.creatures
    .filter((c) => plansAsSubagent(state, c) || autopilotDrives(state, c, {}))
    .map((c) => {
      const rs = draws[c.index] ?? null;
      return intentOf(c.index, c.isOrchestrator ? orchestratorEntry(state, c, {}, rs, round) : subagentEntry(state, c, rs, round));
    });
}
