import type { MoveDef } from '../primitives.js';

// Reasoning — bible "57-move launch list".
export const REASONING_MOVES = {
  'chain-of-thought': {
    id: 'chain-of-thought', name: 'Chain of Thought', type: 'reasoning', target: 'foe',
    power: 60, cost: 2, accuracy: 100, priority: 0,
    effects: [{
      kind: 'damage', who: 'target',
      bonus: { kind: 'perCount', counter: { kind: 'userConsecutiveRoundsUsingType', type: 'reasoning' }, per: 20, cap: { of: 'bonus', value: 60 } },
    }],
  },
  deliberate: {
    id: 'deliberate', name: 'Deliberate', type: 'reasoning', target: 'foe',
    power: 130, cost: 4, accuracy: 95, priority: -1,
    effects: [
      { kind: 'charge', who: 'self', rounds: 1, telegraphed: true, hitWhileChargingPower: -30 },
      { kind: 'damage', who: 'target' },
    ],
  },
  'step-back-prompt': {
    id: 'step-back-prompt', name: 'Step-Back Prompt', type: 'reasoning', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [
      { kind: 'stage', who: 'self', op: 'add', stat: 'compute', delta: 1 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'accuracy', delta: 1 },
    ],
  },
  'proof-by-contradiction': {
    id: 'proof-by-contradiction', name: 'Proof by Contradiction', type: 'reasoning', target: 'foe',
    power: 70, cost: 2, accuracy: 90, priority: 0,
    effects: [{ kind: 'damage', who: 'target', mult: [{ bp: 20000, when: { kind: 'targetLastRound', did: ['buffed', 'usedStatusMove'] } }] }],
  },
  'socratic-method': {
    id: 'socratic-method', name: 'Socratic Method', type: 'reasoning', target: 'foe',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [
      { kind: 'reveal', who: 'target', what: 'nextIntent', rounds: 1 },
      { kind: 'nextActionModifier', who: 'target', modifier: { kind: 'accuracy', delta: -15 } },
    ],
  },
  'tree-search': {
    id: 'tree-search', name: 'Tree Search', type: 'reasoning', target: 'foeMostDamage',
    power: 85, cost: 3, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
} satisfies Record<string, MoveDef>;
