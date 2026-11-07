import { STATUSES } from '../content/statuses.js';
import type { StatusId } from '../content/ids.js';
import type { BattleEvent } from '../events/types.js';
import { EngineInvariantError } from '../math/bp.js';
import { hi } from '../rng/draws.js';

/**
 * `source` is the glazer's index for Glazed, and the last-hit target's index for Overfit.
 * `injected` is the move and target fixed when Prompt Injected was applied.
 */
export type StatusInstance = {
  id: StatusId;
  remaining: number;
  source?: number;
  injected?: { moveId: string; target: number };
};

/** Minimal plain-data shape the status unit needs; CreatureState extends it. */
export type StatusHolder = {
  index: number;
  statuses: StatusInstance[];
  stages: Record<string, number>;
  isOrchestrator: boolean;
};

export const OVERFIT_SAME_TARGET_BP = 11500;
export const OVERFIT_OTHER_TARGET_BP = 7000;
export const GLAZED_BP = 7000;

/** Duration in rounds: `durationMin + hi(d6, max - min + 1)`, or `durationMin` when fixed. */
export function rollDuration(id: StatusId, d6: number): number {
  const def = STATUSES[id];
  const span = def.durationMax - def.durationMin;
  return span === 0 ? def.durationMin : def.durationMin + hi(d6, span + 1);
}

export function hasStatus(h: StatusHolder, id: StatusId): boolean {
  return h.statuses.some((s) => s.id === id);
}

/** Apply a status with an already-decided duration. Drift belongs to the context unit and throws here. */
export function applyStatus(h: StatusHolder, inst: StatusInstance, round: number): BattleEvent[] {
  if (inst.id === 'drift') {
    throw new EngineInvariantError('Drift is managed by the context unit, not applyStatus', { round, actor: h.index });
  }
  if (!Number.isSafeInteger(inst.remaining) || inst.remaining < 1) {
    throw new EngineInvariantError(`status ${inst.id} needs a positive integer duration: ${String(inst.remaining)}`, {
      round,
      actor: h.index,
    });
  }
  const blocked =
    hasStatus(h, inst.id) || (STATUSES[inst.id].major && h.statuses.some((s) => STATUSES[s.id].major));
  if (blocked) {
    return [{ round, type: 'StatusBlocked', target: h.index, status: inst.id }];
  }
  const copy: StatusInstance = { ...inst };
  if (inst.injected) copy.injected = { ...inst.injected };
  h.statuses.push(copy);
  return [{ round, type: 'StatusApplied', target: h.index, status: inst.id, rounds: inst.remaining }];
}

/**
 * Called by the resolver when the victim's next action actually resolves; skipped actions do not consume it,
 * and fainting/benching clears it (handled by later tasks). Removes Prompt Injected if held, emits
 * StatusExpired and returns the stored choice; `{ injected: null, events: [] }` when not held.
 */
export function consumeInjection(
  h: StatusHolder,
  round: number,
): { injected: { moveId: string; target: number } | null; events: BattleEvent[] } {
  const at = h.statuses.findIndex((s) => s.id === 'promptInjected');
  const found = h.statuses[at];
  if (!found) return { injected: null, events: [] };
  h.statuses.splice(at, 1);
  return {
    injected: found.injected ?? null,
    events: [{ round, type: 'StatusExpired', target: h.index, status: 'promptInjected' }],
  };
}

export function cureStatus(h: StatusHolder, id: StatusId, round: number): BattleEvent[] {
  const at = h.statuses.findIndex((s) => s.id === id);
  if (at < 0) return [];
  h.statuses.splice(at, 1);
  return [{ round, type: 'StatusCured', target: h.index, status: id }];
}

/** Outgoing damage multipliers (basis points) from the attacker's statuses against `targetIndex`. */
export function statusDamageMods(h: StatusHolder, targetIndex: number): { overfit?: number; glazed?: number } {
  const mods: { overfit?: number; glazed?: number } = {};
  for (const s of h.statuses) {
    if (s.id === 'overfit') {
      mods.overfit = s.source === targetIndex ? OVERFIT_SAME_TARGET_BP : OVERFIT_OTHER_TARGET_BP;
    } else if (s.id === 'glazed' && s.source === targetIndex) {
      mods.glazed = GLAZED_BP;
    }
  }
  return mods;
}

/** Quantized: all stages -1 and move costs -1 (callers floor costs at 0) while held. */
export function quantizedAdjust(h: StatusHolder): { stageDelta: -1; costDelta: -1 } | null {
  return hasStatus(h, 'quantized') ? { stageDelta: -1, costDelta: -1 } : null;
}
