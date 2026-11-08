import type { MoveDef } from '../primitives.js';

// Memory — bible "57-move launch list" (5 moves).
export const MEMORY_MOVES = {
  'long-term-recall': {
    id: 'long-term-recall', name: 'Long-Term Recall', type: 'memory', target: 'foe',
    power: 40, cost: 2, accuracy: 100, priority: 0,
    effects: [{
      kind: 'damage', who: 'target',
      bonus: { kind: 'perCount', counter: { kind: 'hitsTakenFromTarget' }, per: 10, cap: { of: 'power', value: 120 } },
    }],
  },
  'save-state': {
    id: 'save-state', name: 'Save State', type: 'memory', target: 'self',
    power: null, cost: 3, accuracy: null, priority: 0,
    effects: [{ kind: 'snapshot', who: 'self', what: 'hp', rounds: 3, revertOn: 'firstKo' }],
  },
  'embedding-cache': {
    id: 'embedding-cache', name: 'Embedding Cache', type: 'memory', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'nextActionModifier', who: 'self', modifier: { kind: 'costSet', cells: 0 } }],
  },
  'memory-leak': {
    id: 'memory-leak', name: 'Memory Leak', type: 'memory', target: 'foe',
    power: 50, cost: 1, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'timedField', who: 'target', rounds: 3, field: { kind: 'junkPerRound', count: 1 } },
    ],
  },
  // Cost is "(copied cost − 1)": `cost` is 0 and the copy effect carries the offset.
  'episodic-replay': {
    id: 'episodic-replay', name: 'Episodic Replay', type: 'memory', target: 'none',
    power: null, cost: 0, accuracy: null, priority: 0,
    effects: [{ kind: 'copy', who: 'self', what: 'move', from: 'lastAllyMove', costOffset: -1 }],
  },
} satisfies Record<string, MoveDef>;
