// Player-facing names for engine ids that have no `name` field of their own: statuses (with their chip text and
// colour), stats, guard kinds, field effects and types. Pure data; the UI and the text formatters share it.

import { STATUS_IDS, type StatusId, type TypeId } from '@latentia/engine';

export interface StatusLabel {
  readonly name: string;
  /** Three characters for the 20×8 status chip (bible: statuses carry an icon as well as a colour). */
  readonly chip: string;
  readonly color: number;
}

export const STATUS_LABELS: Readonly<Record<StatusId, StatusLabel>> = {
  hallucinating: { name: 'Hallucinating', chip: 'HAL', color: 0xb55088 },
  promptInjected: { name: 'Prompt Injected', chip: 'INJ', color: 0xff0044 },
  rateLimited: { name: 'Rate Limited', chip: '429', color: 0xfeae34 },
  overfit: { name: 'Overfit', chip: 'OVF', color: 0xf77622 },
  glazed: { name: 'Glazed', chip: 'GLZ', color: 0xf6757a },
  deprecated: { name: 'Deprecated', chip: 'DEP', color: 0x8b9bb4 },
  quantized: { name: 'Quantized', chip: 'QNT', color: 0x2ce8f5 },
  drift: { name: 'Drift', chip: 'DRF', color: 0x68386c },
};

const isStatus = (id: string): id is StatusId => (STATUS_IDS as readonly string[]).includes(id);

export function statusLabel(id: string): StatusLabel {
  return isStatus(id) ? STATUS_LABELS[id] : { name: id, chip: id.slice(0, 3).toUpperCase(), color: 0xc0cbdc };
}

const STAT_NAMES: Readonly<Record<string, string>> = {
  compute: 'Compute',
  robustness: 'Robustness',
  latency: 'Speed',
  accuracy: 'Accuracy',
  evasion: 'Evasion',
};
export const statName = (stat: string): string => STAT_NAMES[stat] ?? stat;

const GUARD_NAMES: Readonly<Record<string, string>> = {
  guardrail: 'Guardrail',
  refusal: 'Refusal',
  unitTest: 'Unit Test',
  captchaWall: 'Captcha Wall',
};
export const guardName = (kind: string): string => GUARD_NAMES[kind] ?? 'guard';

const FIELD_NAMES: Readonly<Record<string, string>> = {
  junkPerRound: 'Context Rot',
  revealIntents: 'Intent Leak',
  accuracyStages: 'Focus',
  forceTemperature: 'Temperature Spike',
  critStagesAgainst: 'Red Team',
  revealTopDeckCard: 'Stack Trace',
};
export const fieldName = (effect: string): string => FIELD_NAMES[effect] ?? effect;

/** Type colours from the bible's type palette (the first, most saturated swatch of each). */
export const TYPE_COLORS: Readonly<Record<TypeId, { readonly fill: number; readonly shade: number; readonly light: number }>> = {
  reasoning: { fill: 0x0099db, shade: 0x124e89, light: 0xead4aa },
  speed: { fill: 0xf77622, shade: 0xbe4a2f, light: 0xfee761 },
  open: { fill: 0x63c74d, shade: 0x3e8948, light: 0xb55088 },
  code: { fill: 0x2ce8f5, shade: 0x262b44, light: 0xffffff },
  vision: { fill: 0x68386c, shade: 0x3e2731, light: 0xb55088 },
  voice: { fill: 0xf6757a, shade: 0xff0044, light: 0xead4aa },
  search: { fill: 0xc28569, shade: 0x733e39, light: 0xead4aa },
  memory: { fill: 0x8b9bb4, shade: 0x5a6988, light: 0xc0cbdc },
};

export const TYPE_NAMES: Readonly<Record<TypeId, string>> = {
  reasoning: 'Reasoning',
  speed: 'Speed',
  open: 'Open',
  code: 'Code',
  vision: 'Vision',
  voice: 'Voice',
  search: 'Search',
  memory: 'Memory',
};

/** What the battle says when the engine rejects a command, by error code. */
export const COMMAND_ERRORS: Readonly<Record<string, string>> = {
  moveDisabled: "A status won't allow that move right now.",
  illegalTarget: "That target isn't valid right now.",
  actorSkipped: 'Busy releasing a charged move this round.',
};

export const WHY_EMPTY = 'Nothing has run from a deck yet. Once a deck-driven model acts, WHY? shows which card it fired, and why the others did not.';
