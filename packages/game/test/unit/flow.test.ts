import { describe, expect, it } from 'vitest';
import {
  BATTLE_STEPS,
  initialFlow,
  isConsistentProgress,
  OVERWORLD_STEPS,
  STARTERS,
  STEPS,
  sceneForStep,
  toProgress,
  transition,
  type FlowEvent,
  type FlowState,
  type Step,
} from '../../src/flow/flow.js';

const run = (events: FlowEvent[], from: FlowState = initialFlow()): FlowState => {
  let s = from;
  for (const e of events) {
    const r = transition(s, e);
    if (!r.ok) throw new Error(`${s.step} --${e.type}--> rejected: ${r.error}`);
    s = r.state;
  }
  return s;
};

// Every event shape the flow knows, with every payload choice: used to explore the whole graph.
const ALL_EVENTS: FlowEvent[] = [
  { type: 'newGame' },
  ...STARTERS.map((starter): FlowEvent => ({ type: 'starterPicked', starter })),
  { type: 'battleWon' },
  { type: 'battleLost' },
  { type: 'reachedTrailhead' },
  { type: 'distillChosen', choice: 'spinUp' },
  { type: 'distillChosen', choice: 'graft' },
  { type: 'cardChosen', cardId: 'tutorial.a' },
  { type: 'trainerEngaged' },
  { type: 'backToTitle' },
];

const key = (s: FlowState) => JSON.stringify(toProgress(s));

const successors = (s: FlowState): FlowState[] =>
  ALL_EVENTS.flatMap((e) => {
    const r = transition(s, e);
    return r.ok ? [r.state] : [];
  });

const reachable = (): FlowState[] => {
  const seen = new Map<string, FlowState>();
  const queue = [initialFlow()];
  while (queue.length > 0) {
    const s = queue.shift() as FlowState;
    if (seen.has(key(s))) continue;
    seen.set(key(s), s);
    queue.push(...successors(s));
  }
  return [...seen.values()];
};

describe('flow: the happy paths', () => {
  it('spin-up path: title → lab → rival → walk → wild → distill → card tutorial → forest → trainer → end → title', () => {
    const steps: Step[] = [];
    let s = initialFlow();
    steps.push(s.step);
    for (const e of [
      { type: 'newGame' },
      { type: 'starterPicked', starter: 'blitzr' },
      { type: 'battleWon' },
      { type: 'reachedTrailhead' },
      { type: 'battleWon' },
      { type: 'distillChosen', choice: 'spinUp' },
      { type: 'cardChosen', cardId: 'tutorial.b' },
      { type: 'trainerEngaged' },
      { type: 'battleWon' },
      { type: 'backToTitle' },
    ] satisfies FlowEvent[]) {
      s = run([e], s);
      steps.push(s.step);
    }
    expect(steps).toEqual(['title', 'lab', 'rival', 'walk', 'wild', 'distill', 'cardTutorial', 'forest', 'trainer', 'end', 'title']);
  });

  it('graft path skips the card tutorial and walks straight on into the forest', () => {
    const s = run([
      { type: 'newGame' },
      { type: 'starterPicked', starter: 'sagelet' },
      { type: 'battleWon' },
      { type: 'reachedTrailhead' },
      { type: 'battleWon' },
      { type: 'distillChosen', choice: 'graft' },
    ]);
    expect(s.step).toBe('forest');
    expect(s.distill).toBe('graft');
    expect(s.tutorialCardId).toBeNull();
  });

  it('records the starter, the distill choice and the tutorial card', () => {
    const s = run([
      { type: 'newGame' },
      { type: 'starterPicked', starter: 'forkling' },
      { type: 'battleWon' },
      { type: 'reachedTrailhead' },
      { type: 'battleWon' },
      { type: 'distillChosen', choice: 'spinUp' },
      { type: 'cardChosen', cardId: 'tutorial.c' },
      { type: 'trainerEngaged' },
    ]);
    expect(toProgress(s)).toEqual({ step: 'trainer', starter: 'forkling', distill: 'spinUp', tutorialCardId: 'tutorial.c' });
  });

  it('the forest trainer engages only after the distill (the walk to the trailhead cannot skip ahead)', () => {
    const walk = run([{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }, { type: 'battleWon' }]);
    expect(walk.step).toBe('walk');
    expect(transition(walk, { type: 'trainerEngaged' }).ok).toBe(false);
    const forest = run([{ type: 'reachedTrailhead' }, { type: 'battleWon' }, { type: 'distillChosen', choice: 'graft' }], walk);
    expect(run([{ type: 'trainerEngaged' }], forest).step).toBe('trainer');
    // The wild patch is calm by then: it cannot start a second encounter.
    expect(transition(forest, { type: 'reachedTrailhead' }).ok).toBe(false);
  });
});

