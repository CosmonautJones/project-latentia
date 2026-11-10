import type { BattleSetup, SideSetup } from '../../src/battle/setup.js';
import type { Card, Condition, Deck, Subject, TargetSelector } from '../../src/cards/model.js';
import { mon, setup, side } from '../golden/builders.js';

// Slice fixtures for the training scenarios (spec §2 criterion 5): the first Deprecated Forest trainer at fixed
// levels, and the player's team whose subagent deck is under test. Bible "Deprecated Forest": the switchbacks'
// mandatory trainer "Bootcamp Grad" fights with the forest's bug family (an Off-By-Wasp orchestrating a Nullbeetle).

export const card = (id: string, subject: Subject, condition: Condition, move: string, target: TargetSelector): Card => ({ id, subject, condition, move, target });

/** True every round (round ≥ 1): a card that always fires while its move fits. */
export const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
/** The subject is below 50% HP. */
export const HURT: Condition = { category: 'hp', op: 'below', pct: 50 };

/**
 * Bootcamp Grad's Autopilot (6 cards, a v1 orchestrator's size in the bible): finish a weak foe with its signature, open
 * with a priority burst, guard on a cooldown, punish a buffed foe, compact once it drifts, else stack-trace the weakest foe.
 */
export const BOOTCAMP_AUTOPILOT: Deck = {
  cards: [
    card('finish', 'foe', { category: 'hp', op: 'below', pct: 25 }, 'off-by-one', 'lowestHpFoe'),
    card('opener', 'self', { category: 'turn', op: 'below', round: 2 }, 'token-burst', 'lowestHpFoe'),
    card('guard', 'self', { category: 'cooldown', rounds: 3 }, 'unit-test', 'self'),
    card('punish', 'foe', { category: 'foeBuffed' }, 'stack-trace', 'highestAtkFoe'),
    card('weak', 'foe', { category: 'foeType', is: 'weakToMove' }, 'off-by-one', 'foeWeakToMove'),
    card('drift', 'self', { category: 'status', status: 'drift' }, 'compact', 'self'),
  ],
  default: card('trace', 'self', ALWAYS, 'stack-trace', 'lowestHpFoe'),
};

// Fixture levels, temperatures, the heal condition and the subagent's generalization, tuned for criterion 5 (Rulings 108,
// 114 and, for the levels, 148; no species stat was changed). Each was chosen so that the fight turns on the one thing the
// arms differ in, whether the subagent heals: the starter Sagelet is the kill engine (Reasoning hits Code 1.5x) but
// fragile, and the trainer's Code attacks wear it down; kept alive by Community Patch it wins, left alone it falls
// before the second kill. Wins (broken / swapped) on the test's 200 seeds, unless noted, against 13 / 188 as tuned
// (33 / 369 on a 400-seed check list, seedFor(`check:${i}`)).
//
// Re-tuned for Ruling 148 (type chart 2x/1/2 -> 1.5x/2/3). The old levels (Sagelet 4, Forkling 6, Off-By-Wasp 6,
// Nullbeetle 6, which every other scenario still uses) gave 0 / 103 under the softer chart: Code hits Reasoning for 2/3 instead of 1/2 and Reasoning hits Code
// for 1.5x instead of 2x, so the starter is worn down faster and kills slower, and the heal alone no longer saves it.
// The pre-Ruling 148 tune was 1 / 199 (400-seed list 7 / 393). The fixture is still a knife edge, deliberately a fight
// decided by a few HP, so a single level moves it a long way. Neighbours of the new tune, one change at a time:
//   - Sagelet 4 → 3 / 1 (it falls before the heal matters); Sagelet 6 → 122 / 146 (the starter wins alone).
//   - Forkling 8 → 13 / 180; Forkling 10 → 17 / 183.
//   - Off-By-Wasp 7 → 81 / 189 (the trainer is too weak); Off-By-Wasp 9 → 13 / 182.
//   - Nullbeetle 6 → 83 / 176; Nullbeetle 8 → 0 / 22 (the heal is outpaced).
//   - Bootcamp Grad's Autopilot at T0 ("by the book"): flat rolls and few crits, so a lucky trainer crit seldom decides
//     the swapped arm. T1 → 15 / 154, T2 → 29 / 130.
//   - The player's Autopilot stays at T2 (the default): T0 → 13 / 199, T1 → 12 / 194, T3 → 12 / 171, T4 → 27 / 160.
//   - The heal fires when an ally is below 50%: below 75% → 13 / 189, below 25% → 13 / 191 (neither separates the arms
//     better or worse than 50%, so the 50% of the bible's example stays); healing itself instead (Forkling below 50% →
//     Community Patch on self) → 13 / 13, and an ally-below-50% card aimed at self → 13 / 10: either heals the wrong
//     creature, since the trainer is wearing down the starter, and the swapped arm loses its edge.
//   - The Forkling's generalization is FORKLING_G = 85, the deck's honest G: computeGeneralization(SWAPPED_DECK,
//     DEPRECATED_FOREST_SUITE, 3 active slots), pinned in broken-deck.test.ts. Both arms use it (the broken deck's own G
//     would be 88), so they differ only in card order. Any Robust value (>= 70) behaves the same, since Robust always obeys:
//     G = 100 or 70 → 13 / 188, identical to the tuned value. Stable 65 or 50 → 25 / 177 (disobedience costs the swapped
//     arm its gate), 30 → 42 / 165.
// In this battle the trainer is above the bible's switchbacks band (wilds Lv2-6) at Lv8 / Lv7; the fixture is a criterion-5 measuring
// rig, not slice content.

