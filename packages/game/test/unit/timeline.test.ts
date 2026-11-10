import { simulate, type BattleEvent } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { mapEvents, type MapContext, type UiStep } from '../../src/battle/event-steps.js';
import { HIT_STOP_MS, roundBudgetMs, stepMs, timeline } from '../../src/battle/timeline.js';
import { rivalBattle, trainerBattle, wildBattle } from '../../src/content/battles.js';
import { STARTERS } from '../../src/flow/flow.js';

const ctx: MapContext = { name: (i) => `#${i}`, moveName: (m) => m };
const total = (steps: readonly UiStep[], speed: 1 | 2) => timeline(steps, speed).reduce((n, t) => n + t.ms, 0);

function rounds(events: readonly BattleEvent[]): BattleEvent[][] {
  const out: BattleEvent[][] = [];
  for (const e of events) {
    if (e.type === 'RoundStart' || out.length === 0) out.push([]);
    out[out.length - 1]?.push(e);
  }
  return out;
}

describe('playback timeline', () => {
  it('the hit-stop is 2–4 frames at 60 fps at either speed', () => {
    for (const speed of [1, 2] as const) {
      expect(HIT_STOP_MS[speed]).toBeGreaterThanOrEqual(2 * (1000 / 60) - 1);
      expect(HIT_STOP_MS[speed]).toBeLessThanOrEqual(4 * (1000 / 60) + 1);
    }
  });

  it('2x is about twice as fast as 1x', () => {
    const steps: UiStep[] = [{ kind: 'text', text: 'x', weight: 'major' }, { kind: 'windup', actor: 0 }, { kind: 'hp', target: 1, hp: 3 }];
    for (const s of steps) expect(stepMs(s, 2)).toBeLessThan(stepMs(s, 1));
  });

  it('keeps order and leaves a short round untouched', () => {
    const steps: UiStep[] = [{ kind: 'text', text: 'a', weight: 'major' }, { kind: 'hit', target: 1 }, { kind: 'hp', target: 1, hp: 2 }];
    const t = timeline(steps, 1);
    expect(t.map((x) => x.step)).toEqual(steps);
    expect(t.map((x) => x.ms)).toEqual(steps.map((s) => stepMs(s, 1)));
  });

  it('squeezes a long round into the budget without shortening the hit-stop', () => {
    const steps: UiStep[] = Array.from({ length: 12 }, (): UiStep[] => [{ kind: 'text', text: 'hit', weight: 'major' }, { kind: 'hit', target: 1 }, { kind: 'hp', target: 1, hp: 1 }]).flat();
    for (const speed of [1, 2] as const) {
      const t = timeline(steps, speed);
      expect(t.reduce((n, x) => n + x.ms, 0)).toBeLessThanOrEqual(roundBudgetMs(speed));
      for (const x of t) if (x.step.kind === 'hit') expect(x.ms).toBe(HIT_STOP_MS[speed]);
    }
  });

  it('every round of every v0 battle plays in at most 1.5 s at 1x and 0.75 s at 2x', () => {
    let checked = 0;
    for (const s of STARTERS) {
      for (const def of [rivalBattle(s, 0), rivalBattle(s, 2), wildBattle(s, 0), trainerBattle(s, 'spinUp', 'tutorial.c', 0)]) {
        for (const round of rounds(simulate(def.setup, def.seed, { kind: 'autopilot' }).events)) {
          const steps = mapEvents(round, ctx);
          expect(total(steps, 1)).toBeLessThanOrEqual(1500);
          expect(total(steps, 2)).toBeLessThanOrEqual(750);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
