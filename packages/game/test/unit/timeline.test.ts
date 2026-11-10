import { simulate, type BattleEvent } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { mapEvents, type MapContext, type UiStep } from '../../src/battle/event-steps.js';
import { animBudgetMs, HIT_STOP_MS, planRound, stepMs, TEXT_DWELL_MS, type RoundPlan } from '../../src/battle/timeline.js';
import { rivalBattle, trainerBattle, wildBattle } from '../../src/content/battles.js';
import { STARTERS } from '../../src/flow/flow.js';

const ctx: MapContext = { name: (i) => `#${i}`, moveName: (m) => m, side: (i) => (i === 1 ? 1 : 0) };

function rounds(events: readonly BattleEvent[]): BattleEvent[][] {
  const out: BattleEvent[][] = [];
  for (const e of events) {
    if (e.type === 'RoundStart' || out.length === 0) out.push([]);
    out[out.length - 1]?.push(e);
  }
  return out;
}

const realRounds = (): UiStep[][] =>
  STARTERS.flatMap((s) =>
    [rivalBattle(s, 0), rivalBattle(s, 2), wildBattle(s, 0), trainerBattle(s, 'spinUp', 'tutorial.c', 0)].flatMap((def) =>
      rounds(simulate(def.setup, def.seed, { kind: 'autopilot' }).events).map((r) => mapEvents(r, ctx)),
    ),
  );

/** Every line stays up for its dwell before the next replaces it, and the last one before the round ends. */
function expectDwell(plan: RoundPlan, speed: 1 | 2): void {
  const texts = plan.steps.filter((t) => t.step.kind === 'text');
  texts.forEach((t, i) => {
    const until = texts[i + 1]?.at ?? plan.totalMs;
    const weight = t.step.kind === 'text' ? t.step.weight : 'minor';
    expect(until - t.at).toBeGreaterThanOrEqual(TEXT_DWELL_MS[weight] / speed - 1);
  });
}

describe('playback timeline', () => {
  it('a major line dwells at least ~600 ms at 1x; 2x halves dwell and animation', () => {
    expect(TEXT_DWELL_MS.major).toBeGreaterThanOrEqual(600);
    const steps: UiStep[] = [{ kind: 'windup', actor: 0 }, { kind: 'hp', target: 1, hp: 3 }, { kind: 'faint', target: 1 }];
    for (const s of steps) expect(stepMs(s, 2)).toBe(Math.round(stepMs(s, 1) / 2));
  });

  it('the hit-stop is 2–4 frames at 60 fps at either speed', () => {
    for (const speed of [1, 2] as const) {
      expect(HIT_STOP_MS[speed]).toBeGreaterThanOrEqual(2 * (1000 / 60) - 1);
      expect(HIT_STOP_MS[speed]).toBeLessThanOrEqual(4 * (1000 / 60) + 1);
    }
  });

  it('keeps order; animation runs on while a line is showing, and the next line waits for the dwell', () => {
    const steps: UiStep[] = [
      { kind: 'text', text: 'A used X!', weight: 'major' },
      { kind: 'windup', actor: 0 },
      { kind: 'hit', target: 1 },
      { kind: 'hp', target: 1, hp: 2 },
      { kind: 'text', text: 'On-distribution!', weight: 'minor' },
    ];
    const plan = planRound(steps, 1);
    expect(plan.steps.map((t) => t.step)).toEqual(steps);
    // The windup starts with the line, not after it.
    expect(plan.steps[1]?.at).toBe(0);
    expect(plan.steps[4]?.at).toBe(TEXT_DWELL_MS.major);
    expect(plan.totalMs).toBe(TEXT_DWELL_MS.major + TEXT_DWELL_MS.minor);
    expect(plan.animMs).toBe(stepMs(steps[1] as UiStep, 1) + HIT_STOP_MS[1] + stepMs(steps[3] as UiStep, 1));
    for (let i = 1; i < plan.steps.length; i++) expect(plan.steps[i]?.at).toBeGreaterThanOrEqual(plan.steps[i - 1]?.at ?? 0);
    expectDwell(plan, 1);
  });

  it('squeezes the animation of a long round into the budget without shortening the hit-stop', () => {
    const steps: UiStep[] = Array.from({ length: 12 }, (): UiStep[] => [{ kind: 'windup', actor: 0 }, { kind: 'hit', target: 1 }, { kind: 'hp', target: 1, hp: 1 }]).flat();
    for (const speed of [1, 2] as const) {
      const plan = planRound(steps, speed);
      expect(plan.animMs).toBeLessThanOrEqual(animBudgetMs(speed));
      for (const x of plan.steps) if (x.step.kind === 'hit') expect(x.ms).toBe(HIT_STOP_MS[speed]);
    }
  });

  it('every round of every v0 battle: animation within 1.5 s at 1x (0.75 s at 2x), and every line gets its dwell', () => {
    const all = realRounds();
    expect(all.length).toBeGreaterThan(20);
    for (const steps of all) {
      for (const speed of [1, 2] as const) {
        const plan = planRound(steps, speed);
        expect(plan.animMs).toBeLessThanOrEqual(speed === 1 ? 1500 : 750);
        expectDwell(plan, speed);
      }
    }
  });
});
