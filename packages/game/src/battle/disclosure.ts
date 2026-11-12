// Per-fight disclosure (ruling V14): each fight shows only the systems taught so far. Kip and the wild Tokenibble
// show HP, the moves, the context pips and the foe's telegraph; the Bootcamp Grad adds the teammate's telegraph.
// The temperature dial stays hidden everywhere until the save's `unlocks.temperature` is set (V12; nothing sets it in
// v0.1, it is meant for the first gym). Pure data, so the HUD reads one table.

import type { BattleId } from '../content/battles.js';

export interface Disclosure {
  readonly hp: boolean;
  readonly moves: boolean;
  readonly contextPips: boolean;
  readonly foeTelegraph: boolean;
  readonly teammateTelegraph: boolean;
  /** The temperature dial and the TEMP command. */
  readonly temperature: boolean;
}

const BASE = { hp: true, moves: true, contextPips: true, foeTelegraph: true, teammateTelegraph: false, temperature: false } as const;

export const DISCLOSURE: Readonly<Record<BattleId, Disclosure>> = {
  rival: BASE,
  wild: BASE,
  trainer: { ...BASE, teammateTelegraph: true },
};

/** What this fight shows, given what the save has unlocked. */
export function disclosureFor(id: BattleId, unlocks: { readonly temperature: boolean }): Disclosure {
  const d = DISCLOSURE[id];
  return unlocks.temperature ? { ...d, temperature: true } : d;
}
