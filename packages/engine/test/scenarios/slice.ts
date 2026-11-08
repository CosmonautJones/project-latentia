import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import { mon, setup, side } from '../golden/builders.js';
import { ALWAYS, bootcampGrad, card, HURT } from './fixtures.js';

// The slice's trainers and the three starter teams (bible build list item 9: "3 forest trainers, 2 grunts, 2 gym
// trainers, Gary Rebase"; Deprecated Forest and Compile Hall sections), all on Autopilot decks of 6–10 cards with
// subagent decks of 4–8 cards. BENCH_SETUPS (Ruling 109) is the fixed deck-driven benchmark set: each starter team
// against the forest trainers, the Team Scrape grunts and the Compile Hall gym, at slice levels (Lv4–13).

const deck = (def: Card, ...cards: Card[]): Deck => ({ cards, default: def });
const weak: Condition = { category: 'hp', op: 'below', pct: 25 };
const healthy: Condition = { category: 'hp', op: 'atLeast', pct: 75 };
const allyHurt: Condition = { category: 'allyHp', op: 'below', pct: 50 };
const full: Condition = { category: 'contextFill', op: 'atLeast', pct: 75 };
const opener: Condition = { category: 'turn', op: 'below', round: 2 };
const coin: Condition = { category: 'coin' };
const drift: Condition = { category: 'status', status: 'drift' };
const cooldown = (rounds: 1 | 2 | 3): Condition => ({ category: 'cooldown', rounds });

const trained = (c: CreatureSetup, d: Deck, generalization: number, version: CreatureSetup['version'] = 'v1'): CreatureSetup => ({ ...c, deck: d, generalization, version });
const auto = (s: SideSetup, d: Deck, temperature: 0 | 1 | 2 | 3 | 4 = 2): SideSetup => ({ ...s, autopilot: { deck: d, temperature } });

// --- subagent decks -----------------------------------------------------------------------------------------------

