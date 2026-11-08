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

// Fixture levels, temperatures, the heal condition and the subagent's generalization, tuned for criterion 5 (Rulings 108
// and 114; no species stat was changed). Each was chosen so
// that the fight turns on the one thing the arms differ in, whether the subagent heals: the starter Sagelet is the kill
// engine (Reasoning hits Code 2x) but fragile, and the trainer's Code attacks wear it down in about three rounds; kept
// alive by Community Patch it wins, left alone it falls before the second kill. Wins (broken / swapped) on the test's
// 200 seeds, unless noted, against 1 / 199 as tuned:
//   - Bootcamp Grad's Off-By-Wasp 6 and Nullbeetle 6 (the switchbacks band, wilds Lv2-6): both at 5 → 88 / 200 (the
//     starter often wins without a heal); both at 7 → 1 / 30 (the heal is outpaced).
//   - Bootcamp Grad's Autopilot at T0 ("by the book"): flat rolls and few crits, so a lucky trainer crit seldom decides
//     the swapped arm. On a 400-seed check list (seedFor(`check:${i}`)): T0 7 / 393, T1 7 / 380, T2 14 / 381.
//   - Sagelet 4: at 5 → 154 / 200 (it seldom needs the heal). Forkling 6: at 5 → 1 / 44 (too frail to keep healing),
//     at 7 → 1 / 199 (no change).
//   - The player's Autopilot at T2 (the default): T0 or T1 → 1 / 200, T3 → 1 / 188, T4 → 3 / 181.
//   - The heal fires when an ally is below 50%: below 75% → 1 / 199, below 25% → 1 / 158 (too late); healing itself
//     when the Forkling is below 50% → 1 / 3 (it heals the wrong creature: the trainer is wearing down the starter).
//   - The Forkling's generalization is FORKLING_G = 85, the deck's honest G: computeGeneralization(SWAPPED_DECK,
//     DEPRECATED_FOREST_SUITE, 3 active slots), pinned in broken-deck.test.ts. Both arms use it (the broken deck's own G
//     would be 88), so they differ only in card order. Any Robust value (≥ 70) gives the same 1 / 199, since Robust always
//     obeys; Stable 65 or 50 → 4 / 177 (5% disobedience costs the swapped arm its gate), 30 → 17 / 148.

/** The first Deprecated Forest trainer, Bootcamp Grad, at fixed levels (side b): an Off-By-Wasp orchestrating a Nullbeetle. */
export function bootcampGrad(): SideSetup {
  return {
    ...side('b', { orch: mon('b-wasp', 'off-by-wasp', 6), active: [mon('b-nullbeetle', 'nullbeetle', 6)] }),
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
    ...side('a', { orch: mon('a-sagelet', 'sagelet', 4), active: [{ ...mon('a-forkling', 'forkling', 6), deck, generalization: FORKLING_G }] }),
    autopilot: { deck: PLAYER_AUTOPILOT, temperature: 2 },
  };
}

/** The criterion-5 battle: the player's team with `deck` against Bootcamp Grad. */
export const brokenDeckBattle = (deck: Deck): BattleSetup => setup(playerTeam(deck), bootcampGrad());
