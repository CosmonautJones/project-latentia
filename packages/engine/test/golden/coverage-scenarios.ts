import type { CreatureSetup } from '../../src/battle/setup.js';
import type { Card, Condition, Deck, TargetSelector } from '../../src/cards/model.js';
import { cycle, mon, scenario, setup, side, type GoldenScenario } from './builders.js';

// Goldens added for coverage in B6 (Ruling 110): a high-damage Handoff Chain whose 2nd and 3rd hits pin the 11500
// and 13000 modifiers (B4.5 m1), and a deck whose Default card a status disables (Ruling 86 fallback; B4 m2).

const card = (id: string, condition: Condition, move: string, target: TargetSelector): Card => ({ id, subject: 'self', condition, move, target });
const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
const trained = (c: CreatureSetup, deck: Deck): CreatureSetup => ({ ...c, deck, generalization: 90 });

const TRACE: Deck = { cards: [card('trace', ALWAYS, 'stack-trace', 'lowestHpFoe')], default: card('off', ALWAYS, 'off-by-one', 'lowestHpFoe') };

/** Token Burst on its first round, then (Default) Token Nibble: once Overfit locks it onto Token Burst, Default is disabled. */
const OPENER: Deck = { cards: [card('opener', { category: 'turn', op: 'below', round: 2 }, 'token-burst', 'lowestHpFoe')], default: card('nibble', ALWAYS, 'token-nibble', 'lowestHpFoe') };

export const COVERAGE_SCENARIOS: readonly GoldenScenario[] = [
  // Handoff Chain at high levels (Ruling 97): side A's three fast attackers (Latency 80 / 70 / 70 at L60) all act before
  // side B's lone, slow Cobolt (Latency 40, L70) every round and hit it in a row, so each round builds a 3-hit chain
  // (HandoffChain [x], [x, y], [x, y, z]) whose 2nd and 3rd hits take 11500 and 13000. The hits deal well over 24
  // damage, so neither modifier can floor to the value of its Ruling 39 predecessor (11000 / 12000): see golden.test.ts.
  scenario(
    'handoff-chain-high-damage',
    setup(
      side('a', { orch: mon('a-blitzr', 'blitzr', 60), active: [trained(mon('a-wasp', 'off-by-wasp', 60), TRACE), trained(mon('a-wasp2', 'off-by-wasp', 60), TRACE)] }),
      side('b', { orch: mon('b-cobolt', 'cobolt', 70) }),
    ),
    { a: cycle(['distilled-strike', 'ship-it'], [0]), b: cycle(['long-term-recall'], [0]) },
  ),
  // A status disables a deck's Default (Ruling 86): b-nullbeetle keeps casting Infinite Loop (Overfit) on a-tokenibble,
  // whose deck fires Token Burst in round 1 and otherwise falls to Default (Token Nibble). Once Overfit locks it onto
  // Token Burst, Default's move is forbidden: it falls back to its no-deck default intent (its first move a status
  // allows) and its CardTrace names Default as fired with Default skipped `moveDisabled` — exactly once.
  scenario(
    'default-disabled-fallback',
    setup(
      side('a', { orch: mon('a-sagelet', 'sagelet', 14), active: [trained(mon('a-tokenibble', 'tokenibble', 12, ['token-burst', 'token-nibble', 'low-latency']), OPENER)] }),
      side('b', { orch: mon('b-nullbeetle', 'nullbeetle', 16, ['infinite-loop', 'null-chomp']) }),
    ),
    { a: cycle(['chain-of-thought'], [1]), b: cycle(['infinite-loop'], [0], 'foeSub') },
  ),
];
