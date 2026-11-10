import type { Archetype } from '../types.js';
import { ALLY_HURT, ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, hasStatus, HEALTHY, HURT, lastMove, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';

/**
 * Reasoning charge-nuke (spec §9). The slice has no true charge move: Deliberate and Deep Research are in the move
 * list, but no slice species learns either, and a graft can only carry a species signature. So the "charge" here
 * is a wind-up: Step-Back Prompt stacks Compute on a cooldown, Chain of Thought ramps +20 power per consecutive
 * Reasoning round, and the nuke is Happy to Help, Proof by Contradiction (×2 against a foe that buffed) or a grafted
 * Batch Job. Cool temperatures, because Reasoning gains a crit stage at T0/T1.
 */

/** Sagelet at T0, one Tool on both attack Skills, a Robust Hallucinat and an Embeddingo beside it, a Cobolt tank on the bench. */
const SAGELET_NUKE = archetype('reasoning-nuke-sagelet', {
  orchestrator: orchestrator('sagelet', 'sagelet', 8),
  active: [
    subagent('hallucinat', 'hallucinat', 8, {
      deck: deck(
        card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
        card('patch', 'foe', HEALTHY, 'adversarial-patch', 'highestAtkFoe'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
      ),
      generalization: 78,
      trainedTemperature: 1,
    }),
    subagent('embeddingo', 'embeddingo', 8, {
      deck: deck(
        card('strike', 'self', ALWAYS, 'retrieval-strike', 'lowestHpFoe'),
        card('cite', 'foe', hasStatus('hallucinating'), 'citation-needed', 'lowestHpFoe'),
        card('sniff', 'foe', WEAK_TO_MOVE, 'cosine-sniff', 'foeWeakToMove'),
      ),
      generalization: 50,
      trainedTemperature: 1,
    }),
  ],
  bench: [
    subagent('cobolt', 'cobolt', 8, {
      deck: deck(
        card('recall', 'self', ALWAYS, 'long-term-recall', 'highestAtkFoe'),
        card('patch', 'self', ALLY_HURT, 'hotfix', 'lowestHpAlly'),
        card('batch', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
      ),
      generalization: 50,
      trainedTemperature: 0,
    }),
  ],
  grid: layout(
    [
      'PPPSS', //
      'AAeBB',
      'AAeBB',
      'CCtXX',
      '.....',
    ],
    { S: { skill: 'step-back-prompt' }, X: { skill: 'proof-by-contradiction' }, C: { skill: 'chain-of-thought' }, A: { slot: 'hallucinat' }, B: { slot: 'embeddingo' } },
  ),
  autopilot: deck(
    card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
    card('charge', 'self', cooldown(3), 'step-back-prompt', 'self'),
    card('drift', 'self', DRIFT, 'compact', 'self'),
    card('tidy', 'self', { category: 'telegraphing' }, 'compact', 'self'),
    card('punish', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'happy-to-help', 'foeWeakToMove'),
    card('nuke', 'foe', HURT, 'happy-to-help', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'proof-by-contradiction', 'randomFoe'),
  ),
  temperature: 0,
});

/** Hallucinat at T1 with a grafted Batch Job, a Brittle Vibrat that hypes then Accept-Alls, and a Nullbeetle. */
const HALLUCINAT_NUKE = archetype('reasoning-nuke-hallucinat', {
  orchestrator: orchestrator('hallucinat', 'hallucinat', 8),
  active: [
    subagent('vibrat', 'vibrat', 8, {
      deck: deck(
        card('merge', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
        card('hype', 'self', OPENER, 'hype-train', 'self'),
        card('accept', 'foe', HURT, 'accept-all', 'lowestHpFoe'),
      ),
      generalization: 35,
      trainedTemperature: 3,
    }),
    subagent('nullbeetle', 'nullbeetle', 8, {
      deck: deck(
        card('chomp', 'self', ALWAYS, 'null-chomp', 'lowestHpFoe'),
        card('guard', 'self', HURT, 'unit-test', 'self'),
        card('crash', 'foe', HEALTHY, 'segfault', 'highestAtkFoe'),
        card('loop', 'foe', lastMove('hype-train'), 'infinite-loop', 'highestAtkFoe'),
      ),
      generalization: 45,
      trainedTemperature: 2,
    }),
  ],
  bench: [
    subagent('sagelet', 'sagelet', 8, {
      deck: deck(
        card('chain', 'self', ALWAYS, 'chain-of-thought', 'lowestHpFoe'),
        card('think', 'self', cooldown(3), 'step-back-prompt', 'self'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
      ),
      generalization: 58,
      trainedTemperature: 0,
    }),
  ],
  grid: layout(
    [
      'PPP..', //
      'GGGG.',
      'AAeBB',
      'AAeBB',
      'XX.e.',
    ],
    { X: { skill: 'proof-by-contradiction' }, G: { graft: 'batch-job' }, A: { slot: 'vibrat' }, B: { slot: 'nullbeetle' } },
  ),
  autopilot: deck(
    card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
    card('nuke', 'foe', HURT, 'batch-job', 'lowestHpFoe'),
    card('punish', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
    card('drift', 'self', DRIFT, 'clear', 'self'),
    card('tidy', 'self', hasStatus('quantized'), 'compact', 'self'),
    card('weak', 'foe', WEAK_TO_MOVE, 'batch-job', 'foeWeakToMove'),
    card('opener', 'self', OPENER, 'confident-citation', 'highestAtkFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('coin', 'self', COIN, 'batch-job', 'randomFoe'),
  ),
  temperature: 1,
});

export const REASONING_NUKE: readonly Archetype[] = [SAGELET_NUKE, HALLUCINAT_NUKE];
