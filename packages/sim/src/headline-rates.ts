import { simulate } from '@latentia/engine';
import { cardFires, HEADLINES } from './archetypes/headlines.js';
import { seedFor } from './runner.js';
import type { Archetype } from './types.js';

// How often each of an archetype's headline cards fires (Ruling 149): the share of battles, over the field, in which
// the card fired at least once. Each foe is met on both sides for HEADLINE_SEEDS seeds (`headline:<foe id>`, i), so a
// pass over 19 foes is 19 × 2 × 6 = 228 battles. The headline test asserts floors from these rates; D3's helper
// script uses them to check a searched deck.

export const HEADLINE_SEEDS = 6;

/** Fire rate per headline card of `a` (key `<creature>#<card>`) over `field` (the archetypes other than `a`). */
export function headlineRates(a: Archetype, field: readonly Archetype[]): Record<string, number> {
  const cards = HEADLINES[a.id] ?? [];
  const counts = Object.fromEntries(cards.map((h) => [`${h.creature}#${h.card}`, 0]));
  let battles = 0;
  for (const foe of field) {
    for (let i = 0; i < HEADLINE_SEEDS; i++) {
      for (const flip of [false, true]) {
        const x = flip ? foe : a;
        const y = flip ? a : foe;
        const r = simulate({ a: { ...x.side, opponentId: y.id }, b: { ...y.side, opponentId: x.id }, kind: 'trainer' }, seedFor(`headline:${foe.id}`, i), { kind: 'autopilot' });
        const fires = cardFires(r);
        for (const h of cards) if ((fires.get(`${a.id}/${h.creature}`)?.get(h.card) ?? 0) > 0) counts[`${h.creature}#${h.card}`] = (counts[`${h.creature}#${h.card}`] ?? 0) + 1;
        battles++;
      }
    }
  }
  return Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / battles]));
}
