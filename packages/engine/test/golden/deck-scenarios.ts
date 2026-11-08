import type { CreatureSetup } from '../../src/battle/setup.js';
import type { Card, Condition, Deck, Subject, TargetSelector } from '../../src/cards/model.js';
import type { GridLayout } from '../../src/grid/model.js';
import { cycle, mon, opened, scenario, setup, side, type GoldenScenario } from './builders.js';

// The deck battles (Phase B): subagents acting from decks, so the goldens carry IntentsPlanned with card ids,
// CardTrace with every skip reason, obedience failures and Brittle repeats (B2), then the levers that act on decks:
// Policy Update and Directive (B3).

const card = (id: string, subject: Subject, condition: Condition, move: string, target: TargetSelector): Card => ({ id, subject, condition, move, target });
/** The actor is at 25% HP or more. */
const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 };

/** A subagent of `version` and `generalization` acting from `deck`. */
const trained = (c: CreatureSetup, deck: Deck, generalization: number, version: CreatureSetup['version'] = 'v1'): CreatureSetup => ({ ...c, version, deck, generalization });

// Side A's 5×4 grid (an L4–6 orchestrator): slot0 has three adjacent Example Cards (a v2 subagent: 3 active
// cards), slot1 shares two of them (a v1 subagent: 2 active cards); 6 cells of headroom.
const SLOT: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
const ONE: [number, number][] = [[0, 0]];
const DECK_GRID: GridLayout = {
  width: 5,
  height: 4,
  pieces: [
    { id: 'sp', kind: 'systemPrompt', shape: [[0, 0], [1, 0], [2, 0]], anchor: [0, 0], rotation: 0 },
    { id: 'slot0', kind: 'subagentSlot', shape: SLOT, anchor: [0, 1], rotation: 0, subagentId: 'a-blitzr' },
    { id: 'slot1', kind: 'subagentSlot', shape: SLOT, anchor: [3, 1], rotation: 0, subagentId: 'a-cobolt' },
    { id: 'ex0', kind: 'exampleCard', shape: ONE, anchor: [2, 1], rotation: 0 },
    { id: 'ex1', kind: 'exampleCard', shape: ONE, anchor: [2, 2], rotation: 0 },
    { id: 'ex2', kind: 'exampleCard', shape: ONE, anchor: [0, 3], rotation: 0 },
  ],
};

/** Robust: finishes weak foes, buffs on a self-imposed cooldown (moveDisabled while Glazed), else flips a coin; `late` is never active. */
const BLITZ: Deck = {
  cards: [
    card('finish', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'distilled-strike', 'lowestHpFoe'),
    card('buff', 'self', { category: 'cooldown', rounds: 3 }, 'low-latency', 'self'),
    card('coin', 'self', { category: 'coin' }, 'token-burst', 'randomFoe'),
    card('late', 'self', { category: 'turn', op: 'atLeast', round: 2 }, 'ship-it', 'orchestratorTarget'),
  ],
  default: card('ship', 'self', T, 'ship-it', 'lowestHpFoe'),
};

/**
 * Stable: batches a weak foe, else grinds the weakest one — 3-cell moves in a 10-cell window, so once it is
 * nearly full both are skipped as insufficientContext and Default compacts; `fix` is never active.
 */
const COBOLT: Deck = {
  cards: [
    card('batch', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'batch-job', 'lowestHpFoe'),
    card('grind', 'self', T, 'batch-job', 'lowestHpFoe'),
    card('fix', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'hotfix', 'lowestHpAlly'),
  ],
  default: card('compact', 'self', T, 'compact', 'self'),
};

/** Stable: chomps an Overfit foe, else loops its orchestrator's target while at 25% HP or more, else (Default) the strongest foe. */
const BEETLE: Deck = {
  cards: [
    card('chomp', 'foe', { category: 'status', status: 'overfit' }, 'null-chomp', 'lowestHpFoe'),
    card('follow', 'self', T, 'infinite-loop', 'orchestratorTarget'),
  ],
  default: card('loop', 'self', T, 'infinite-loop', 'highestAtkFoe'),
};

/** Brittle: a coin-flip card (disobeyed 15% of the time) over rare cards; Token Burst is its most-represented move. */
const BRITTLE_BLITZ: Deck = {
  cards: [
    card('coin', 'self', { category: 'coin' }, 'ship-it', 'lowestHpFoe'),
    card('low', 'foe', { category: 'hp', op: 'below', pct: 25 }, 'distilled-strike', 'lowestHpFoe'),
    card('opener', 'self', { category: 'turn', op: 'below', round: 2 }, 'token-burst', 'randomFoe'),
    card('desperate', 'self', { category: 'hp', op: 'below', pct: 25 }, 'token-burst', 'highestAtkFoe'),
  ],
  default: card('buff', 'self', T, 'low-latency', 'self'),
};

/** Brittle: cards that almost never match, so it keeps repeating Hot Take. */
const BRITTLE_PARROT: Deck = {
  cards: [
    card('flatter', 'foe', { category: 'foeBuffed' }, 'flattery', 'highestAtkFoe'),
    card('full', 'self', { category: 'contextFill', op: 'atLeast', pct: 75 }, 'hot-take', 'lowestHpFoe'),
    card('punish', 'foe', { category: 'telegraphing' }, 'hot-take', 'lowestHpFoe'),
  ],
  default: card('hype', 'self', T, 'hype-train', 'self'),
};

