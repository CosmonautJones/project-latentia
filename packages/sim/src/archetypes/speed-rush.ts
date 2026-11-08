import type { Archetype } from '../types.js';
import { archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, FULL, HEALTHY, HURT, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE, ALWAYS } from './build.js';

// Speed rush (spec §9): act first, cheap hits, finish the weak before they move. Low-cost Speed moves keep the
// orchestrator's headroom free; priority moves (Token Burst +1, Early Exit +3) snipe the low-HP foe.

/** Blitzr's subagent Tokenibble: nibble, burst on the opener, Early Exit to finish. */
const NIBBLER = deck(
  card('nibble', 'self', ALWAYS, 'token-nibble', 'lowestHpFoe'),
  card('exit', 'foe', WEAK, 'early-exit', 'lowestHpFoe'),
  card('burst', 'self', OPENER, 'token-burst', 'randomFoe'),
  card('speed', 'self', cooldown(3), 'low-latency', 'self'),
  card('tidy', 'self', FULL, 'compact', 'self'),
);

/** Blitzr with two fast subagents and an Off-By-Wasp benched, hot (T3) for crits; every Autopilot card costs one cell. */
const BLITZR_RUSH = archetype('speed-rush-blitzr', {
  orchestrator: orchestrator('blitzr', 'blitzr', 8),
  active: [
    subagent('tokenibble', 'tokenibble', 8, { deck: NIBBLER, generalization: 55, trainedTemperature: 3 }),
    subagent('agentoad', 'agentoad', 8, {
      deck: deck(
        card('burst', 'self', ALWAYS, 'token-burst', 'lowestHpFoe'),
        card('tools', 'foe', HEALTHY, 'tool-call', 'highestAtkFoe'),
        card('trace', 'foe', BUFFED, 'stack-trace', 'highestAtkFoe'),
        card('rerank', 'self', cooldown(3), 'rerank', 'orchestrator'),
        card('tidy', 'self', FULL, 'compact', 'self'),
      ),
      generalization: 30,
      trainedTemperature: 4,
    }),
  ],
  bench: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('burst', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
        card('test', 'self', cooldown(3), 'unit-test', 'self'),
      ),
      generalization: 62,
      trainedTemperature: 3,
    }),
  ],
  grid: layout(
    [
      'PPPKK', //
      'AAeBB',
      'AAeBB',
      'e.tDD',
      '.....',
    ],
    { K: { skill: 'token-burst' }, D: { skill: 'distilled-strike' }, B: { slot: 'agentoad' }, A: { slot: 'tokenibble' } },
  ),
  autopilot: deck(
    card('ship', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('opener', 'self', OPENER, 'distilled-strike', 'highestAtkFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'distilled-strike', 'foeWeakToMove'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('hurt', 'foe', HURT, 'ship-it', 'lowestHpFoe'),
    card('coin', 'self', COIN, 'distilled-strike', 'randomFoe'),
  ),
  temperature: 3,
});

/** Agentoad (Code/Speed) at T4 with grafted Off By One, two fast Code subagents and a spun-up Blitzr benched: all-in on wild rolls. */
const AGENTOAD_RUSH = archetype('speed-rush-agentoad', {
  orchestrator: orchestrator('agentoad', 'agentoad', 8),
  active: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('test', 'self', cooldown(3), 'unit-test', 'self'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
        card('burst', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
      ),
      generalization: 72,
      trainedTemperature: 2,
      recordedFoes: ['code-lock-spaghettopus'],
    }),
    subagent('heisenmoth', 'heisenmoth', 8, {
      deck: deck(
        card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
        card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
        card('box', 'self', cooldown(3), 'bounding-box', 'self'),
        card('refactor', 'self', DRIFT, 'refactor', 'self'),
      ),
      generalization: 45,
      trainedTemperature: 4,
    }),
  ],
  bench: [
    subagent('blitzr', 'blitzr', 8, {
      deck: deck(
        card('ship', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
        card('finish', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
        card('speed', 'self', cooldown(3), 'low-latency', 'self'),
        card('strike', 'foe', HURT, 'distilled-strike', 'lowestHpFoe'),
      ),
      generalization: 40,
      trainedTemperature: 4,
    }),
  ],
  grid: layout(
    [
      'PPP..', //
      'AAe.W',
      'AAeWW',
      'BBeSS',
      'BB.t.',
    ],
    { S: { skill: 'stack-trace' }, W: { graft: 'off-by-one' }, A: { slot: 'wasp' }, B: { slot: 'heisenmoth' } },
  ),
  autopilot: deck(
    card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'off-by-one', 'lowestHpFoe'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('drift', 'self', DRIFT, 'clear', 'self'),
    card('tools', 'foe', HEALTHY, 'tool-call', 'highestAtkFoe'),
    card('trace', 'foe', BUFFED, 'stack-trace', 'highestAtkFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'stack-trace', 'foeWeakToMove'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'tool-call', 'randomFoe'),
  ),
  temperature: 4,
});

/** Blitzr with a grafted Null Chomp for Code coverage, a Brittle intern and a Heisenmoth; an Agentoad on the bench. */
const GRAFT_RUSH = archetype('speed-rush-graft', {
  orchestrator: orchestrator('blitzr', 'blitzr', 8),
  active: [
    subagent('tokenibble', 'tokenibble', 8, {
      deck: deck(
        card('nibble', 'self', ALWAYS, 'token-nibble', 'lowestHpFoe'),
        card('burst', 'self', OPENER, 'token-burst', 'lowestHpFoe'),
        card('chase', 'foe', HURT, 'token-burst', 'lowestHpFoe'),
        card('coin', 'self', COIN, 'token-burst', 'randomFoe'),
      ),
      generalization: 25,
      trainedTemperature: 2,
    }),
    subagent('heisenmoth', 'heisenmoth', 8, {
      deck: deck(
        card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
        card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
        card('box', 'self', cooldown(3), 'bounding-box', 'self'),
        card('refactor', 'self', DRIFT, 'refactor', 'self'),
      ),
      generalization: 52,
      trainedTemperature: 3,
    }),
  ],
  bench: [
    subagent('agentoad', 'agentoad', 8, {
      deck: deck(
        card('burst', 'self', ALWAYS, 'token-burst', 'lowestHpFoe'),
        card('tools', 'foe', HEALTHY, 'tool-call', 'highestAtkFoe'),
        card('trace', 'foe', BUFFED, 'stack-trace', 'highestAtkFoe'),
      ),
      generalization: 70,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPt.', //
      'AAeDD',
      'AAeBB',
      'NNNBB',
      '...e.',
    ],
    { D: { skill: 'distilled-strike' }, N: { graft: 'null-chomp' }, A: { slot: 'tokenibble' }, B: { slot: 'heisenmoth' } },
  ),
  autopilot: deck(
    card('ship', 'self', ALWAYS, 'ship-it', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'distilled-strike', 'lowestHpFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'null-chomp', 'foeWeakToMove'),
    card('opener', 'self', OPENER, 'distilled-strike', 'highestAtkFoe'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('hurt', 'foe', HURT, 'ship-it', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'null-chomp', 'randomFoe'),
  ),
  temperature: 2,
});

export const SPEED_RUSH: readonly Archetype[] = [BLITZR_RUSH, AGENTOAD_RUSH, GRAFT_RUSH];
