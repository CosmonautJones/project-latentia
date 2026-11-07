import { describe, expect, it } from 'vitest';
import { EngineInvariantError } from '../../src/math/bp.js';
import { applyStatus, cureStatus, quantizedAdjust, rollDuration, statusDamageMods } from '../../src/status/apply.js';
import type { StatusHolder, StatusInstance } from '../../src/status/apply.js';

const holder = (statuses: StatusInstance[] = [], extra: Partial<StatusHolder> = {}): StatusHolder => ({
  index: 2,
  statuses,
  stages: {},
  isOrchestrator: false,
  ...extra,
});
const inst = (id: StatusInstance['id'], remaining: number, source?: number): StatusInstance =>
  source === undefined ? { id, remaining } : { id, remaining, source };

describe('applyStatus', () => {
  it('applies a status and emits StatusApplied', () => {
    const h = holder();
    const ev = applyStatus(h, inst('hallucinating', 3), 4);
    expect(ev).toEqual([{ round: 4, type: 'StatusApplied', target: 2, status: 'hallucinating', rounds: 3 }]);
    expect(h.statuses).toEqual([inst('hallucinating', 3)]);
  });

  it('Rate Limited blocks Quantized', () => {
    const h = holder([inst('rateLimited', 3)]);
    const ev = applyStatus(h, inst('quantized', 4), 1);
    expect(ev).toEqual([{ round: 1, type: 'StatusBlocked', target: 2, status: 'quantized' }]);
    expect(h.statuses.map((s) => s.id)).toEqual(['rateLimited']);
  });

  it('Hallucinating and Glazed stack', () => {
    const h = holder();
    applyStatus(h, inst('hallucinating', 2), 1);
    const ev = applyStatus(h, inst('glazed', 3, 0), 1);
    expect(ev[0]?.type).toBe('StatusApplied');
    expect(h.statuses.map((s) => s.id)).toEqual(['hallucinating', 'glazed']);
  });

  it('re-applying Hallucinating is blocked', () => {
    const h = holder([inst('hallucinating', 2)]);
    const ev = applyStatus(h, inst('hallucinating', 4), 1);
    expect(ev).toEqual([{ round: 1, type: 'StatusBlocked', target: 2, status: 'hallucinating' }]);
    expect(h.statuses).toEqual([inst('hallucinating', 2)]);
  });

  it('re-applying the same major status is blocked', () => {
    const h = holder([inst('deprecated', 2)]);
    expect(applyStatus(h, inst('deprecated', 3), 1)[0]?.type).toBe('StatusBlocked');
  });

  it('Drift is managed by context, so applying it throws', () => {
    const h = holder();
    expect(() => applyStatus(h, inst('drift', 0), 1)).toThrow(EngineInvariantError);
  });

  it('Drift held does not block other statuses', () => {
    const h = holder([inst('drift', 0)]);
    expect(applyStatus(h, inst('rateLimited', 3), 1)[0]?.type).toBe('StatusApplied');
  });
});

describe('rollDuration', () => {
  it('Hallucinating is 2 + hi(d6, 3), i.e. 2-4', () => {
    for (let k = 0; k < 3; k++) expect(rollDuration('hallucinating', k << 16)).toBe(2 + k);
  });
  it('fixed durations ignore the draw', () => {
    expect(rollDuration('rateLimited', 0xffffffff)).toBe(3);
    expect(rollDuration('quantized', 12345)).toBe(4);
    expect(rollDuration('promptInjected', 99)).toBe(1);
  });
});

describe('cureStatus', () => {
  it('removes a held status and emits StatusCured', () => {
    const h = holder([inst('glazed', 2, 0), inst('hallucinating', 2)]);
    expect(cureStatus(h, 'glazed', 5)).toEqual([{ round: 5, type: 'StatusCured', target: 2, status: 'glazed' }]);
    expect(h.statuses.map((s) => s.id)).toEqual(['hallucinating']);
  });
  it('emits nothing when not held', () => {
    expect(cureStatus(holder(), 'glazed', 5)).toEqual([]);
  });
});

describe('statusDamageMods', () => {
  it('Overfit is 11500 vs the last-hit target and 7000 vs others', () => {
    const h = holder([inst('overfit', 2, 3)]);
    expect(statusDamageMods(h, 3)).toEqual({ overfit: 11500 });
    expect(statusDamageMods(h, 4)).toEqual({ overfit: 7000 });
  });
  it('Overfit with no last target is 7000', () => {
    expect(statusDamageMods(holder([inst('overfit', 2)]), 3)).toEqual({ overfit: 7000 });
  });
  it('Glazed is 7000 vs its glazer only', () => {
    const h = holder([inst('glazed', 3, 5)]);
    expect(statusDamageMods(h, 5)).toEqual({ glazed: 7000 });
    expect(statusDamageMods(h, 4)).toEqual({});
  });
  it('no statuses gives no mods', () => {
    expect(statusDamageMods(holder(), 0)).toEqual({});
  });
});

describe('quantizedAdjust', () => {
  it('is -1/-1 while held, else null', () => {
    expect(quantizedAdjust(holder([inst('quantized', 4)]))).toEqual({ stageDelta: -1, costDelta: -1 });
    expect(quantizedAdjust(holder())).toBeNull();
  });
});
