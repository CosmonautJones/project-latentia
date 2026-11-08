import { describe, expect, it } from 'vitest';
import { STATUS_IDS, STATUSES } from '../../src/content/statuses.js';

describe('statuses', () => {
  it('lists the eight statuses', () => {
    expect([...STATUS_IDS]).toEqual(['hallucinating', 'promptInjected', 'rateLimited', 'overfit', 'glazed', 'deprecated', 'quantized', 'drift']);
  });

  it('durations and major flags', () => {
    expect(STATUSES.hallucinating).toEqual({ major: false, durationMin: 2, durationMax: 4 });
    expect(STATUSES.promptInjected).toEqual({ major: false, durationMin: 1, durationMax: 1 });
    expect(STATUSES.rateLimited).toEqual({ major: true, durationMin: 3, durationMax: 3 });
    expect(STATUSES.overfit).toEqual({ major: false, durationMin: 2, durationMax: 2 });
    expect(STATUSES.glazed).toEqual({ major: false, durationMin: 3, durationMax: 3 });
    expect(STATUSES.deprecated).toEqual({ major: true, durationMin: 3, durationMax: 3 });
    expect(STATUSES.quantized).toEqual({ major: true, durationMin: 4, durationMax: 4 });
    expect(STATUSES.drift).toEqual({ major: false, durationMin: 0, durationMax: 0 });
  });

  it('exactly three majors', () => {
    expect(STATUS_IDS.filter((s) => STATUSES[s].major)).toEqual(['rateLimited', 'deprecated', 'quantized']);
  });
});
