export const TYPES = Object.freeze(['reasoning', 'speed', 'open', 'code', 'vision', 'voice', 'search', 'memory'] as const);
export type TypeId = (typeof TYPES)[number];

export const STATUS_IDS = Object.freeze([
  'hallucinating',
  'promptInjected',
  'rateLimited',
  'overfit',
  'glazed',
  'deprecated',
  'quantized',
  'drift',
] as const);
export type StatusId = (typeof STATUS_IDS)[number];
