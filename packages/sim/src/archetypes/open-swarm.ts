import type { Archetype } from '../types.js';
import { ALLY_HURT, ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, hasStatus, HEALTHY, HURT, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';

// Open swarm (spec §9): stack Open-type creatures so Swarm of Fine-Tunes hits 1 + (Open allies) times, keep the
// team topped up with Community Patch, and let Slopling's stacking Compute grow while it survives.

/** Forkling with two Open subagents (a Slopling and a spun-up Forkling): Swarm hits three times; a second Slopling benched. */
const FORKLING_SWARM = archetype('open-swarm-forkling', {
  orchestrator: orchestrator('forkling', 'forkling', 8),
  active: [
    subagent('slopling', 'slopling', 8, {
      deck: deck(
        card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
        card('swarm', 'self', OPENER, 'swarm-of-fine-tunes', 'lowestHpFoe'),
        card('dump', 'foe', WEAK, 'weights-dump', 'lowestHpFoe'),
        card('patch', 'self', COIN, 'adversarial-patch', 'randomFoe'),
      ),
      generalization: 60,
      trainedTemperature: 2,
    }),
    subagent('fork', 'forkling', 8, {
      deck: deck(
        card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
        card('swarm', 'self', OPENER, 'swarm-of-fine-tunes', 'lowestHpFoe'),
        card('flex', 'self', HEALTHY, 'leaderboard-flex', 'highestAtkFoe'),
        card('patch', 'self', ALLY_HURT, 'community-patch', 'lowestHpAlly'),
      ),
      generalization: 20,
      trainedTemperature: 3,
    }),
  ],
  bench: [
    subagent('slopling-2', 'slopling', 8, {
      deck: deck(
        card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
        card('dump', 'foe', WEAK, 'weights-dump', 'lowestHpFoe'),
        card('swarm', 'self', COIN, 'swarm-of-fine-tunes', 'lowestHpFoe'),
      ),
      generalization: 44,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPWW', //
      'AAeBB',
      'AAeBB',
      'eFFe.',
      'HH...',
    ],
    { F: { skill: 'leaderboard-flex' }, W: { skill: 'swarm-of-fine-tunes' }, H: { skill: 'community-patch' }, B: { slot: 'fork' }, A: { slot: 'slopling' } },
  ),
  autopilot: deck(
    card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
    card('patch', 'self', ALLY_HURT, 'community-patch', 'lowestHpAlly'),
    card('selfpatch', 'self', HURT, 'community-patch', 'self'),
    card('search-20', 'self', { category: 'telegraphing' }, 'guardrail', 'orchestrator'),
    card('tidy', 'orchestrator', BUFFED, 'compact', 'self'),
    card('flex', 'self', HEALTHY, 'leaderboard-flex', 'highestAtkFoe'),
    card('finish', 'foe', WEAK, 'swarm-of-fine-tunes', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'swarm-of-fine-tunes', 'randomFoe'),
  ),
  temperature: 2,
});

/** Slopling at T3 with a Robust Forkling and a hype Stochastiparrot; a Cache keeps its slot and Swarm intact. */
const SLOPLING_SWARM = archetype('open-swarm-slopling', {
  orchestrator: orchestrator('slopling', 'slopling', 8),
  active: [
    subagent('forkling', 'forkling', 8, {
      deck: deck(
        card('fork', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe'),
        card('swarm', 'foe', WEAK, 'swarm-of-fine-tunes', 'lowestHpFoe'),
        card('patch', 'self', ALLY_HURT, 'community-patch', 'lowestHpAlly'),
      ),
      generalization: 70,
      trainedTemperature: 1,
    }),
    subagent('parrot', 'stochastiparrot', 8, {
      deck: deck(
        card('hot', 'self', ALWAYS, 'hot-take', 'lowestHpFoe'),
        card('hype', 'self', OPENER, 'hype-train', 'self'),
        card('flatter', 'foe', BUFFED, 'flattery', 'highestAtkFoe'),
        card('repeat', 'self', cooldown(2), 'stochastic-repeat', 'lowestHpFoe'),
      ),
      generalization: 40,
      trainedTemperature: 3,
    }),
  ],
  bench: [
    subagent('embeddingo', 'embeddingo', 8, {
      deck: deck(
        card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
        card('cite', 'foe', hasStatus('hallucinating'), 'citation-needed', 'lowestHpFoe'),
        card('sniff', 'foe', WEAK_TO_MOVE, 'cosine-sniff', 'foeWeakToMove'),
      ),
      generalization: 55,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPDD', //
      'AAeBB',
      'AAeBB',
      'cWWe.',
      'XX...',
    ],
    { D: { skill: 'weights-dump' }, X: { skill: 'adversarial-patch' }, W: { skill: 'swarm-of-fine-tunes' }, B: { slot: 'parrot' }, A: { slot: 'forkling' } },
  ),
  autopilot: deck(
    card('fingers', 'self', ALWAYS, 'six-fingers', 'lowestHpFoe'),
    card('dump', 'foe', WEAK, 'weights-dump', 'lowestHpFoe'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('search-14', 'orchestrator', WEAK, 'clear', 'orchestrator'),
    card('swarm', 'self', OPENER, 'swarm-of-fine-tunes', 'lowestHpFoe'),
    card('patch', 'foe', WEAK_TO_MOVE, 'adversarial-patch', 'foeWeakToMove'),
    card('haze', 'foe', HEALTHY, 'adversarial-patch', 'highestAtkFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'weights-dump', 'randomFoe'),
  ),
  temperature: 3,
});

export const OPEN_SWARM: readonly Archetype[] = [FORKLING_SWARM, SLOPLING_SWARM];
