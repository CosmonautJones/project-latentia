import { describe, expect, it } from 'vitest';
import type { StatusHolder, StatusInstance } from '../../src/status/apply.js';
import { tickStatuses } from '../../src/status/tick.js';

const holder = (statuses: StatusInstance[], isOrchestrator = false): StatusHolder => ({
  index: 1,
  statuses,
  stages: {},
  isOrchestrator,
});

describe('tickStatuses', () => {
  it('decrements timed statuses', () => {
    const h = holder([{ id: 'hallucinating', remaining: 3 }]);
    const r = tickStatuses(h, 2, true);
    expect(r).toEqual({ events: [], forceBench: false, ko: false });
    expect(h.statuses[0]?.remaining).toBe(2);
  });

  it('expires at 0 with StatusExpired and removes it', () => {
    const h = holder([{ id: 'hallucinating', remaining: 1 }, { id: 'glazed', remaining: 3, source: 0 }]);
    const r = tickStatuses(h, 6, true);
    expect(r.events).toEqual([{ round: 6, type: 'StatusExpired', target: 1, status: 'hallucinating' }]);
    expect(h.statuses.map((s) => s.id)).toEqual(['glazed']);
  });

  it('never ticks Drift', () => {
    const h = holder([{ id: 'drift', remaining: 0 }]);
    expect(tickStatuses(h, 1, true).events).toEqual([]);
    expect(h.statuses).toHaveLength(1);
  });

  it('Deprecated at 0 force-benches a subagent with a bench', () => {
    const h = holder([{ id: 'deprecated', remaining: 1 }]);
    const r = tickStatuses(h, 3, true);
    expect(r).toMatchObject({ forceBench: true, ko: false });
    expect(h.statuses).toEqual([]);
  });

  it('Deprecated at 0 KOs an orchestrator', () => {
    const h = holder([{ id: 'deprecated', remaining: 1 }], true);
    expect(tickStatuses(h, 3, true)).toMatchObject({ forceBench: false, ko: true });
  });

  it('Deprecated at 0 KOs a subagent with no bench', () => {
    const h = holder([{ id: 'deprecated', remaining: 1 }]);
    expect(tickStatuses(h, 3, false)).toMatchObject({ forceBench: false, ko: true });
  });

  it('Deprecated still counting down does nothing', () => {
    const h = holder([{ id: 'deprecated', remaining: 3 }]);
    expect(tickStatuses(h, 1, true)).toEqual({ events: [], forceBench: false, ko: false });
    expect(h.statuses[0]?.remaining).toBe(2);
  });
});
