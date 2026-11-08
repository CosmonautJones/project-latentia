import type { Archetype } from '../types.js';
import { ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, FULL, HEALTHY, HURT, hasStatus, isType, layout, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';

// Search anti-hallucination (spec §9): ground the team and punish the hallucinators. Ground Truth cures team
// Hallucinating, Citation Needed hits a Hallucinating foe twice as hard (then cures it), Fact Check strips buffs,
// Cosine Sniff and foeWeakToMove go for weaknesses.

const HALLUCINAT_NUKE_ID = 'reasoning-nuke-hallucinat';

/** Embeddingo at T2 with a Specialist Scrapion (cards recorded from the Hallucinat nuke) and a Robust Sagelet; a Brittle Heisenmoth benched. */
const EMBEDDINGO_GROUND = archetype('search-anti-hallu-embeddingo', {
  orchestrator: orchestrator('embeddingo', 'embeddingo', 8),
  active: [
    subagent('sagelet', 'sagelet', 8, {
      deck: deck(
        card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
        card('think', 'self', cooldown(3), 'step-back-prompt', 'self'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
        card('weak', 'foe', WEAK_TO_MOVE, 'happy-to-help', 'foeWeakToMove'),
      ),
      generalization: 76,
      trainedTemperature: 0,
      recordedFoes: ['open-swarm-slopling'],
    }),
    // Its two active cards (two Example Cards touch slot B) were both recorded from the Hallucinat nuke: Specialist
    // (+15%) against that archetype only (Rulings 116, 123, 127).
    subagent('scrapion', 'scrapion', 8, {
      deck: deck(
        card('scrape', 'self', ALWAYS, 'scrape', 'highestAtkFoe'),
        card('check', 'foe', BUFFED, 'fact-check', 'highestAtkFoe', { recordedFrom: HALLUCINAT_NUKE_ID }),
        card('finish', 'foe', WEAK, 'retrieval-strike', 'lowestHpFoe', { recordedFrom: HALLUCINAT_NUKE_ID }),
        card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
      ),
      generalization: 64,
      trainedTemperature: 2,
    }),
  ],
  bench: [
    subagent('heisenmoth', 'heisenmoth', 8, {
      deck: deck(
        card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
        card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
        card('box', 'self', cooldown(3), 'bounding-box', 'self'),
      ),
      generalization: 22,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPGG', //
      'AAeBB',
      'AAeBB',
      '.CCt.',
      'RR...',
    ],
    { G: { skill: 'ground-truth' }, R: { skill: 'retrieval-strike' }, C: { skill: 'citation-needed' }, A: { slot: 'sagelet' }, B: { slot: 'scrapion' } },
  ),
  autopilot: deck(
    card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
    card('ground', 'self', hasStatus('hallucinating'), 'ground-truth', 'self'),
    card('cite', 'foe', hasStatus('hallucinating'), 'citation-needed', 'lowestHpFoe'),
    card('sniff', 'foe', WEAK_TO_MOVE, 'cosine-sniff', 'foeWeakToMove'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('reasoner', 'foe', isType('reasoning'), 'citation-needed', 'highestAtkFoe'),
    card('coin', 'self', COIN, 'cosine-sniff', 'randomFoe'),
  ),
  temperature: 2,
});

/** Scrapion at T1, Team Scrape style: steal buffs, Fact Check on a cooldown, a Robust Embeddingo to ground the team. */
const SCRAPION_GROUND = archetype('search-anti-hallu-scrapion', {
  orchestrator: orchestrator('scrapion', 'scrapion', 8),
  active: [
    subagent('embeddingo', 'embeddingo', 8, {
      deck: deck(
        card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
        card('ground', 'self', hasStatus('hallucinating'), 'ground-truth', 'self'),
        card('cure', 'self', hasStatus('glazed'), 'ground-truth', 'self'),
        card('cite', 'foe', hasStatus('hallucinating'), 'citation-needed', 'lowestHpFoe'),
        card('sniff', 'foe', WEAK_TO_MOVE, 'cosine-sniff', 'foeWeakToMove'),
        card('tidy', 'self', FULL, 'compact', 'self'),
      ),
      generalization: 72,
      trainedTemperature: 1,
    }),
    subagent('nullbeetle', 'nullbeetle', 8, {
      deck: deck(
        card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
        card('guard', 'self', HURT, 'unit-test', 'self'),
        card('crash', 'foe', HEALTHY, 'segfault', 'highestAtkFoe'),
        card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
      ),
      generalization: 45,
      trainedTemperature: 2,
    }),
  ],
  bench: [
    subagent('slopling', 'slopling', 8, {
      deck: deck(
        card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
        card('dump', 'foe', WEAK, 'weights-dump', 'lowestHpFoe'),
        card('patch', 'self', COIN, 'adversarial-patch', 'randomFoe'),
      ),
      generalization: 40,
      trainedTemperature: 3,
    }),
  ],
  grid: layout(
    [
      'PPPe.', //
      'AAeBB',
      'AAeBB',
      'eFFRR',
      '...t.',
    ],
    { F: { skill: 'fact-check' }, R: { skill: 'retrieval-strike' }, A: { slot: 'embeddingo' }, B: { slot: 'nullbeetle' } },
  ),
  autopilot: deck(
    card('scrape', 'self', ALWAYS, 'scrape', 'highestAtkFoe'),
    card('steal', 'foe', BUFFED, 'scrape', 'highestAtkFoe'),
    card('check', 'self', cooldown(3), 'fact-check', 'highestAtkFoe'),
    card('finish', 'foe', WEAK, 'retrieval-strike', 'lowestHpFoe'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('hurt', 'foe', HURT, 'retrieval-strike', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'retrieval-strike', 'randomFoe'),
  ),
  temperature: 1,
});

export const SEARCH_ANTI_HALLU: readonly Archetype[] = [EMBEDDINGO_GROUND, SCRAPION_GROUND];
