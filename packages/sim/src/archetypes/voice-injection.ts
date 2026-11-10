import type { Archetype } from '../types.js';
import { ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, DRIFT, fromRound, FULL, HEALTHY, HURT, inField, lastMove, layout, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './build.js';

/**
 * Voice pressure — the spec §9 "Voice injection" family, renamed (Ruling 120). Its namesake is Deepfake Call
 * (Prompt Injected), and no slice species can learn it: only Stochastiparrot is Voice, and a graft can carry only a
 * species signature. So these archetypes inject nothing. They pressure with the slice's Voice content instead:
 * Flattery (Glazed: its victim hits the glazer for 70%), Hype Train (+2 Compute), Hot Take (90 power, +50% Wild at
 * T3+) and Stochastic Repeat (the foe's last move turned back on it). The file keeps the family's name so the gap
 * stays visible; Prompt Injected is untested by the round-robin until a post-slice Voice species brings Deepfake Call.
 */

/** Stochastiparrot at T3: hype, glaze the biggest hitter, then Hot Take; a Robust Vibrat and a Brittle T4 Hallucinat, a second parrot benched. */
const PARROT_PRESSURE = archetype('voice-pressure-parrot', {
  orchestrator: orchestrator('parrot', 'stochastiparrot', 8),
  active: [
    subagent('vibrat', 'vibrat', 8, {
      deck: deck(
        card('merge', 'self', ALWAYS, 'merge-conflict', 'lowestHpFoe'),
        card('hype', 'self', cooldown(3), 'hype-train', 'self'),
        card('accept', 'foe', HURT, 'accept-all', 'lowestHpFoe'),
      ),
      generalization: 74,
      trainedTemperature: 3,
    }),
    subagent('hallucinat', 'hallucinat', 8, {
      deck: deck(
        card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
        card('patch', 'foe', WEAK_TO_MOVE, 'adversarial-patch', 'foeWeakToMove'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
      ),
      generalization: 38,
      trainedTemperature: 4,
    }),
  ],
  bench: [
    subagent('parrot-2', 'stochastiparrot', 8, {
      deck: deck(
        card('repeat', 'self', ALWAYS, 'stochastic-repeat', 'lowestHpFoe'),
        card('flatter', 'self', cooldown(3), 'flattery', 'highestAtkFoe'),
        card('hype', 'self', OPENER, 'hype-train', 'self'),
      ),
      generalization: 48,
      trainedTemperature: 3,
    }),
  ],
  grid: layout(
    [
      'PPPFF', //
      'AAeBB',
      'AAeBB',
      'TTt..',
      'HH...',
    ],
    { F: { skill: 'flattery' }, H: { skill: 'hype-train' }, T: { skill: 'hot-take' }, B: { slot: 'hallucinat' }, A: { slot: 'vibrat' } },
  ),
  autopilot: deck(
    card('hot', 'self', ALWAYS, 'hot-take', 'lowestHpFoe'),
    card('search-17', 'orchestrator', inField('forceTemperature'), 'hype-train', 'lowestHpAlly'),
    card('flatter', 'self', fromRound(7), 'flattery', 'highestAtkFoe'),
    card('search-14', 'foe', lastMove('hype-train'), 'hot-take', 'orchestratorTarget'),
    card('tidy', 'foe', BUFFED, 'hot-take', 'highestAtkFoe'),
    card('weak', 'foe', WEAK_TO_MOVE, 'hot-take', 'foeWeakToMove'),
    card('hype', 'self', cooldown(3), 'hype-train', 'self'),
    card('low', 'self', WEAK, 'guardrail', 'self'),
    card('repeat', 'self', COIN, 'hot-take', 'randomFoe'),
  ),
  temperature: 3,
});

/** Vibrat at T4 with a grafted Stochastic Repeat: hype every other round, Accept All, two Stable T4/T2 helpers and a Hallucinat benched. */
const VIBRAT_PRESSURE = archetype('voice-pressure-vibrat', {
  orchestrator: orchestrator('vibrat', 'vibrat', 8),
  active: [
    subagent('parrot', 'stochastiparrot', 8, {
      deck: deck(
        card('repeat', 'self', ALWAYS, 'stochastic-repeat', 'lowestHpFoe'),
        card('flatter', 'self', cooldown(3), 'flattery', 'highestAtkFoe'),
        card('hot', 'foe', HURT, 'hot-take', 'lowestHpFoe'),
      ),
      generalization: 58,
      trainedTemperature: 4,
    }),
    subagent('agentoad', 'agentoad', 8, {
      deck: deck(
        card('burst', 'self', ALWAYS, 'token-burst', 'lowestHpFoe'),
        card('tools', 'foe', HEALTHY, 'tool-call', 'highestAtkFoe'),
        card('trace', 'foe', BUFFED, 'stack-trace', 'highestAtkFoe'),
      ),
      generalization: 44,
      trainedTemperature: 2,
    }),
  ],
  bench: [
    subagent('hallucinat', 'hallucinat', 8, {
      deck: deck(
        card('cite', 'self', ALWAYS, 'confident-citation', 'lowestHpFoe'),
        card('patch', 'foe', WEAK_TO_MOVE, 'adversarial-patch', 'foeWeakToMove'),
        card('proof', 'foe', BUFFED, 'proof-by-contradiction', 'highestAtkFoe'),
      ),
      generalization: 60,
      trainedTemperature: 4,
    }),
  ],
  grid: layout(
    [
      'PPPHH', //
      'AAeBB',
      'AAeBB',
      'RR...',
      '.RR..',
    ],
    { H: { skill: 'hype-train' }, R: { graft: 'stochastic-repeat' }, A: { slot: 'parrot' }, B: { slot: 'agentoad' } },
  ),
  autopilot: deck(
    card('accept', 'self', ALWAYS, 'accept-all', 'lowestHpFoe'),
    card('hype', 'self', cooldown(2), 'hype-train', 'self'),
    card('drift', 'self', DRIFT, 'clear', 'self'),
    card('tidy', 'self', FULL, 'compact', 'self'),
    card('repeat', 'foe', BUFFED, 'stochastic-repeat', 'highestAtkFoe'),
    card('finish', 'foe', WEAK, 'stochastic-repeat', 'lowestHpFoe'),
    card('guard', 'self', WEAK, 'guardrail', 'self'),
    card('turn', 'foe', HEALTHY, 'stochastic-repeat', 'highestAtkFoe'),
    card('coin', 'self', COIN, 'stochastic-repeat', 'randomFoe'),
  ),
  temperature: 4,
});

export const VOICE_PRESSURE: readonly Archetype[] = [PARROT_PRESSURE, VIBRAT_PRESSURE];