/** Brittle: a coin-flip swarm, a heal when hurt; ties for the repeat go to Swarm of Fine-Tunes (first in the deck). */
const BRITTLE_FORK: Deck = {
  cards: [
    card('coin', 'self', { category: 'coin' }, 'swarm-of-fine-tunes', 'randomFoe'),
    card('mend', 'self', { category: 'hp', op: 'below', pct: 50 }, 'community-patch', 'self'),
  ],
  default: card('fork', 'self', T, 'hard-fork', 'lowestHpFoe'),
};

/** Robust: batches a weak foe, else (Default) grinds the weakest one. It knows Long-Term Recall, the policy's move. */
const POLICY_COBOLT: Deck = {
  cards: [card('batch', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'batch-job', 'lowestHpFoe')],
  default: card('grind', 'self', T, 'batch-job', 'lowestHpFoe'),
};

/** Stable: finishes a weak foe, else (Default) ships. It does not know Long-Term Recall. */
const POLICY_BLITZ: Deck = {
  cards: [card('finish', 'foe', { category: 'hp', op: 'below', pct: 50 }, 'distilled-strike', 'lowestHpFoe')],
  default: card('ship', 'self', T, 'ship-it', 'lowestHpFoe'),
};

/** The team-wide rule: recall into the weakest foe while at 25% HP or more. */
const RECALL_POLICY: Card = card('recall', 'self', T, 'long-term-recall', 'lowestHpFoe');

export const DECK_SCENARIOS: readonly GoldenScenario[] = [
  // Gridded active-card counts (3 and 2), notActive, insufficientContext, moveDisabled (Glazed), orchestratorTarget,
  // randomFoe and coin; side B's Nullbeetle acts from a deck, its Wasp from its default intent.
  scenario(
    'deck-subagents',
    setup(
      {
        ...side('a', {
          orch: { ...mon('a-sagelet', 'sagelet', 6), moves: [] },
          active: [trained(mon('a-blitzr', 'blitzr', 10), BLITZ, 75, 'v2'), trained(mon('a-cobolt', 'cobolt', 10), COBOLT, 50)],
          bench: [mon('a-tokenibble', 'tokenibble', 10)],
        }),
        grid: DECK_GRID,
      },
      side('b', {
        orch: mon('b-parrot', 'stochastiparrot', 12),
        active: [trained(mon('b-nullbeetle', 'nullbeetle', 10), BEETLE, 45), mon('b-wasp', 'off-by-wasp', 10)],
        bench: [mon('b-forkling', 'forkling', 10)],
      }),
    ),
    { a: cycle(['happy-to-help', 'happy-to-help', 'compact'], [2], 'foeSub'), b: cycle(['flattery', 'hot-take', 'hot-take'], [2], 'foeSub') },
  ),
  // Brittle decks on both sides: disobeyed coin cards and Brittle repeats (Token Burst, Hot Take, Swarm).
  scenario(
    'brittle-repeat',
    setup(
      side('a', {
        orch: mon('a-cobolt', 'cobolt', 12),
        active: [trained(mon('a-blitzr', 'blitzr', 10), BRITTLE_BLITZ, 20), trained(mon('a-parrot', 'stochastiparrot', 10), BRITTLE_PARROT, 10)],
      }),
      side('b', {
        orch: mon('b-hallucinat', 'hallucinat', 12),
        active: [trained(mon('b-forkling', 'forkling', 10), BRITTLE_FORK, 30), mon('b-wasp', 'off-by-wasp', 10)],
      }),
    ),
    { a: cycle(['batch-job', 'long-term-recall', 'hotfix'], [2], 'foeSub'), b: cycle(['confident-citation', 'socratic-method'], [1]) },
  ),
  // Policy Update in round 1, in force for rounds 1-3: a-cobolt (slower than its orchestrator) re-evaluates from the
  // top in round 1 and fires it, then plans it in rounds 2-3; a-blitzr does not know its move (moveDisabled). The
  // round-3 Directive to a-blitzr (faster than its orchestrator) is spent; the round-4 one to a-cobolt lands.
  scenario(
    'policy-update-and-directive',
    setup(
      side('a', {
        orch: mon('a-sagelet', 'sagelet', 24),
        active: [trained(mon('a-cobolt', 'cobolt', 22), POLICY_COBOLT, 80), trained(mon('a-blitzr', 'blitzr', 22), POLICY_BLITZ, 50)],
      }),
      side('b', {
        orch: mon('b-cobolt', 'cobolt', 20),
        active: [mon('b-deprecatter', 'deprecatter', 18), mon('b-slopling', 'slopling', 18)],
        bench: [mon('b-forkling', 'forkling', 16)],
      }),
    ),
    {
      a: opened([{ policy: RECALL_POLICY }, { move: 'happy-to-help' }, { directive: { slot: 1, moveId: 'token-burst' } }, { directive: { slot: 0, moveId: 'hotfix' } }], cycle(['chain-of-thought', 'happy-to-help', 'compact'])),
      b: cycle(['refactor', 'batch-job', 'hotfix'], [1], 'foeSub'),
    },
  ),
];
