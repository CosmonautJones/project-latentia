// The flow as a graph: every step reachable, no dead ends, every saved state consistent (split from flow.test.ts).

import { describe, expect, it } from 'vitest';
import { BATTLE_STEPS, isConsistentProgress, OVERWORLD_STEPS, STEPS, sceneForStep, toProgress, transition, type FlowState } from '../../src/flow/flow.js';
import { fight, key, progress, reachable, run, successors } from './flow-fixtures.js';

describe('flow: graph properties', () => {
  const all = reachable();

  it('every step is reachable from a fresh boot', () => {
    expect(new Set(all.map((s) => s.step))).toEqual(new Set(STEPS));
  });

  it('no dead ends: every reachable state can reach the end card, and the end card returns to the title', () => {
    for (const start of all) {
      const seen = new Set<string>();
      const queue = [start];
      let reachesEnd = false;
      while (queue.length > 0 && !reachesEnd) {
        const s = queue.shift() as FlowState;
        if (s.step === 'end') reachesEnd = true;
        if (seen.has(key(s))) continue;
        seen.add(key(s));
        queue.push(...successors(s));
      }
      expect(reachesEnd, `stuck from ${key(start)}`).toBe(true);
    }
    const end = all.find((s) => s.step === 'end') as FlowState;
    expect(run([{ type: 'backToTitle' }], end).step).toBe('title');
  });

  it('every reachable state outside the title saves as consistent progress', () => {
    for (const s of all.filter((x) => x.step !== 'title')) {
      expect(isConsistentProgress(toProgress(s)), key(s)).toBe(true);
    }
  });

  it('every battle step can be lost without a dead end', () => {
    for (const step of BATTLE_STEPS) {
      const at = all.find((s) => s.step === step) as FlowState;
      expect(transition(at, { type: 'battleLost' }).ok, step).toBe(true);
    }
  });

  it('every step maps to a scene', () => {
    for (const step of STEPS) expect(sceneForStep(step)).toMatch(/^(Title|Overworld|Battle|Distill|Debrief|End)$/);
    expect(sceneForStep('lab')).toBe('Overworld');
    expect(sceneForStep('rival')).toBe('Battle');
    expect(sceneForStep('distill')).toBe('Distill');
    expect(sceneForStep('debrief')).toBe('Debrief');
    expect(OVERWORLD_STEPS.filter((st) => sceneForStep(st) !== 'Overworld')).toEqual([]);
    expect(STEPS.filter((st) => sceneForStep(st) === 'Overworld')).toEqual([...OVERWORLD_STEPS]);
  });
});

describe('isConsistentProgress', () => {
  it('rejects a title step, a missing starter after the lab, and a tutorial card on the graft path', () => {
    expect(isConsistentProgress(progress({ step: 'title' }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'rival' }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'trainer', starter: 'sagelet', distill: 'graft', tutorialCardId: 'tutorial.a' }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'trainer', starter: 'sagelet', distill: 'spinUp' }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'lab' }))).toBe(true);
    expect(isConsistentProgress(progress({ step: 'forest', starter: 'sagelet', distill: 'spinUp' }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'forest', starter: 'sagelet', distill: 'spinUp', tutorialCardId: 'tutorial.a' }))).toBe(true);
    expect(isConsistentProgress(progress({ step: 'forest', starter: 'sagelet', distill: 'graft' }))).toBe(true);
    expect(isConsistentProgress(progress({ step: 'forest', starter: 'sagelet' }))).toBe(false);
  });

  it('the debrief needs its fight, the end card needs a beaten trainer, and neither exists before the trainer', () => {
    const graft = { starter: 'sagelet', distill: 'graft' } as const;
    expect(isConsistentProgress(progress({ step: 'debrief', ...graft }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'debrief', ...graft, lastFight: fight({ cardId: null }) }))).toBe(true);
    expect(isConsistentProgress(progress({ step: 'end', ...graft }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'end', ...graft, trainerBeaten: true }))).toBe(true);
    expect(isConsistentProgress(progress({ step: 'forest', ...graft, trainerBeaten: true }))).toBe(false);
    expect(isConsistentProgress(progress({ step: 'forest', ...graft, lastFight: fight({ cardId: null }) }))).toBe(false);
  });
});
