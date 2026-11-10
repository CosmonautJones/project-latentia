import type { Archetype } from '../types.js';
import { ALLY_HURT, ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, FULL, hasStatus, HEALTHY, HURT, inField, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';
import { STARTER_SKILLS, type StarterId } from './starter-grids.js';

// Mixed builds (spec §9): the three starters as a player brings them to the gym — Tokenibble (the first wild model) and a
// forest catch active, a second catch on the bench — and a Heisenmoth tempo build.

/**
 * A starter's full-team grid (Ruling 130: two Subagent Slots; not starterGrid, which has one): the starter's three
 * Skills from STARTER_SKILLS, the single definition starterGrid also uses, and one Tool on K and M, with the intern
 * in slot A and the catch in slot B sharing two Example Cards. 20 cells, headroom 5. Compaction order: Skill L, M,
 * K, then the slots.
 */
function teamGrid(species: StarterId, catchId: string) {
  const s = STARTER_SKILLS[species];
  return layout(['PPPLL', 'AAeBB', 'AAeBB', 'KKtMM', '.....'], { L: { skill: s.L }, M: { skill: s.M }, K: { skill: s.K }, A: { slot: 'intern' }, B: { slot: catchId } });
}

/** The intern's deck: two cards, the active count of its slot on the team grid (Ruling 132). */
const INTERN = deck(
  card('nibble', 'self', ALWAYS, 'token-nibble', 'lowestHpFoe'),
  card('exit', 'foe', WEAK, 'early-exit', 'lowestHpFoe'),
  card('burst', 'self', OPENER, 'token-burst', 'randomFoe'),
);

/** Tokenibble (the first wild model, spun up) at the starter's level (Stable, trained warm). */
const intern = (level: number) => subagent('intern', 'tokenibble', level, { deck: INTERN, generalization: 55, trainedTemperature: 2 });

const SAGELET_STARTER = archetype('mixed-starter-sagelet', {
  orchestrator: orchestrator('sagelet', 'sagelet', 8),
  active: [
    intern(8),
    subagent('cobolt', 'cobolt', 8, {
      deck: deck(
        card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
        card('patch', 'self', ALLY_HURT, 'hotfix', 'lowestHpAlly'),
        card('batch', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
      ),
      generalization: 45,
      trainedTemperature: 1,
    }),
  ],
  bench: [
    subagent('embeddingo', 'embeddingo', 8, {
      deck: deck(
        card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
        card('sniff', 'foe', WEAK_TO_MOVE, 'cosine-sniff', 'foeWeakToMove'),
        card('cure', 'self', hasStatus('glazed'), 'ground-truth', 'self'),
      ),
      generalization: 60,
      trainedTemperature: 2,
    }),
  ],
  grid: teamGrid('sagelet', 'cobolt'),
  autopilot: deck(
    card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'proof-by-contradiction', 'lowestHpFoe'),
    card('think', 'self', cooldown(3), 'step-back-prompt', 'self'),
    card('weak', 'foe', WEAK_TO_MOVE, 'happy-to-help', 'foeWeakToMove'),
    card('punish', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('tidy', 'self', FULL, 'proof-by-contradiction', 'orchestratorTarget'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('coin', 'self', COIN, 'happy-to-help', 'randomFoe'),
  ),
  temperature: 1,
});

const BLITZR_STARTER = archetype('mixed-starter-blitzr', {
  orchestrator: orchestrator('blitzr', 'blitzr', 8),
  active: [
    intern(8),
    subagent('nullbeetle', 'nullbeetle', 8, {
      deck: deck(
        card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
        card('guard', 'self', HURT, 'unit-test', 'self'),
        card('crash', 'foe', HEALTHY, 'segfault', 'highestAtkFoe'),
      ),
      generalization: 35,
      trainedTemperature: 1,
    }),
  ],
  bench: [
    subagent('hallucinat', 'hallucinat', 8, {
      deck: deck(
        card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
        card('probe', 'self', cooldown(3), 'socratic-method', 'highestAtkFoe'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
      ),
      generalization: 50,
      trainedTemperature: 3,
    }),
  ],
  grid: teamGrid('blitzr', 'nullbeetle'),
  autopilot: deck(
    card('ship', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
    card('speed', 'self', cooldown(3), 'low-latency', 'self'),
    card('weak', 'foe', WEAK_TO_MOVE, 'distilled-strike', 'foeWeakToMove'),
    card('tidy', 'foe', hasStatus('glazed'), 'compact', 'self'),
    card('strike', 'foe', HURT, 'distilled-strike', 'lowestHpFoe'),
    card('drift', 'self', DRIFT, 'guardrail', 'self'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'distilled-strike', 'randomFoe'),
  ),
  temperature: 2,
});

const FORKLING_STARTER = archetype('mixed-starter-forkling', {
  orchestrator: orchestrator('forkling', 'forkling', 8),
  active: [
    intern(8),
    subagent('heisenmoth', 'heisenmoth', 8, {
      deck: deck(
        card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
        card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
        card('box', 'self', cooldown(3), 'bounding-box', 'self'),
      ),
      generalization: 80,
      trainedTemperature: 3,
    }),
  ],
  bench: [
    subagent('slopling', 'slopling', 8, {
      deck: deck(
        card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
        card('dump', 'foe', WEAK, 'weights-dump', 'lowestHpFoe'),
        card('patch', 'self', COIN, 'adversarial-patch', 'randomFoe'),
      ),
      generalization: 45,
      trainedTemperature: 2,
    }),
  ],
  grid: teamGrid('forkling', 'heisenmoth'),
  autopilot: deck(
    card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
    card('search-3', 'orchestrator', inField('revealIntents'), 'guardrail', 'self'),
    card('flex', 'self', HEALTHY, 'leaderboard-flex', 'highestAtkFoe'),
    card('swarm', 'foe', WEAK, 'swarm-of-fine-tunes', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('patch', 'self', ALLY_HURT, 'community-patch', 'lowestHpAlly'),
    card('drift', 'self', DRIFT, 'community-patch', 'self'),
    card('selfpatch', 'self', HURT, 'community-patch', 'self'),
    card('coin', 'self', COIN, 'hard-fork', 'randomFoe'),
  ),
  temperature: 2,
});

/** Heisenmoth at T3: Flash Inference before the foe acts, a grafted Token Nibble, an Off-By-Wasp and a Brittle Deprecatter. */
const HEISENMOTH_TEMPO = archetype('mixed-heisenmoth-tempo', {
  orchestrator: orchestrator('heisenmoth', 'heisenmoth', 8),
  active: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
        card('burst', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
      ),
      generalization: 66,
      trainedTemperature: 3,
    }),
    subagent('deprecatter', 'deprecatter', 8, {
      deck: deck(
        card('trip', 'self', ALWAYS, 'nostalgia-trip', 'lowestHpFoe'),
        card('save', 'self', OPENER, 'save-state', 'self'),
        card('recall', 'foe', HURT, 'long-term-recall', 'highestAtkFoe'),
        card('replay', 'self', COIN, 'episodic-replay', 'self'),
      ),
      generalization: 28,
      trainedTemperature: 0,
    }),
  ],
  bench: [
    subagent('forkling', 'forkling', 8, {
      deck: deck(
        card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
        card('patch', 'self', ALLY_HURT, 'community-patch', 'lowestHpAlly'),
        card('flex', 'self', HEALTHY, 'leaderboard-flex', 'highestAtkFoe'),
      ),
      generalization: 58,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPFF', //
      'AAeBB',
      'AAeBB',
      'XX.Ne',
      '...NN',
    ],
    { X: { skill: 'bounding-box' }, F: { skill: 'flash-inference' }, N: { graft: 'token-nibble' }, A: { slot: 'wasp' }, B: { slot: 'deprecatter' } },
  ),
  autopilot: deck(
    card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
    card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
    card('box', 'self', cooldown(3), 'bounding-box', 'self'),
    card('coin', 'foe', hasStatus('glazed'), 'token-nibble', 'randomFoe'),
    card('search-2', 'self', hasStatus('overfit'), 'flash-inference', 'foeWeakToMove'),
    card('search-23', 'foe', BUFFED, 'flash-inference', 'highestAtkFoe'),
    card('tidy', 'self', FULL, 'flash-inference', 'lowestHpFoe'),
    card('nibble', 'foe', WEAK, 'token-nibble', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
  ),
  temperature: 3,
});

export const MIXED: readonly Archetype[] = [SAGELET_STARTER, BLITZR_STARTER, FORKLING_STARTER, HEISENMOTH_TEMPO];
