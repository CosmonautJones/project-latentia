import type { MoveDef } from '../primitives.js';

// Code — bible "57-move launch list" (7 moves).
export const CODE_MOVES = {
  'stack-trace': {
    id: 'stack-trace', name: 'Stack Trace', type: 'code', target: 'foe',
    power: 65, cost: 2, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'reveal', who: 'target', what: 'topDeckCard', rounds: 3 },
    ],
  },
  hotfix: {
    id: 'hotfix', name: 'Hotfix', type: 'code', target: 'ally',
    power: null, cost: 2, accuracy: null, priority: 1,
    effects: [
      { kind: 'cure', who: 'target', statuses: ['rateLimited', 'deprecated', 'quantized'] },
      { kind: 'heal', who: 'target', pct: 15 },
    ],
  },
  'infinite-loop': {
    id: 'infinite-loop', name: 'Infinite Loop', type: 'code', target: 'foe',
    power: null, cost: 2, accuracy: 85, priority: 0,
    effects: [{ kind: 'applyStatus', who: 'target', status: 'overfit' }],
  },
  segfault: {
    id: 'segfault', name: 'Segfault', type: 'code', target: 'foe',
    power: 110, cost: 3, accuracy: 80, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'nextActionModifier', who: 'target', modifier: { kind: 'fail' }, chance: { pct: 20, slot: 'd6lo' } },
    ],
  },
  'unit-test': {
    id: 'unit-test', name: 'Unit Test', type: 'code', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 3,
    effects: [{ kind: 'guard', who: 'self', guard: 'unitTest', successSlot: 'd3lo', reflectBp: 5000 }],
  },
  refactor: {
    id: 'refactor', name: 'Refactor', type: 'code', target: 'self',
    power: null, cost: 0, accuracy: null, priority: 0,
    effects: [
      { kind: 'stage', who: 'self', op: 'clear', which: 'all' },
      { kind: 'tokens', who: 'self', op: 'freeOldest', count: 2 },
      { kind: 'cure', who: 'self', statuses: ['quantized'] },
    ],
  },
  'merge-conflict': {
    id: 'merge-conflict', name: 'Merge Conflict', type: 'code', target: 'foe',
    power: 55, cost: 2, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'copy', who: 'self', what: 'buff', from: 'target', pick: 'random', pickSlot: 'd6hi', mode: 'swap' },
    ],
  },
} satisfies Record<string, MoveDef>;
