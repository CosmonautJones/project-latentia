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
  type Progress,
  type Step,
} from '../../src/flow/flow.js';
import { FIGHT_LOG_CAP, NO_TELEMETRY, type FightReport } from '../../src/flow/telemetry.js';

const run = (events: FlowEvent[], from: FlowState = initialFlow()): FlowState => {
  let s = from;
  for (const e of events) {
    const r = transition(s, e);
    if (!r.ok) throw new Error(`${s.step} --${e.type}--> rejected: ${r.error}`);
    s = r.state;
  }
  return s;
};

const fight = (patch: Partial<FightReport> = {}): FightReport => ({
  battle: 'trainer',
  outcome: 'lose',
  rounds: 4,
  moves: 9,
  cardsFired: 4,
  cardId: 'tutorial.c',
  kept: ['Tokenibble kept using Low Latency.'],
  ...patch,
});

/** A progress record with defaults for everything a test does not care about. */
const progress = (patch: Partial<Progress>): Progress => ({
  step: 'lab',
  starter: null,
  distill: null,
  tutorialCardId: null,
  trainerBeaten: false,
  lastFight: null,
  telemetry: NO_TELEMETRY,
  ...patch,
});

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
  { type: 'rematch', cardId: null },
  { type: 'rematch', cardId: 'tutorial.b' },
  { type: 'finish' },
  { type: 'backToTitle' },
];

// The graph explored without telemetry growth (counters would make it infinite): compare on the journey fields.
const key = (s: FlowState) => JSON.stringify({ ...toProgress(s), telemetry: null, lastFight: s.lastFight?.outcome ?? null });

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

const TO_TRAINER_SPIN_UP: FlowEvent[] = [
  { type: 'newGame' },
  { type: 'starterPicked', starter: 'blitzr' },
  { type: 'battleWon' },
  { type: 'reachedTrailhead' },
  { type: 'battleWon' },
  { type: 'distillChosen', choice: 'spinUp' },
  { type: 'cardChosen', cardId: 'tutorial.c' },
  { type: 'trainerEngaged' },
];

const TO_TRAINER_GRAFT: FlowEvent[] = [
  { type: 'newGame' },
  { type: 'starterPicked', starter: 'forkling' },
  { type: 'battleWon' },
  { type: 'reachedTrailhead' },
  { type: 'battleWon' },
  { type: 'distillChosen', choice: 'graft' },
  { type: 'trainerEngaged' },
];

