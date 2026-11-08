import type { Archetype } from '../types.js';
import { ALLY_HURT, ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, FULL, fromRound, HURT, layout, OPENER, orchestrator, subagent, WEAK } from './build.js';

// Memory stall (spec §9): outlast. Save State snapshots HP against the next KO, Long-Term Recall grows with every
// hit taken from its target, Episodic Replay repeats an ally's move, healers keep the team up, and Caches keep
// the loadout from compacting under Junk.

/** Deprecatter at T1 with a Robust Cobolt healer and a Memory-Leaking Spaghettopus. */
const DEPRECATTER_STALL = archetype('memory-stall-deprecatter', {
  orchestrator: orchestrator('deprecatter', 'deprecatter', 8),
  active: [
    subagent('cobolt', 'cobolt', 8, {
      deck: deck(
        card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
        card('patch', 'self', ALLY_HURT, 'hotfix', 'lowestHpAlly'),
        card('batch', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
        card('clean', 'self', DRIFT, 'refactor', 'self'),
      ),
      generalization: 70,
      trainedTemperature: 0,
    }),
    subagent('spaghettopus', 'spaghettopus', 8, {
      deck: deck(
        card('tangle', 'self', ALWAYS, 'tangle', 'lowestHpFoe'),
        card('leak', 'self', cooldown(3), 'memory-leak', 'lowestHpFoe'),
        card('loop', 'foe', BUFFED, 'infinite-loop', 'highestAtkFoe'),
        card('merge', 'foe', HURT, 'merge-conflict', 'lowestHpFoe'),
      ),
      generalization: 46,
      trainedTemperature: 1,
    }),
  ],
  grid: layout(
    [
      'PPPSS', //
      'AAeBB',
      'AAeBB',
      'LLc..',
      'EE...',
    ],
    { S: { skill: 'save-state' }, E: { skill: 'episodic-replay' }, L: { skill: 'long-term-recall' }, B: { slot: 'spaghettopus' }, A: { slot: 'cobolt' } },
  ),
  autopilot: deck(
    card('trip', 'self', ALWAYS, 'nostalgia-trip', 'lowestHpFoe'),
    card('save', 'self', cooldown(3), 'save-state', 'self'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('low', 'self', WEAK, 'guardrail', 'self'),
    card('punish', 'foe', BUFFED, 'long-term-recall', 'highestAtkFoe'),
    card('recall', 'self', fromRound(4), 'long-term-recall', 'highestAtkFoe'),
    card('replay', 'self', COIN, 'episodic-replay', 'self'),
    card('hurt', 'foe', HURT, 'long-term-recall', 'lowestHpFoe'),
  ),
  temperature: 1,
});

/** "Old v1.2", like the Retro Collector: a Deprecatter at T0 with a mimic Stochastiparrot and an old Cobolt; two Caches guard its slots. */
const RETRO_STALL = archetype('memory-stall-retro', {
  orchestrator: orchestrator('deprecatter', 'deprecatter', 8),
  active: [
    subagent('parrot', 'stochastiparrot', 8, {
      deck: deck(
        card('repeat', 'self', ALWAYS, 'stochastic-repeat', 'lowestHpFoe'),
        card('hype', 'self', OPENER, 'hype-train', 'self'),
        card('flatter', 'self', cooldown(3), 'flattery', 'highestAtkFoe'),
        card('hot', 'foe', HURT, 'hot-take', 'lowestHpFoe'),
      ),
      generalization: 62,
      trainedTemperature: 1,
    }),
    subagent('cobolt', 'cobolt', 8, {
      deck: deck(
        card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
        card('patch', 'self', ALLY_HURT, 'hotfix', 'lowestHpAlly'),
        card('batch', 'self', COIN, 'batch-job', 'randomFoe'),
      ),
      generalization: 33,
      trainedTemperature: 2,
    }),
  ],
  grid: layout(
    [
      'PPPSS', //
      'AAeBB',
      'AAeBB',
      'cLLc.',
      '.....',
    ],
    { S: { skill: 'save-state' }, L: { skill: 'long-term-recall' }, A: { slot: 'parrot' }, B: { slot: 'cobolt' } },
  ),
  autopilot: deck(
    card('trip', 'self', ALWAYS, 'nostalgia-trip', 'lowestHpFoe'),
    card('save', 'self', cooldown(3), 'save-state', 'self'),
    card('recall', 'foe', HURT, 'long-term-recall', 'highestAtkFoe'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('punish', 'foe', BUFFED, 'long-term-recall', 'highestAtkFoe'),
    card('low', 'self', WEAK, 'guardrail', 'self'),
    card('finish', 'foe', WEAK, 'nostalgia-trip', 'lowestHpFoe'),
    card('coin', 'self', COIN, 'long-term-recall', 'randomFoe'),
  ),
  temperature: 0,
});

export const MEMORY_STALL: readonly Archetype[] = [DEPRECATTER_STALL, RETRO_STALL];
