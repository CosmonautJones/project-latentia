import type { MoveDef } from '../primitives.js';

// Open — bible "57-move launch list".
export const OPEN_MOVES = {
  fork: {
    id: 'fork', name: 'Fork', type: 'open', target: 'other',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'copy', who: 'self', what: 'buff', from: 'target', pick: 'best', mode: 'copy' }],
  },
  'community-patch': {
    id: 'community-patch', name: 'Community Patch', type: 'open', target: 'ally',
    power: null, cost: 2, accuracy: null, priority: 0,
    effects: [{ kind: 'heal', who: 'target', pct: 30 }],
  },
  'weights-dump': {
    id: 'weights-dump', name: 'Weights Dump', type: 'open', target: 'foe',
    power: 100, cost: 3, accuracy: 90, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'stage', who: 'self', op: 'add', stat: 'robustness', delta: -1 },
    ],
  },
  'permissive-license': {
    id: 'permissive-license', name: 'Permissive License', type: 'open', target: 'none',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'stage', who: 'everyone', op: 'add', stat: 'compute', delta: 1 }],
    wild: [{ kind: 'stage', who: 'everyone', op: 'add', stat: 'compute', delta: 2 }],
    wildT4: [{ kind: 'stage', who: 'everyone', op: 'add', stat: 'compute', delta: 3 }],
  },
  'swarm-of-fine-tunes': {
    id: 'swarm-of-fine-tunes', name: 'Swarm of Fine-Tunes', type: 'open', target: 'foe',
    power: 15, cost: 2, accuracy: 100, priority: 0,
    effects: [{ kind: 'multiHit', who: 'target', count: { kind: 'perAllyOfType', base: 1, type: 'open' } }],
  },
  'leaderboard-flex': {
    id: 'leaderboard-flex', name: 'Leaderboard Flex', type: 'open', target: 'foe',
    power: 65, cost: 2, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target', bonus: { kind: 'flat', add: 30, when: { kind: 'userHpPctAboveTarget' } } }],
  },
} satisfies Record<string, MoveDef>;
