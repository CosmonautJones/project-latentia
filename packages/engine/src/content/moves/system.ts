import type { MoveDef } from '../primitives.js';

// System (typeless) — bible "57-move launch list". Compact, /clear and Guardrail are universal.
// Directive and Policy Update are levers: their move and card come from the RoundCommand
// (battle/levers.ts), so they carry no effects.
export const SYSTEM_MOVES = {
  compact: {
    id: 'compact', name: 'Compact', type: 'system', target: 'self',
    power: null, cost: 0, accuracy: null, priority: -2, universal: true,
    effects: [
      { kind: 'tokens', who: 'self', op: 'compact', oldest: 6 },
      { kind: 'cure', who: 'self', statuses: ['drift'], driftStacks: 1 },
    ],
  },
  clear: {
    id: 'clear', name: '/clear', type: 'system', target: 'self',
    power: null, cost: 0, accuracy: null, priority: -3, universal: true,
    effects: [
      { kind: 'tokens', who: 'self', op: 'clear' },
      { kind: 'stage', who: 'self', op: 'clear', which: 'all' },
      { kind: 'cure', who: 'self', statuses: ['drift'] },
      { kind: 'nextActionModifier', who: 'self', modifier: { kind: 'skip', reason: 'cleared', scope: 'orchestratorCommand' } },
    ],
  },
  guardrail: {
    id: 'guardrail', name: 'Guardrail', type: 'system', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 4, universal: true,
    effects: [{ kind: 'guard', who: 'self', guard: 'guardrail', successSlot: 'd3lo', damageBp: 5000, blockStatusMoves: true }],
  },
  refusal: {
    id: 'refusal', name: 'Refusal', type: 'system', target: 'self',
    power: null, cost: 1, accuracy: null, priority: 4,
    effects: [
      { kind: 'guard', who: 'self', guard: 'refusal', successSlot: 'd3lo', blockAttacks: { limit: 1 } },
      { kind: 'nextActionModifier', who: 'self', modifier: { kind: 'powerBp', bp: 5000 } },
    ],
  },
  'policy-update': {
    id: 'policy-update', name: 'Policy Update', type: 'system', target: 'none',
    power: null, cost: 2, accuracy: null, priority: 0, orchestratorOnly: true,
    effects: [],
  },
  directive: {
    id: 'directive', name: 'Directive', type: 'system', target: 'none',
    power: null, cost: 2, accuracy: null, priority: 0, orchestratorOnly: true,
    effects: [],
  },
  'temperature-spike': {
    id: 'temperature-spike', name: 'Temperature Spike', type: 'system', target: 'foe',
    power: null, cost: 1, accuracy: 90, priority: 0,
    effects: [{ kind: 'timedField', who: 'target', rounds: 2, field: { kind: 'forceTemperature', temperature: 4 } }],
  },
  'red-team': {
    id: 'red-team', name: 'Red Team', type: 'system', target: 'foe',
    power: null, cost: 2, accuracy: null, priority: 0,
    effects: [
      { kind: 'reveal', who: 'target', what: 'nextIntent', rounds: 2 },
      { kind: 'timedField', who: 'target', rounds: 3, field: { kind: 'critStagesAgainst', delta: 1 } },
    ],
  },
  throttle: {
    id: 'throttle', name: 'Throttle', type: 'system', target: 'foe',
    power: null, cost: 1, accuracy: 85, priority: 0,
    effects: [{ kind: 'applyStatus', who: 'target', status: 'rateLimited' }],
  },
} satisfies Record<string, MoveDef>;
