import type { MoveDef } from '../primitives.js';

// Voice — bible "57-move launch list".
export const VOICE_MOVES = {
  'hype-train': {
    id: 'hype-train', name: 'Hype Train', type: 'voice', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [
      { kind: 'stage', who: 'self', op: 'add', stat: 'compute', delta: 2 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'accuracy', delta: -1 },
    ],
    wild: [
      { kind: 'stage', who: 'self', op: 'add', stat: 'compute', delta: 2 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'accuracy', delta: -1 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'latency', delta: 1 },
    ],
    wildT4: [
      { kind: 'stage', who: 'self', op: 'add', stat: 'compute', delta: 2 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'accuracy', delta: -1 },
      { kind: 'stage', who: 'self', op: 'add', stat: 'latency', delta: 2 },
    ],
  },
  'hot-take': {
    id: 'hot-take', name: 'Hot Take', type: 'voice', target: 'foe',
    power: 90, cost: 2, accuracy: 85, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
    wild: [{ kind: 'damage', who: 'target', mult: [{ bp: 15000 }] }],
    wildT4: [{ kind: 'damage', who: 'target', mult: [{ bp: 20000 }] }],
  },
  'deepfake-call': {
    id: 'deepfake-call', name: 'Deepfake Call', type: 'voice', target: 'foe',
    power: null, cost: 3, accuracy: 75, priority: 0,
    effects: [{ kind: 'applyStatus', who: 'target', status: 'promptInjected' }],
  },
  'earnest-apology': {
    id: 'earnest-apology', name: 'Earnest Apology', type: 'voice', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [
      { kind: 'heal', who: 'self', pct: 20 },
      { kind: 'cure', who: 'self', statuses: ['drift'], driftStacks: 1 },
      { kind: 'nextActionModifier', who: 'self', modifier: { kind: 'incomingDamageBp', bp: 7000 } },
    ],
  },
  filibuster: {
    id: 'filibuster', name: 'Filibuster', type: 'voice', target: 'foe',
    power: 40, cost: 1, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'tokens', who: 'target', op: 'addJunk', count: 2 },
    ],
  },
  flattery: {
    id: 'flattery', name: 'Flattery', type: 'voice', target: 'foe',
    power: null, cost: 1, accuracy: 90, priority: 0,
    effects: [{ kind: 'applyStatus', who: 'target', status: 'glazed' }],
  },
} satisfies Record<string, MoveDef>;
