import type { Archetype } from '../types.js';
import { ALLY_HURT, ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, FULL, HEALTHY, HURT, lastMove, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';

// Code lock (spec §9): deny the foe its plan. Infinite Loop pins a buffer into Overfit, Segfault makes the next move
// fail, Memory Leak clogs a window with Junk, Unit Test guards on a cooldown (Gary Rebase's "don't overfit" gym).

/** Spaghettopus at T1, Gary-style: lockers on both slots and a Brittle Off-By-Wasp on the bench. */
const SPAGHETTOPUS_LOCK = archetype('code-lock-spaghettopus', {
  orchestrator: orchestrator('spaghettopus', 'spaghettopus', 8),
  active: [
    subagent('nullbeetle', 'nullbeetle', 8, {
      deck: deck(
        card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
        card('guard', 'self', HURT, 'unit-test', 'self'),
        card('loop', 'foe', lastMove('hype-train'), 'infinite-loop', 'highestAtkFoe'),
        card('crash', 'foe', HEALTHY, 'segfault', 'highestAtkFoe'),
        card('pin', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
      ),
      generalization: 82,
      trainedTemperature: 0,
      recordedFoes: ['speed-rush-blitzr'],
    }),
    subagent('vibrat', 'vibrat', 8, {
      deck: deck(
        card('merge', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
        card('accept', 'foe', HURT, 'accept-all', 'lowestHpFoe'),
        card('hype', 'self', OPENER, 'hype-train', 'self'),
        card('crash', 'self', COIN, 'segfault', 'randomFoe'),
      ),
      generalization: 52,
      trainedTemperature: 2,
    }),
  ],
  bench: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
        card('test', 'self', cooldown(3), 'unit-test', 'self'),
      ),
      generalization: 30,
      trainedTemperature: 1,
    }),
  ],
  grid: layout(
    [
      'PPPII', //
      'AAeBB',
      'AAeBB',
      'MMt..',
      'KK...',
    ],
    { I: { skill: 'infinite-loop' }, K: { skill: 'memory-leak' }, M: { skill: 'merge-conflict' }, A: { slot: 'nullbeetle' }, B: { slot: 'vibrat' } },
  ),
  autopilot: deck(
    card('tangle', 'self', ALWAYS, 'tangle', 'highestAtkFoe'),
    card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
    card('leak', 'self', cooldown(3), 'memory-leak', 'lowestHpFoe'),
    card('drift', 'self', DRIFT, 'clear', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
    card('finish', 'foe', WEAK, 'tangle', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'merge-conflict', 'randomFoe'),
  ),
  temperature: 1,
});

/** The forest bug family, "by the book" at T0: Nullbeetle with an Off-By-Wasp and a Robust Heisenmoth, a Brittle Spaghettopus benched. */
const NULLBEETLE_LOCK = archetype('code-lock-nullbeetle', {
  orchestrator: orchestrator('nullbeetle', 'nullbeetle', 8),
  active: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
        card('test', 'self', cooldown(3), 'unit-test', 'self'),
        card('burst', 'foe', WEAK, 'token-burst', 'lowestHpFoe'),
      ),
      generalization: 48,
      trainedTemperature: 0,
    }),
    subagent('heisenmoth', 'heisenmoth', 8, {
      deck: deck(
        card('observe', 'self', ALWAYS, 'observer-effect', 'lowestHpFoe'),
        card('flash', 'foe', HURT, 'flash-inference', 'lowestHpFoe'),
        card('box', 'self', cooldown(3), 'bounding-box', 'self'),
        card('refactor', 'self', DRIFT, 'refactor', 'self'),
      ),
      generalization: 72,
      trainedTemperature: 3,
    }),
  ],
  bench: [
    subagent('spaghettopus', 'spaghettopus', 8, {
      deck: deck(
        card('tangle', 'self', ALWAYS, 'tangle', 'lowestHpFoe'),
        card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
        card('leak', 'self', cooldown(3), 'memory-leak', 'lowestHpFoe'),
      ),
      generalization: 36,
      trainedTemperature: 1,
    }),
  ],
  grid: layout(
    [
      'PPPSS', //
      'AAeBB',
      'AAeBB',
      'eLLUU',
      '.....',
    ],
    { S: { skill: 'segfault' }, L: { skill: 'infinite-loop' }, U: { skill: 'unit-test' }, A: { slot: 'wasp' }, B: { slot: 'heisenmoth' } },
  ),
  autopilot: deck(
    card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
    card('test', 'self', cooldown(3), 'unit-test', 'self'),
    card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
    card('crash', 'foe', HEALTHY, 'segfault', 'highestAtkFoe'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('speed', 'foe', lastMove('low-latency'), 'infinite-loop', 'highestAtkFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('finish', 'foe', WEAK, 'null-chomp', 'lowestHpFoe'),
  ),
  temperature: 0,
});

/** Cobolt at T2: big iron that heals and refactors while Spaghettopus and a Brittle T4 Nullbeetle lock; a Robust Off-By-Wasp benched. */
const COBOLT_LOCK = archetype('code-lock-cobolt', {
  orchestrator: orchestrator('cobolt', 'cobolt', 8),
  active: [
    subagent('spaghettopus', 'spaghettopus', 8, {
      deck: deck(
        card('tangle', 'self', ALWAYS, 'tangle', 'lowestHpFoe'),
        card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
        card('leak', 'self', cooldown(3), 'memory-leak', 'lowestHpFoe'),
        card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
        card('tidy', 'self', FULL, 'compact', 'self'),
      ),
      generalization: 68,
      trainedTemperature: 1,
    }),
    subagent('nullbeetle', 'nullbeetle', 8, {
      deck: deck(
        card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
        card('crash', 'self', COIN, 'segfault', 'randomFoe'),
        card('loop', 'foe', HEALTHY, 'infinite-loop', 'highestAtkFoe'),
      ),
      generalization: 15,
      trainedTemperature: 4,
    }),
  ],
  bench: [
    subagent('wasp', 'off-by-wasp', 8, {
      deck: deck(
        card('off', 'self', ALWAYS, 'off-by-one', 'lowestHpFoe'),
        card('test', 'self', cooldown(3), 'unit-test', 'self'),
        card('trace', 'foe', HEALTHY, 'stack-trace', 'highestAtkFoe'),
      ),
      generalization: 75,
      trainedTemperature: 0,
    }),
  ],
  grid: layout(
    [
      'PPPRR', //
      'AAeBB',
      'AAeBB',
      'eHH..',
      'LL...',
    ],
    { R: { skill: 'refactor' }, L: { skill: 'long-term-recall' }, H: { skill: 'hotfix' }, B: { slot: 'nullbeetle' }, A: { slot: 'spaghettopus' } },
  ),
  autopilot: deck(
    card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
    card('patch', 'self', ALLY_HURT, 'hotfix', 'lowestHpAlly'),
    card('heal', 'self', HURT, 'hotfix', 'self'),
    card('refactor', 'self', DRIFT, 'refactor', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('batch', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'batch-job', 'foeWeakToMove'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('opener', 'self', OPENER, 'batch-job', 'highestAtkFoe'),
  ),
  temperature: 2,
});

export const CODE_LOCK: readonly Archetype[] = [SPAGHETTOPUS_LOCK, NULLBEETLE_LOCK, COBOLT_LOCK];
