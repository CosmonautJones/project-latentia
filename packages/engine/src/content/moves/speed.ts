import type { MoveDef } from '../primitives.js';

// Speed — bible "57-move launch list".
export const SPEED_MOVES = {
  'token-burst': {
    id: 'token-burst', name: 'Token Burst', type: 'speed', target: 'foe',
    power: 40, cost: 1, accuracy: 100, priority: 1,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  'speculative-decoding': {
    id: 'speculative-decoding', name: 'Speculative Decoding', type: 'speed', target: 'foe',
    power: 22, cost: 2, accuracy: 90, priority: 0,
    effects: [{ kind: 'multiHit', who: 'target', count: { kind: 'range', min: 2, max: 5, slot: 'd5hi' } }],
    wild: [{ kind: 'multiHit', who: 'target', count: { kind: 'range', min: 2, max: 6, slot: 'd5hi' } }],
    wildT4: [{ kind: 'multiHit', who: 'target', count: { kind: 'range', min: 2, max: 7, slot: 'd5hi' } }],
  },
  'low-latency': {
    id: 'low-latency', name: 'Low Latency', type: 'speed', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'stage', who: 'self', op: 'add', stat: 'latency', delta: 2 }],
  },
  // Priority +3 per spec §5 Levers ("Swap and Early Exit resolve at priority +3"); the bible lists none.
  'early-exit': {
    id: 'early-exit', name: 'Early Exit', type: 'speed', target: 'foe',
    power: 50, cost: 1, accuracy: 100, priority: 3,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'reorder', who: 'self', what: 'fieldSlot', incoming: 'firstLivingBench' },
    ],
  },
  'distilled-strike': {
    id: 'distilled-strike', name: 'Distilled Strike', type: 'speed', target: 'foe',
    power: 75, cost: 1, accuracy: 95, priority: 0,
    effects: [{ kind: 'damage', who: 'target', crit: { kind: 'never' } }],
  },
  'flash-inference': {
    id: 'flash-inference', name: 'Flash Inference', type: 'speed', target: 'foe',
    power: 90, cost: 3, accuracy: 85, priority: 1,
    effects: [{ kind: 'damage', who: 'target', failsIf: { kind: 'targetActedThisRound' } }],
  },
} satisfies Record<string, MoveDef>;
