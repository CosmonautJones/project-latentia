import { describe, expect, it } from 'vitest';
import type { BattleSetup } from '../../src/battle/setup.js';
import { simulate } from '../../src/battle/simulate.js';
import type { Deck } from '../../src/cards/model.js';
import { seedFor } from '../golden/builders.js';
import { activeCards } from '../../src/battle/levers.js';
import { createBattle } from '../../src/battle/setup.js';
import { computeGeneralization } from '../../src/generalization/score.js';
import { DEPRECATED_FOREST_SUITE } from '../../src/generalization/suites/deprecated-forest.js';
import { ATTACK, BROKEN_DECK, brokenDeckBattle, FORKLING_G, HEAL, SWAPPED_DECK } from './fixtures.js';

// Spec §2 criterion 5, "training works" (Ruling 108): against the first Deprecated Forest trainer at fixed levels
// (fixtures.ts, where every tuned value is explained), the broken deck — heal card ordered below an attack card
// that always fires — wins at most 20 of 200 seeds, and the same deck with those two cards swapped wins at least 180.
// Both sides run on their Autopilot decks ({ kind: 'autopilot' }), so the arms differ only in the subagent's deck.
//
// Known re-tune point: the fixture is a low-level fight decided by a few HP (the starter Sagelet is Lv4, 16 HP) and runs
// 4–5 rounds, under the bible's 5–8. It holds across seed lists (7 / 400 broken, 393 / 400 swapped on seedFor(`check:${i}`))
// but moves with single levels — Sagelet at Lv5 gives 154 broken wins — so a change to placeholder stats will likely
// need fixtures.ts re-tuned (its comments list the counts at each neighbouring value).

const SEEDS = Array.from({ length: 200 }, (_, i) => seedFor(`broken-deck:${i}`));

function wins(deck: Deck): number {
  return SEEDS.filter((seed) => simulate(brokenDeckBattle(deck), seed, { kind: 'autopilot' }).winner === 'a').length;
}

describe('the broken-deck scenario (criterion 5)', () => {
  it('the two arms differ only in the order of the heal and attack cards', () => {
    expect(BROKEN_DECK.cards).toEqual([ATTACK, HEAL]);
    expect(SWAPPED_DECK.cards).toEqual([HEAL, ATTACK]);
    const withoutCards = (deck: Deck): BattleSetup => {
      const s = brokenDeckBattle(deck);
      return { ...s, a: { ...s.a, active: s.a.active.map((c) => ({ ...c, ...(c.deck === undefined ? {} : { deck: { ...c.deck, cards: [] } }) })) } };
    };
    expect(withoutCards(BROKEN_DECK)).toEqual(withoutCards(SWAPPED_DECK));
  });

  it("the subagent's generalization is the swapped deck's honest G at its real active slots, the same in both arms (Ruling 114)", () => {
    const state = createBattle(brokenDeckBattle(SWAPPED_DECK), SEEDS[0] as string);
    const forkling = state.creatures.find((c) => c.id === 'a-forkling');
    if (forkling === undefined) throw new Error('no Forkling');
    const slots = activeCards(state, forkling);
    expect(slots).toBe(3);
    const report = computeGeneralization(SWAPPED_DECK, DEPRECATED_FOREST_SUITE, slots);
    expect({ g: report.g, band: report.band }).toEqual({ g: 85, band: 'robust' });
    expect(FORKLING_G).toBe(report.g);
    for (const deck of [BROKEN_DECK, SWAPPED_DECK]) expect(brokenDeckBattle(deck).a.active[0]?.generalization).toBe(report.g);
  });

  it('the broken deck never heals; the swapped deck does', () => {
    const healed = (deck: Deck): boolean =>
      simulate(brokenDeckBattle(deck), SEEDS[0] as string, { kind: 'autopilot' }).events.some((e) => e.type === 'MoveUsed' && e.moveId === HEAL.move);
    expect(healed(BROKEN_DECK)).toBe(false);
    expect(healed(SWAPPED_DECK)).toBe(true);
  });

  it('the broken deck wins at most 20 of 200 seeds; the swapped deck wins at least 180', () => {
    const broken = wins(BROKEN_DECK);
    const swapped = wins(SWAPPED_DECK);
    expect({ broken, swapped, ok: broken <= 20 && swapped >= 180 }).toMatchObject({ ok: true });
  });
});
