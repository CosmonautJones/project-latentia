// How long each UI step plays, and the per-round budget: a turn resolves visibly in at most 1.5 s at 1× and half
// that at 2× (plan "Quality bar"). The hit-stop is a fixed number of frames; everything else scales down together
// when a busy round (multi-hits, statuses) would run over.

import type { UiStep } from './event-steps.js';

export type Speed = 1 | 2;

const FRAME_MS = 1000 / 60;
/** Hit-stop: 3 frames at 1×, 2 at 2× (bible: 2–4 frames). */
export const HIT_STOP_MS: Readonly<Record<Speed, number>> = { 1: Math.round(3 * FRAME_MS), 2: Math.round(2 * FRAME_MS) };

/** Under the 1.5 s bar with room for a frame or two of scene overhead. */
export const roundBudgetMs = (speed: Speed): number => (speed === 1 ? 1400 : 700);

const BASE_MS: Readonly<Record<Exclude<UiStep['kind'], 'text' | 'hit'>, number>> = {
  windup: 130,
  hp: 220,
  status: 100,
  drift: 100,
  context: 40,
  faint: 320,
  swap: 260,
  trace: 0,
  intents: 0,
  actor: 0,
  round: 0,
  end: 0,
  beat: 0,
};

const TEXT_MS = { major: 320, minor: 170 } as const;

export function stepMs(step: UiStep, speed: Speed): number {
  if (step.kind === 'hit') return HIT_STOP_MS[speed];
  const base = step.kind === 'text' ? TEXT_MS[step.weight] : BASE_MS[step.kind];
  return Math.round(base / speed);
}

export interface TimedStep {
  readonly step: UiStep;
  readonly ms: number;
}

/** The round's steps with their durations, in order, fitted into the round budget. */
export function timeline(steps: readonly UiStep[], speed: Speed): TimedStep[] {
  const base = steps.map((step) => ({ step, ms: stepMs(step, speed) }));
  const fixed = base.filter((t) => t.step.kind === 'hit').reduce((n, t) => n + t.ms, 0);
  const flex = base.reduce((n, t) => n + t.ms, 0) - fixed;
  const room = Math.max(0, roundBudgetMs(speed) - fixed);
  if (flex <= room) return base;
  const scale = room / flex;
  return base.map((t) => (t.step.kind === 'hit' ? t : { step: t.step, ms: Math.floor(t.ms * scale) }));
}
