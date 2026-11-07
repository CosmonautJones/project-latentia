import type { MoveDef } from '../primitives.js';

// Vision — bible "57-move launch list".
export const VISION_MOVES = {
  'pixel-peep': {
    id: 'pixel-peep', name: 'Pixel Peep', type: 'vision', target: 'foe',
    power: 50, cost: 1, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target', crit: { kind: 'stages', stages: 1 } }],
  },
  'bounding-box': {
    id: 'bounding-box', name: 'Bounding Box', type: 'vision', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'nextActionModifier', who: 'self', modifier: { kind: 'cannotMiss' } }],
  },
  'adversarial-patch': {
    id: 'adversarial-patch', name: 'Adversarial Patch', type: 'vision', target: 'foe',
    power: 70, cost: 2, accuracy: 90, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'applyStatus', who: 'target', status: 'hallucinating', durationSlot: 'd6hi', chance: { pct: 30, slot: 'd6lo' } },
    ],
  },
  screenshot: {
    id: 'screenshot', name: 'Screenshot', type: 'vision', target: 'other',
    power: null, cost: 1, accuracy: null, priority: 0,
    effects: [{ kind: 'revert', who: 'target', what: 'stages', ifNone: 'snapshot' }],
  },
  'saliency-map': {
    id: 'saliency-map', name: 'Saliency Map', type: 'vision', target: 'none',
    power: null, cost: 2, accuracy: null, priority: 0,
    effects: [
      { kind: 'timedField', who: 'allFoes', rounds: 3, field: { kind: 'revealIntents' } },
      { kind: 'timedField', who: 'allAllies', rounds: 3, field: { kind: 'accuracyStages', delta: 1 } },
    ],
  },
  'captcha-wall': {
    id: 'captcha-wall', name: 'Captcha Wall', type: 'vision', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 4,
    effects: [{ kind: 'guard', who: 'self', guard: 'captchaWall', successSlot: 'd3lo', blockAttacks: { ofType: 'speed' }, damageBp: 5000 }],
  },
} satisfies Record<string, MoveDef>;