describe('flow: the happy paths', () => {
  it('spin-up path: title → lab → rival → walk → wild → distill → card tutorial → forest → trainer → debrief → end → title', () => {
    const steps: Step[] = [];
    let s = initialFlow();
    steps.push(s.step);
    for (const e of [...TO_TRAINER_SPIN_UP, { type: 'battleWon' }, { type: 'finish' }, { type: 'backToTitle' }] satisfies FlowEvent[]) {
      s = run([e], s);
      steps.push(s.step);
    }
    expect(steps).toEqual(['title', 'lab', 'rival', 'walk', 'wild', 'distill', 'cardTutorial', 'forest', 'trainer', 'debrief', 'end', 'title']);
  });

  it('graft path skips the card tutorial and walks straight on into the forest', () => {
    const s = run(TO_TRAINER_GRAFT.slice(0, 6));
    expect(s.step).toBe('forest');
    expect(s.distill).toBe('graft');
    expect(s.tutorialCardId).toBeNull();
    expect(run([{ type: 'trainerEngaged' }, { type: 'battleWon' }, { type: 'finish' }], s).step).toBe('end');
  });

  it('records the starter, the distill choice and the tutorial card', () => {
    const s = run(TO_TRAINER_SPIN_UP);
    expect(toProgress(s)).toEqual(progress({ step: 'trainer', starter: 'blitzr', distill: 'spinUp', tutorialCardId: 'tutorial.c' }));
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

describe('flow: losing the rival or wild battle', () => {
  it.each(['rival', 'wild'] as const)('losing in %s returns to the same battle with a new attempt number', (step) => {
    const at = reachable().find((s) => s.step === step) as FlowState;
    const r = transition(at, { type: 'battleLost' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.step).toBe(step);
    expect(r.state.attempt).toBe(at.attempt + 1);
    expect(toProgress(r.state)).toEqual(toProgress(at));
  });

  it('winning after losing moves on and resets the attempt counter', () => {
    const s = run([{ type: 'newGame' }, { type: 'starterPicked', starter: 'sagelet' }, { type: 'battleLost' }, { type: 'battleLost' }]);
    expect(s.attempt).toBe(2);
    const won = run([{ type: 'battleWon' }], s);
    expect(won.step).toBe('walk');
    expect(won.attempt).toBe(0);
  });
});

describe('flow: the core loop, lose → teach → rematch', () => {
  it('a trainer loss goes to the debrief with the fight, then a card swap starts a rematch with the new card', () => {
    const lost = run([...TO_TRAINER_SPIN_UP, { type: 'battleLost', fight: fight() }]);
    expect(lost.step).toBe('debrief');
    expect(lost.lastFight).toEqual(fight());
    expect(lost.trainerBeaten).toBe(false);
    expect(lost.telemetry).toMatchObject({ losses: 1, swaps: 0, rematches: 0 });

    const rematch = run([{ type: 'rematch', cardId: 'tutorial.b' }], lost);
    expect(rematch).toMatchObject({ step: 'trainer', tutorialCardId: 'tutorial.b', attempt: 1 });
    expect(rematch.telemetry).toMatchObject({ losses: 1, swaps: 1, rematches: 1 });

    const won = run([{ type: 'battleWon', fight: fight({ outcome: 'win', cardId: 'tutorial.b' }) }], rematch);
    expect(won).toMatchObject({ step: 'debrief', trainerBeaten: true });
    expect(run([{ type: 'finish' }], won).step).toBe('end');
  });

  it('"rematch as is" (no card, or the same card) is a rematch but not a swap', () => {
    const lost = run([...TO_TRAINER_SPIN_UP, { type: 'battleLost' }]);
    const asIs = run([{ type: 'rematch', cardId: null }], lost);
    expect(asIs).toMatchObject({ step: 'trainer', tutorialCardId: 'tutorial.c', attempt: 1 });
    expect(asIs.telemetry).toMatchObject({ losses: 1, swaps: 0, rematches: 1 });
    const same = run([{ type: 'battleLost' }, { type: 'rematch', cardId: 'tutorial.c' }], asIs);
    expect(same.telemetry).toMatchObject({ losses: 2, swaps: 0, rematches: 2 });
    expect(same.attempt).toBe(2);
  });

  it('the end card is only reachable once the trainer has been beaten; until then the debrief offers rematches', () => {
    const lost = run([...TO_TRAINER_SPIN_UP, { type: 'battleLost' }]);
    expect(transition(lost, { type: 'finish' }).ok).toBe(false);
    expect(transition(lost, { type: 'rematch', cardId: null }).ok).toBe(true);
  });

  it('after a win, "try a different card?" replays the fight, and losing that replay still lets you finish', () => {
    const won = run([...TO_TRAINER_SPIN_UP, { type: 'battleWon' }]);
    const replay = run([{ type: 'rematch', cardId: 'tutorial.a' }], won);
    expect(replay).toMatchObject({ step: 'trainer', tutorialCardId: 'tutorial.a', trainerBeaten: true });
    const lostReplay = run([{ type: 'battleLost' }], replay);
    expect(lostReplay.step).toBe('debrief');
    expect(run([{ type: 'finish' }], lostReplay).step).toBe('end');
  });

  it('on the graft path a rematch keeps the graft: there is no card to swap', () => {
    const lost = run([...TO_TRAINER_GRAFT, { type: 'battleLost' }]);
    expect(transition(lost, { type: 'rematch', cardId: 'tutorial.a' }).ok).toBe(false);
    const again = run([{ type: 'rematch', cardId: null }], lost);
    expect(again).toMatchObject({ step: 'trainer', tutorialCardId: null });
    expect(again.telemetry).toMatchObject({ losses: 1, swaps: 0, rematches: 1 });
  });

  it('rematch and finish only work at the debrief', () => {
    expect(transition(run(TO_TRAINER_SPIN_UP), { type: 'rematch', cardId: null }).ok).toBe(false);
    expect(transition(run(TO_TRAINER_SPIN_UP), { type: 'finish' }).ok).toBe(false);
  });
});

describe('flow: telemetry', () => {
  it('every fight with a report adds its rounds, moves and fired cards, and is logged', () => {
    const s = run([
      { type: 'newGame' },
      { type: 'starterPicked', starter: 'blitzr' },
      { type: 'battleLost', fight: fight({ battle: 'rival', rounds: 3, moves: 6, cardsFired: 0, cardId: null, kept: [] }) },
      { type: 'battleWon', fight: fight({ battle: 'rival', outcome: 'win', rounds: 5, moves: 10, cardsFired: 0, cardId: null, kept: [] }) },
    ]);
    expect(s.telemetry).toMatchObject({ turns: 8, moves: 16, cardsFired: 0, losses: 0 });
    expect(s.telemetry.fights).toEqual([
      { battle: 'rival', outcome: 'lose', rounds: 3, moves: 6, cardsFired: 0, cardId: null },
      { battle: 'rival', outcome: 'win', rounds: 5, moves: 10, cardsFired: 0, cardId: null },
    ]);
  });

  it(`the fight log keeps the last ${FIGHT_LOG_CAP} fights; the totals keep counting`, () => {
    let s = run(TO_TRAINER_SPIN_UP);
    for (let i = 0; i < FIGHT_LOG_CAP + 5; i++) s = run([{ type: 'battleLost', fight: fight({ rounds: 1 }) }, { type: 'rematch', cardId: null }], s);
    expect(s.telemetry.fights).toHaveLength(FIGHT_LOG_CAP);
    expect(s.telemetry.turns).toBe(FIGHT_LOG_CAP + 5);
    expect(s.telemetry.losses).toBe(FIGHT_LOG_CAP + 5);
  });

  it('new game clears the telemetry', () => {
    const s = run([...TO_TRAINER_SPIN_UP, { type: 'battleLost', fight: fight() }, { type: 'backToTitle' }, { type: 'newGame' }]);
    expect(s.telemetry).toEqual(NO_TELEMETRY);
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
    ['continue mid-journey', [{ type: 'newGame' }], { type: 'continue', progress: progress({ step: 'walk', starter: 'sagelet' }) }],
  ];
  it.each(cases)('%s', (_name, before, event) => {
    const s = run(before);
    const r = transition(s, event);
    expect(r.ok).toBe(false);
  });

  it('continue rejects inconsistent progress (e.g. trainer step with no distill choice)', () => {
    const r = transition(initialFlow(), { type: 'continue', progress: progress({ step: 'trainer', starter: 'sagelet' }) });
    expect(r.ok).toBe(false);
  });
});

describe('flow: continue', () => {
  it('resumes at the saved step with the saved choices', () => {
    const saved = progress({ step: 'cardTutorial', starter: 'blitzr', distill: 'spinUp' });
    const s = run([{ type: 'continue', progress: saved }]);
    expect(toProgress(s)).toEqual(saved);
    expect(s.attempt).toBe(0);
  });

  it('resumes the debrief with its fight, and a trainer rematch on the seed it had reached', () => {
    const atDebrief = run([...TO_TRAINER_SPIN_UP, { type: 'battleLost', fight: fight() }, { type: 'rematch', cardId: 'tutorial.b' }, { type: 'battleLost', fight: fight() }]);
    const resumed = run([{ type: 'continue', progress: toProgress(atDebrief) }]);
    expect(resumed).toMatchObject({ step: 'debrief', lastFight: fight() });
    const atTrainer = run([{ type: 'rematch', cardId: null }], atDebrief);
    expect(atTrainer.attempt).toBe(2);
    expect(run([{ type: 'continue', progress: toProgress(atTrainer) }]).attempt).toBe(2);
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
