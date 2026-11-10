// Shared fixtures for the flow tests (flow.test.ts and flow-graph.test.ts): run events, build fights and progress, and
// explore the whole flow graph.

import { initialFlow, STARTERS, toProgress, transition, type FlowEvent, type FlowState, type Progress } from '../../src/flow/flow.js';
import { NO_TELEMETRY, type FightReport } from '../../src/flow/telemetry.js';

export const run = (events: FlowEvent[], from: FlowState = initialFlow()): FlowState => {
  let s = from;
  for (const e of events) {
    const r = transition(s, e);
    if (!r.ok) throw new Error(`${s.step} --${e.type}--> rejected: ${r.error}`);
    s = r.state;
  }
  return s;
};

export const fight = (patch: Partial<FightReport> = {}): FightReport => ({
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
export const progress = (patch: Partial<Progress>): Progress => ({
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
export const ALL_EVENTS: FlowEvent[] = [
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
export const key = (s: FlowState) => JSON.stringify({ ...toProgress(s), telemetry: null, lastFight: s.lastFight?.outcome ?? null });

export const successors = (s: FlowState): FlowState[] =>
  ALL_EVENTS.flatMap((e) => {
    const r = transition(s, e);
    return r.ok ? [r.state] : [];
  });

export const reachable = (): FlowState[] => {
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

export const TO_TRAINER_SPIN_UP: FlowEvent[] = [
  { type: 'newGame' },
  { type: 'starterPicked', starter: 'blitzr' },
  { type: 'battleWon' },
  { type: 'reachedTrailhead' },
  { type: 'battleWon' },
  { type: 'distillChosen', choice: 'spinUp' },
  { type: 'cardChosen', cardId: 'tutorial.c' },
  { type: 'trainerEngaged' },
];

export const TO_TRAINER_GRAFT: FlowEvent[] = [
  { type: 'newGame' },
  { type: 'starterPicked', starter: 'forkling' },
  { type: 'battleWon' },
  { type: 'reachedTrailhead' },
  { type: 'battleWon' },
  { type: 'distillChosen', choice: 'graft' },
  { type: 'trainerEngaged' },
];
