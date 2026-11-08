export const TYPES = ['reasoning', 'speed', 'open', 'code', 'vision', 'voice', 'search', 'memory'] as const;
export type TypeId = (typeof TYPES)[number];

export const STATUS_IDS = [
  'hallucinating',
  'promptInjected',
  'rateLimited',
  'overfit',
  'glazed',
  'deprecated',
  'quantized',
  'drift',
] as const;
export type StatusId = (typeof STATUS_IDS)[number];