describe('flow: losing a battle', () => {
  it.each(BATTLE_STEPS)('losing in %s returns to the same battle with a new attempt number', (step) => {
    const at = reachable().find((s) => s.step === step);
    expect(at).toBeDefined();
    const r = transition(at as FlowState, { type: 'battleLost' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.step).toBe(step);
    expect(r.state.attempt).toBe((at as FlowState).attempt + 1);
    expect(toProgress(r.state)).toEqual(toProgress(at as FlowState));
  });

  it('winning after losing moves on and resets the attempt counter', () => {
    const s = run([{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }, { type: 'battleLost' }, { type: 'battleLost' }]);
    expect(s.attempt).toBe(2);
    const won = run([{ type: 'battleWon' }], s);
    expect(won.step).toBe('walk');
    expect(won.attempt).toBe(0);
  });
});

describe('flow: invalid transitions are rejected without changing state', () => {
  const cases: Array<[string, FlowEvent[], FlowEvent]> = [
    ['battle result outside a battle', [], { type: 'battleWon' }],
    ['loss in the lab', [{ type: 'newGame' }], { type: 'battleLost' }],
    ['picking a starter twice', [{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }], { type: 'starterPicked', starter: 'blitzr' }],
    ['new game mid-journey', [{ type: 'newGame' }], { type: 'newGame' }],
    ['distill before the wild win', [{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }], { type: 'distillChosen', choice: 'graft' }],
    ['card before distill', [{ type: 'newGame' }], { type: 'cardChosen', cardId: 'tutorial.a' }],
    ['back to title from the title', [], { type: 'backToTitle' }],
    ['continue mid-journey', [{ type: 'newGame' }], { type: 'continue', progress: { step: 'walk', starter: 'sagelet', distill: null, tutorialCardId: null } }],
  ];
  it.each(cases)('%s', (_name, before, event) => {
    const s = run(before);
    const r = transition(s, event);
    expect(r.ok).toBe(false);
  });

  it('continue rejects inconsistent progress (e.g. trainer step with no distill choice)', () => {
    const r = transition(initialFlow(), { type: 'continue', progress: { step: 'trainer', starter: 'sagelet', distill: null, tutorialCardId: null } });
    expect(r.ok).toBe(false);
  });
});

describe('flow: continue', () => {
  it('resumes at the saved step with the saved choices', () => {
    const progress = { step: 'cardTutorial', starter: 'blitzr', distill: 'spinUp', tutorialCardId: null } as const;
    const s = run([{ type: 'continue', progress }]);
    expect(toProgress(s)).toEqual(progress);
    expect(s.attempt).toBe(0);
  });
});

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

  it('every step maps to a scene', () => {
    for (const step of STEPS) expect(sceneForStep(step)).toMatch(/^(Title|Lab|Overworld|Battle|End)$/);
    expect(sceneForStep('rival')).toBe('Battle');
    expect(sceneForStep('walk')).toBe('Overworld');
    expect(sceneForStep('forest')).toBe('Overworld');
    expect(OVERWORLD_STEPS.filter((st) => sceneForStep(st) !== 'Overworld')).toEqual([]);
    expect(STEPS.filter((st) => sceneForStep(st) === 'Overworld')).toEqual([...OVERWORLD_STEPS]);
  });
});

describe('isConsistentProgress', () => {
  it('rejects a title step, a missing starter after the lab, and a tutorial card on the graft path', () => {
    expect(isConsistentProgress({ step: 'title', starter: null, distill: null, tutorialCardId: null })).toBe(false);
    expect(isConsistentProgress({ step: 'rival', starter: null, distill: null, tutorialCardId: null })).toBe(false);
    expect(isConsistentProgress({ step: 'trainer', starter: 'sagelet', distill: 'graft', tutorialCardId: 'tutorial.a' })).toBe(false);
    expect(isConsistentProgress({ step: 'trainer', starter: 'sagelet', distill: 'spinUp', tutorialCardId: null })).toBe(false);
    expect(isConsistentProgress({ step: 'lab', starter: null, distill: null, tutorialCardId: null })).toBe(true);
    expect(isConsistentProgress({ step: 'forest', starter: 'sagelet', distill: 'spinUp', tutorialCardId: null })).toBe(false);
    expect(isConsistentProgress({ step: 'forest', starter: 'sagelet', distill: 'spinUp', tutorialCardId: 'tutorial.a' })).toBe(true);
    expect(isConsistentProgress({ step: 'forest', starter: 'sagelet', distill: 'graft', tutorialCardId: null })).toBe(true);
    expect(isConsistentProgress({ step: 'forest', starter: 'sagelet', distill: null, tutorialCardId: null })).toBe(false);
  });
});
