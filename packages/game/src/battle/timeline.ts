// When each UI step of a round plays. Two clocks run side by side:
// - Animation (windups, hit-stop, HP drains, faints...) plays in order and fits a budget: at most 1.5 s per round
//   at 1× and half that at 2× (plan "Quality bar"). The hit-stop is a fixed number of frames; everything else
//   scales down together when a busy round would run over.
// - Text: each line stays up for its dwell (a major line about 600 ms at 1×) before the next line may replace it.
//   Animation keeps playing under a line, so a round lasts as long as the longer of the two.
// 2× halves both.

import type { UiStep } from './event-steps.js';

export type Speed = 1 | 2;

const FRAME_MS = 1000 / 60;
/** Hit-stop: 3 frames at 1×, 2 at 2× (bible: 2–4 frames). */
export const HIT_STOP_MS: Readonly<Record<Speed, number>> = { 1: Math.round(3 * FRAME_MS), 2: Math.round(2 * FRAME_MS) };

/** The animation budget per round: under the 1.5 s bar with room for a frame or two of scene overhead. */
export const animBudgetMs = (speed: Speed): number => (speed === 1 ? 1400 : 700);

/** How long a line stays readable at 1× before the next one may replace it. */
export const TEXT_DWELL_MS = { major: 640, minor: 380 } as const;

const BASE_MS: Readonly<Record<Exclude<UiStep['kind'], 'text' | 'hit'>, number>> = {
  windup: 130,
  hp: 220,
  status: 100,
  drift: 100,
  context: 40,
  faint: 320,
  swap: 260,
  reveal: 0,
  trace: 0,
  intents: 0,
  actor: 0,
  round: 0,
  end: 0,
  beat: 0,
};

/** A step's animation time (text has none: it dwells instead). */
export function stepMs(step: UiStep, speed: Speed): number {
  if (step.kind === 'hit') return HIT_STOP_MS[speed];
  if (step.kind === 'text') return 0;
  return Math.round(BASE_MS[step.kind] / speed);
}

export const dwellMs = (weight: 'major' | 'minor', speed: Speed): number => Math.round(TEXT_DWELL_MS[weight] / speed);

export interface TimedStep {
  readonly step: UiStep;
  /** When the step starts, ms from the start of the round. */
  readonly at: number;
  /** Its animation time. */
  readonly ms: number;
}

export interface RoundPlan {
  readonly steps: readonly TimedStep[];
  /** Total animation time (within animBudgetMs). */
  readonly animMs: number;
  /** When the round is over: the last animation has finished and the last line has had its dwell. */
  readonly totalMs: number;
}

export function planRound(steps: readonly UiStep[], speed: Speed): RoundPlan {
  const base = steps.map((step) => stepMs(step, speed));
  const fixed = steps.reduce((n, s, i) => n + (s.kind === 'hit' ? (base[i] ?? 0) : 0), 0);
  const flex = base.reduce((n, ms) => n + ms, 0) - fixed;
  const room = Math.max(0, animBudgetMs(speed) - fixed);
  const scale = flex <= room ? 1 : room / flex;
  let t = 0;
  let textFreeAt = 0;
  let animMs = 0;
  const out: TimedStep[] = steps.map((step, i) => {
    const ms = step.kind === 'hit' || scale === 1 ? (base[i] ?? 0) : Math.floor((base[i] ?? 0) * scale);
    if (step.kind === 'text') {
      t = Math.max(t, textFreeAt);
      textFreeAt = t + dwellMs(step.weight, speed);
      return { step, at: t, ms: 0 };
    }
    const at = t;
    t += ms;
    animMs += ms;
    return { step, at, ms };
  });
  return { steps: out, animMs, totalMs: Math.max(t, textFreeAt) };
}
