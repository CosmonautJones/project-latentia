import type { BattleView, Card, Condition, ViewCreature } from '../../src/cards/model.js';

/** A healthy, unbuffed, status-free creature with an empty context; override what a test needs. */
export const vc = (index: number, over: Partial<ViewCreature> = {}): ViewCreature => ({
  index,
  isOrchestrator: false,
  hp: 100,
  maxHp: 100,
  types: ['speed'],
  statuses: [],
  stages: { compute: 0, robustness: 0, latency: 0, accuracy: 0, evasion: 0 },
  compute: 50,
  lastMove: null,
  telegraphing: false,
  contextUsed: 0,
  contextWindow: 12,
  fields: [],
  ...over,
});

/** Actor 1 (a subagent) with orchestrator 0, ally 2 and foes 6, 7, 8 at round 3, no round-start draws. */
export const view = (over: Partial<BattleView> = {}): BattleView => ({
  round: 3,
  roundStart: null,
  self: vc(1),
  orchestrator: vc(0, { isOrchestrator: true }),
  allies: [vc(0, { isOrchestrator: true }), vc(2)],
  foes: [vc(6, { isOrchestrator: true }), vc(7), vc(8)],
  orchestratorTarget: null,
  selfLastUsed: [],
  lastMoveId: null,
  pendingCost: [],
  ...over,
});

export const card = (condition: Condition, over: Partial<Card> = {}): Card => ({
  id: 'c1',
  subject: 'self',
  condition,
  move: 'ship-it',
  target: 'lowestHpFoe',
  ...over,
});

/** A draw word from its high and low 16-bit halves. */
export const word = (hiV: number, loV: number): number => ((hiV << 16) | loV) >>> 0;
