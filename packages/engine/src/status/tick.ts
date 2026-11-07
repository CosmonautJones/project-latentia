import { STATUSES } from '../content/statuses.js';
import type { BattleEvent } from '../events/types.js';
import type { StatusHolder, StatusInstance } from './apply.js';

/**
 * End-of-round countdown for timed statuses (Drift has no duration and is skipped). At 0 a status expires and
 * is removed. Deprecated instead reports `forceBench` (a subagent with a bench) or `ko` (an orchestrator, or
 * no bench) and is removed without a StatusExpired event; the caller emits the resulting Swapped/Fainted.
 */
export function tickStatuses(
  h: StatusHolder,
  round: number,
  hasBench: boolean,
): { events: BattleEvent[]; forceBench: boolean; ko: boolean } {
  const events: BattleEvent[] = [];
  const kept: StatusInstance[] = [];
  let forceBench = false;
  let ko = false;
  for (const s of h.statuses) {
    if (STATUSES[s.id].durationMax === 0) {
      kept.push(s);
      continue;
    }
    s.remaining -= 1;
    if (s.remaining > 0) {
      kept.push(s);
    } else if (s.id === 'deprecated') {
      if (h.isOrchestrator || !hasBench) ko = true;
      else forceBench = true;
    } else {
      events.push({ round, type: 'StatusExpired', target: h.index, status: s.id });
    }
  }
  h.statuses = kept;
  return { events, forceBench, ko };
}
