import { describe, expect, it } from 'vitest';
import { resolveAction } from '../../src/battle/resolve.js';
import { submitRound } from '../../src/battle/round.js';
import { createBattle, type BattleSetup } from '../../src/battle/setup.js';
import type { BattleState } from '../../src/battle/state.js';
import type { Deck } from '../../src/cards/model.js';
import type { BattleEvent } from '../../src/events/types.js';
import { mon, seedFor, setup, side } from '../golden/builders.js';
import { draws, entry } from '../battle/helpers.js';
import { ALWAYS, bootcampGrad, card } from './fixtures.js';

// Bible balance section: Prompt Injection "turns a shallow 'always strongest attack' deck against its own ally". The
// player's Forkling acts from such a deck (Hard Fork, its strongest move, at the weakest foe). Once Prompt Injected,
// its next action is the inflicter's default choice — the victim's highest-power move at its lowest-HP on-field ally
// (spec §5 Statuses) — so its strongest attack lands on its own side. No slice species learns Deepfake Call (the only
// move that inflicts the status), so the trainer's Deepfake Call is resolved directly on the round-0 state.

/** Shallow: always Hard Fork (70 power, 100 accuracy: Forkling's strongest move) at the weakest foe. */
const STRONGEST: Deck = { cards: [card('strongest', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe')], default: card('fallback', 'self', ALWAYS, 'hard-fork', 'lowestHpFoe') };

/** Side a: Sagelet orchestrating the shallow-deck Forkling (1) and the intern Tokenibble (2), the lowest-HP ally. */
const SETUP: BattleSetup = setup(
  side('a', { orch: mon('a-sagelet', 'sagelet', 8), active: [{ ...mon('a-forkling', 'forkling', 8), deck: STRONGEST, generalization: 80 }, mon('a-tokenibble', 'tokenibble', 6)] }),
  bootcampGrad(),
);
const SEED = seedFor('scenario:prompt-injection');
const FORKLING = 1;
const TRAINER = 3;

/** Round 1 from the round-0 state, Prompt Injected first when `inject` (the trainer's Deepfake Call on the Forkling). */
function roundOne(inject: boolean): { state: BattleState; events: BattleEvent[] } {
  const state = createBattle(SETUP, SEED);
  if (inject) {
    const cast: BattleEvent[] = [];
    resolveAction(state, entry(TRAINER, 'deepfake-call', FORKLING), draws(), cast); // accuracy hits (lo D3 = 0)
    expect(cast.filter((e) => e.type === 'StatusApplied')).toEqual([{ round: 0, type: 'StatusApplied', target: FORKLING, status: 'promptInjected', rounds: 1 }]);
  }
  const out = submitRound(state, {});
  if ('error' in out) throw new Error(out.error.message);
  return out;
}

const sideOf = (state: BattleState, i: number) => state.creatures[i]?.side;
const forklingHits = (events: BattleEvent[]) => events.filter((e) => e.type === 'Damage' && e.actor === FORKLING);

describe('Prompt Injected turns an "always strongest attack" deck on its own ally', () => {
  it('without the status, the deck is consulted and Hard Fork hits a foe', () => {
    const { state, events } = roundOne(false);
    expect(events.some((e) => e.type === 'CardTrace' && e.actor === FORKLING)).toBe(true);
    expect(events.find((e) => e.type === 'MoveUsed' && e.actor === FORKLING)).toMatchObject({ moveId: 'hard-fork' });
    const hits = forklingHits(events);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) if (h.type === 'Damage') expect(sideOf(state, h.target)).toBe('b');
  });

  it('Prompt Injected: the deck is not consulted, Hard Fork hits the lowest-HP ally on its own side, and the status is used up', () => {
    const { state, events } = roundOne(true);
    const mine = events.filter((e) => 'actor' in e && e.actor === FORKLING);
    expect(mine.some((e) => e.type === 'CardTrace')).toBe(false);
    expect(mine.find((e) => e.type === 'MoveUsed')).toMatchObject({ moveId: STRONGEST.cards[0]?.move, target: 2 });
    const hits = forklingHits(events);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) if (h.type === 'Damage') expect(sideOf(state, h.target)).toBe(sideOf(state, FORKLING));
    expect(events).toContainEqual({ round: 1, type: 'StatusExpired', target: FORKLING, status: 'promptInjected' });
    expect(state.creatures[FORKLING]?.statuses.some((s) => s.id === 'promptInjected')).toBe(false);
  });
});