const TOKENIBBLE = deck(
  card('nibble', 'self', ALWAYS, 'token-nibble', 'lowestHpFoe'),
  card('exit', 'foe', weak, 'early-exit', 'lowestHpFoe'),
  card('burst', 'self', opener, 'token-burst', 'randomFoe'),
  card('speed', 'self', cooldown(3), 'low-latency', 'self'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const EMBEDDINGO = deck(
  card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
  card('cure', 'self', { category: 'status', status: 'glazed' }, 'ground-truth', 'self'),
  card('sniff', 'foe', { category: 'foeType', is: 'weakToMove' }, 'cosine-sniff', 'foeWeakToMove'),
  card('cite', 'foe', HURT, 'citation-needed', 'lowestHpFoe'),
  card('focus', 'self', coin, 'retrieval-strike', 'orchestratorTarget'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const COBOLT = deck(
  card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
  card('patch', 'self', allyHurt, 'hotfix', 'lowestHpAlly'),
  card('batch', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
  card('clean', 'self', drift, 'refactor', 'self'),
);
const HALLUCINAT = deck(
  card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
  card('probe', 'self', cooldown(3), 'socratic-method', 'highestAtkFoe'),
  card('proof', 'foe', HURT, 'proof-by-contradiction', 'lowestHpFoe'),
  card('patch', 'foe', { category: 'foeType', is: 'weakToMove' }, 'adversarial-patch', 'foeWeakToMove'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const NULLBEETLE = deck(
  card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
  card('guard', 'self', { category: 'hp', op: 'below', pct: 50 }, 'unit-test', 'self'),
  card('crash', 'foe', healthy, 'segfault', 'highestAtkFoe'),
  card('loop', 'foe', { category: 'foeLastMove', move: 'hype-train' }, 'infinite-loop', 'highestAtkFoe'),
);
const SLOPLING = deck(
  card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
  card('dump', 'foe', weak, 'weights-dump', 'lowestHpFoe'),
  card('patch', 'self', coin, 'adversarial-patch', 'randomFoe'),
  card('swarm', 'self', opener, 'swarm-of-fine-tunes', 'lowestHpFoe'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const HEISENMOTH = deck(
  card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
  card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
  card('box', 'self', cooldown(3), 'bounding-box', 'self'),
  card('refactor', 'self', drift, 'refactor', 'self'),
);

// --- the three starter teams (side a) ------------------------------------------------------------------------------

const SAGELET_AUTOPILOT = deck(
  card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
  card('finish', 'foe', weak, 'proof-by-contradiction', 'lowestHpFoe'),
  card('think', 'self', cooldown(3), 'step-back-prompt', 'self'),
  card('weak', 'foe', { category: 'foeType', is: 'weakToMove' }, 'happy-to-help', 'foeWeakToMove'),
  card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
  card('tidy', 'self', full, 'compact', 'self'),
  card('drift', 'self', drift, 'compact', 'self'),
);
const BLITZR_AUTOPILOT = deck(
  card('ship', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
  card('finish', 'foe', weak, 'token-burst', 'lowestHpFoe'),
  card('strike', 'foe', HURT, 'distilled-strike', 'lowestHpFoe'),
  card('speed', 'self', cooldown(3), 'low-latency', 'self'),
  card('coin', 'self', coin, 'distilled-strike', 'randomFoe'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const FORKLING_AUTOPILOT = deck(
  card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
  card('patch', 'self', allyHurt, 'community-patch', 'lowestHpAlly'),
  card('flex', 'self', healthy, 'leaderboard-flex', 'highestAtkFoe'),
  card('swarm', 'foe', weak, 'swarm-of-fine-tunes', 'lowestHpFoe'),
  card('focus', 'self', coin, 'hard-fork', 'randomFoe'),
  card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
  card('tidy', 'self', full, 'compact', 'self'),
  card('drift', 'self', drift, 'clear', 'self'),
);

/** The intern Tokenibble (bundled with every starter) at level `lv`. */
const intern = (lv: number): CreatureSetup => trained(mon('a-tokenibble', 'tokenibble', lv), TOKENIBBLE, 55);

/** Sagelet's team with the starter at level `lv` and its subagents one below: Tokenibble and Embeddingo, a Cobolt on the bench. */
export const SAGELET_TEAM = (lv: number): SideSetup =>
  auto(side('a', { orch: mon('a-sagelet', 'sagelet', lv), active: [intern(lv - 1), trained(mon('a-embeddingo', 'embeddingo', lv - 1), EMBEDDINGO, 72, 'v2')], bench: [trained(mon('a-cobolt', 'cobolt', lv - 1), COBOLT, 45)] }), SAGELET_AUTOPILOT, 1);
/** Blitzr's team: Tokenibble and Hallucinat, a Nullbeetle on the bench. */
export const BLITZR_TEAM = (lv: number): SideSetup =>
  auto(side('a', { orch: mon('a-blitzr', 'blitzr', lv), active: [intern(lv - 1), trained(mon('a-hallucinat', 'hallucinat', lv - 1), HALLUCINAT, 60, 'v2')], bench: [trained(mon('a-nullbeetle', 'nullbeetle', lv - 1), NULLBEETLE, 35)] }), BLITZR_AUTOPILOT, 2);
/** Forkling's team: Tokenibble and Slopling, a Heisenmoth on the bench. */
export const FORKLING_TEAM = (lv: number): SideSetup =>
  auto(side('a', { orch: mon('a-forkling', 'forkling', lv), active: [intern(lv - 1), trained(mon('a-slopling', 'slopling', lv - 1), SLOPLING, 50, 'v2')], bench: [trained(mon('a-heisenmoth', 'heisenmoth', lv - 1), HEISENMOTH, 80)] }), FORKLING_AUTOPILOT, 2);

// --- trainers (side b) ---------------------------------------------------------------------------------------------

/** Retro Collector (optional forest trainer): a Deprecatter with an old Cobolt and a mimic Stochastiparrot. */
export const RETRO_COLLECTOR = (): SideSetup =>
  auto(
    side('b', { orch: mon('b-deprecatter', 'deprecatter', 7), active: [mon('b-cobolt', 'cobolt', 6), mon('b-parrot', 'stochastiparrot', 6)] }),
    deck(
      card('trip', 'self', ALWAYS, 'nostalgia-trip', 'lowestHpFoe'),
      card('save', 'self', opener, 'save-state', 'self'),
      card('replay', 'foe', HURT, 'episodic-replay', 'self'),
      card('recall', 'self', cooldown(2), 'long-term-recall', 'highestAtkFoe'),
      card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
      card('tidy', 'self', full, 'compact', 'self'),
    ),
    1,
  );

/** Prompt Engineer (optional forest trainer, teaches type matchups): an Embeddingo that always looks for a weakness. */
export const PROMPT_ENGINEER = (): SideSetup =>
  auto(
    side('b', { orch: mon('b-embeddingo', 'embeddingo', 7), active: [mon('b-parrot', 'stochastiparrot', 6), trained(mon('b-heisenmoth', 'heisenmoth', 6), HEISENMOTH, 50)] }),
    deck(
      card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
      card('weak', 'foe', { category: 'foeType', is: 'weakToMove' }, 'cosine-sniff', 'foeWeakToMove'),
      card('ground', 'self', { category: 'status', status: 'hallucinating' }, 'ground-truth', 'self'),
      card('cite', 'foe', HURT, 'citation-needed', 'lowestHpFoe'),
      card('coin', 'self', coin, 'cosine-sniff', 'randomFoe'),
      card('tidy', 'self', full, 'compact', 'self'),
    ),
    2,
  );

const SCRAPION_AUTOPILOT = deck(
  card('scrape', 'self', ALWAYS, 'scrape', 'highestAtkFoe'),
  card('steal', 'foe', { category: 'foeBuffed' }, 'scrape', 'highestAtkFoe'),
  card('finish', 'foe', weak, 'retrieval-strike', 'lowestHpFoe'),
  card('check', 'self', cooldown(3), 'fact-check', 'highestAtkFoe'),
  card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
  card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
  card('tidy', 'self', full, 'compact', 'self'),
);

/** Team Scrape Grunt A (the mandatory camp fight): Scrapion and Nullbeetle. */
export const GRUNT_A = (): SideSetup =>
  auto(side('b', { orch: mon('b-scrapion', 'scrapion', 8), active: [trained(mon('b-nullbeetle', 'nullbeetle', 7), NULLBEETLE, 45)] }), SCRAPION_AUTOPILOT, 2);
/** Team Scrape Grunt B (the optional patrol): Scrapion with a scraped Slopling and a Nullbeetle. */
export const GRUNT_B = (): SideSetup =>
  auto(side('b', { orch: mon('b-scrapion', 'scrapion', 8), active: [trained(mon('b-slopling', 'slopling', 7), SLOPLING, 40), mon('b-nullbeetle', 'nullbeetle', 7)] }), SCRAPION_AUTOPILOT, 3);

const VIBRAT_AUTOPILOT = deck(
  card('merge', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
  card('accept', 'foe', HURT, 'accept-all', 'lowestHpFoe'),
  card('hype', 'self', opener, 'hype-train', 'self'),
  card('crash', 'foe', healthy, 'segfault', 'highestAtkFoe'),
  card('coin', 'self', coin, 'accept-all', 'randomFoe'),
  card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
  card('tidy', 'self', full, 'compact', 'self'),
  card('drift', 'self', drift, 'clear', 'self'),
);
const AGENTOAD = deck(
  card('trace', 'self', ALWAYS, 'stack-trace', 'lowestHpFoe'),
  card('tools', 'foe', healthy, 'tool-call', 'highestAtkFoe'),
  card('rerank', 'self', cooldown(3), 'rerank', 'orchestrator'),
  card('burst', 'foe', weak, 'token-burst', 'lowestHpFoe'),
  card('tidy', 'self', full, 'compact', 'self'),
);
const WASP = deck(
  card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
  card('trace', 'foe', healthy, 'stack-trace', 'highestAtkFoe'),
  card('test', 'self', cooldown(3), 'unit-test', 'self'),
  card('burst', 'foe', weak, 'token-burst', 'lowestHpFoe'),
);

/** Compile Hall gym trainer (Room 2's optional trainer): a Vibrat with an Off-By-Wasp. */
export const GYM_TRAINER = (): SideSetup =>
  auto(side('b', { orch: mon('b-vibrat', 'vibrat', 10), active: [trained(mon('b-wasp', 'off-by-wasp', 9), WASP, 60), trained(mon('b-agentoad', 'agentoad', 9), AGENTOAD, 50)] }), VIBRAT_AUTOPILOT, 2);

/** Gary Rebase, the Compile Hall leader: a Spaghettopus with the leader subagents Vibrat and Agentoad. */
export const GARY_REBASE = (): SideSetup =>
  auto(
    side('b', {
      orch: mon('b-spaghettopus', 'spaghettopus', 12),
      active: [trained(mon('b-vibrat', 'vibrat', 11), deck(card('merge', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'), card('accept', 'foe', HURT, 'accept-all', 'lowestHpFoe'), card('hype', 'self', opener, 'hype-train', 'self'), card('crash', 'self', coin, 'segfault', 'randomFoe')), 75, 'v2'), trained(mon('b-agentoad', 'agentoad', 11), AGENTOAD, 70, 'v2')],
      bench: [trained(mon('b-nullbeetle', 'nullbeetle', 10), NULLBEETLE, 50)],
    }),
    deck(
      card('tangle', 'self', ALWAYS, 'tangle', 'highestAtkFoe'),
      card('leak', 'self', cooldown(3), 'memory-leak', 'lowestHpFoe'),
      card('loop', 'foe', { category: 'foeBuffed' }, 'infinite-loop', 'highestAtkFoe'),
      card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
      card('finish', 'foe', weak, 'tangle', 'lowestHpFoe'),
      card('coin', 'self', coin, 'merge-conflict', 'randomFoe'),
      card('guard', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
      card('tidy', 'self', full, 'compact', 'self'),
      card('drift', 'self', drift, 'clear', 'self'),
      card('late', 'self', { category: 'turn', op: 'atLeast', round: 8 }, 'tangle', 'lowestHpFoe'),
    ),
    1,
  );

/**
 * The deck-driven benchmark set (Ruling 109): every side on its Autopilot deck, most subagents on decks. Each starter's
 * level puts its fight in the bible's 5–8-round band with both sides winning some seeds (no lopsided 2-round wins).
 */
export const BENCH_SETUPS: readonly { name: string; setup: BattleSetup }[] = [
  { name: 'blitzr-vs-bootcamp-grad', setup: setup(BLITZR_TEAM(4), bootcampGrad()) },
  { name: 'sagelet-vs-retro-collector', setup: setup(SAGELET_TEAM(5), RETRO_COLLECTOR()) },
  { name: 'forkling-vs-prompt-engineer', setup: setup(FORKLING_TEAM(5), PROMPT_ENGINEER()) },
  { name: 'sagelet-vs-grunt-a', setup: setup(SAGELET_TEAM(5), GRUNT_A()) },
  { name: 'forkling-vs-grunt-b', setup: setup(FORKLING_TEAM(8), GRUNT_B()) },
  { name: 'blitzr-vs-gym-trainer', setup: setup(BLITZR_TEAM(10), GYM_TRAINER()) },
  { name: 'sagelet-vs-gary-rebase', setup: setup(SAGELET_TEAM(10), GARY_REBASE()) },
  { name: 'blitzr-vs-gary-rebase', setup: setup(BLITZR_TEAM(13), GARY_REBASE()) },
];
