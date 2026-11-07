import type { MoveDef } from '../primitives.js';

// Search — bible "57-move launch list".
export const SEARCH_MOVES = {
  'ground-truth': {
    id: 'ground-truth', name: 'Ground Truth', type: 'search', target: 'none',
    power: null, cost: 1, accuracy: null, priority: 1,
    effects: [
      { kind: 'cure', who: 'allAllies', statuses: ['hallucinating'] },
      { kind: 'nextActionModifier', who: 'allAllies', modifier: { kind: 'ignoreEvasion' } },
    ],
  },
  'deep-research': {
    id: 'deep-research', name: 'Deep Research', type: 'search', target: 'foe',
    power: 140, cost: 4, accuracy: 100, priority: -1,
    effects: [
      { kind: 'charge', who: 'self', rounds: 1, telegraphed: false, hitWhileChargingPower: 0 },
      { kind: 'damage', who: 'target', crit: { kind: 'always', when: { kind: 'targetWeakToMove' } } },
    ],
  },
  'citation-needed': {
    id: 'citation-needed', name: 'Citation Needed', type: 'search', target: 'foe',
    power: 60, cost: 2, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target', mult: [{ bp: 20000, when: { kind: 'targetHasStatus', status: 'hallucinating' } }] },
      { kind: 'cure', who: 'target', statuses: ['hallucinating'] },
    ],
  },
  rerank: {
    id: 'rerank', name: 'Rerank', type: 'search', target: 'other',
    power: null, cost: 1, accuracy: null, priority: 2,
    effects: [{ kind: 'reorder', who: 'target', what: 'turnOrder' }],
  },
  'retrieval-strike': {
    id: 'retrieval-strike', name: 'Retrieval Strike', type: 'search', target: 'foe',
    power: 70, cost: 1, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target', ignoreUserComputeDrops: true }],
  },
  'fact-check': {
    id: 'fact-check', name: 'Fact Check', type: 'search', target: 'foe',
    power: null, cost: 1, accuracy: 100, priority: 0,
    effects: [{ kind: 'stage', who: 'target', op: 'clear', which: 'positive' }],
  },
} satisfies Record<string, MoveDef>;
