import { STATUS_IDS, type StatusId } from './ids.js';

export { STATUS_IDS };

export interface StatusDef {
  readonly major: boolean;
  readonly durationMin: number;
  readonly durationMax: number;
}

function s(major: boolean, durationMin: number, durationMax: number): StatusDef {
  return Object.freeze({ major, durationMin, durationMax });
}

/** Durations in rounds (Prompt Injected: 1 action). Drift has no duration (0/0). */
export const STATUSES: Readonly<Record<StatusId, StatusDef>> = Object.freeze({
  hallucinating: s(false, 2, 4),
  promptInjected: s(false, 1, 1),
  rateLimited: s(true, 3, 3),
  overfit: s(false, 2, 2),
  glazed: s(false, 3, 3),
  deprecated: s(true, 3, 3),
  quantized: s(true, 4, 4),
  drift: s(false, 0, 0),
});