/**
 * The first Deprecated Forest trainer, Bootcamp Grad (side b): an Off-By-Wasp orchestrating a Nullbeetle, at Lv6 / Lv6 unless
 * `levels` says otherwise (the broken-deck scenario sets its own, see BROKEN_DECK_TRAINER).
 */
export function bootcampGrad(levels: { orchestrator: number; subagent: number } = { orchestrator: 6, subagent: 6 }): SideSetup {
  return {
    ...side('b', { orch: mon('b-wasp', 'off-by-wasp', levels.orchestrator), active: [mon('b-nullbeetle', 'nullbeetle', levels.subagent)] }),
    autopilot: { deck: BOOTCAMP_AUTOPILOT, temperature: 0 },
  };
}

/** The player's Autopilot (the same in both arms of the broken-deck test): finish a weak foe, else chain the weakest one. */
export const PLAYER_AUTOPILOT: Deck = {
  cards: [card('finish', 'foe', HURT, 'proof-by-contradiction', 'lowestHpFoe')],
  default: card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
};

/** The subagent's attack: Swarm of Fine-Tunes, a weak poke (one 20-power hit with no Open ally) that never needs a heal to fit. */
export const ATTACK = card('attack', 'self', ALWAYS, 'swarm-of-fine-tunes', 'lowestHpFoe');
/** The heal: Community Patch (30%) on the lowest-HP ally whenever an ally is below half HP. */
export const HEAL = card('heal', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'community-patch', 'lowestHpAlly');
const COMPACT = card('compact', 'self', ALWAYS, 'compact', 'self');

/** The broken deck (spec §2 criterion 5): the attack card always fires, so the heal card below it never does. */
export const BROKEN_DECK: Deck = { cards: [ATTACK, HEAL], default: COMPACT };
/** The same two cards swapped: heal a hurt ally, otherwise attack. */
export const SWAPPED_DECK: Deck = { cards: [HEAL, ATTACK], default: COMPACT };

/** The Forkling's generalization in both arms: the swapped deck's honest G over the Deprecated Forest suite (see above). */
export const FORKLING_G = 85;

/** The player's side (side a): the starter Sagelet on its Autopilot, with a Robust Forkling subagent acting from `deck`. */
export function playerTeam(deck: Deck): SideSetup {
  return {
    ...side('a', { orch: mon('a-sagelet', 'sagelet', 5), active: [{ ...mon('a-forkling', 'forkling', 9), deck, generalization: FORKLING_G }] }),
    autopilot: { deck: PLAYER_AUTOPILOT, temperature: 2 },
  };
}

/** Bootcamp Grad's levels in the criterion-5 battle (re-tuned for Ruling 148, see above); the other scenarios keep the Lv6 / Lv6 default. */
export const BROKEN_DECK_TRAINER = { orchestrator: 8, subagent: 7 } as const;

/** The criterion-5 battle: the player's team with `deck` against Bootcamp Grad. */
export const brokenDeckBattle = (deck: Deck): BattleSetup => setup(playerTeam(deck), bootcampGrad(BROKEN_DECK_TRAINER));
