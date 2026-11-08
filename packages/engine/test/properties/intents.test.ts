import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getIntents } from '../../src/battle/plan.js';
import { submitRound } from '../../src/battle/round.js';
import { createBattle, type BattleSetup } from '../../src/battle/setup.js';
import type { BattleEvent } from '../../src/events/types.js';
import { arbLegalSetup, arbScriptedCommands, arbSeed } from '../helpers/arbitraries.js';

// Intents over random legal battles with decks (B2, Rulings 79/82): every round, getIntents previews exactly the
// round submitRound plans and leaves the state untouched, and the first deck-driven action fires its intent.

const RUNS = 120;

const hasDeck = (s: BattleSetup): boolean => [s.a, s.b].some((side) => [...side.active, ...side.bench].some((c) => c.deck !== undefined));

describe('getIntents over random legal battles with decks', () => {
  it(`${RUNS} battles: getIntents equals each round's IntentsPlanned, mutates nothing, and the first action that resolves fires its intent's card`, () => {
    const seen = { rounds: 0, deckIntents: 0, firstChecked: 0, disobeyed: 0 };
    fc.assert(
      fc.property(arbLegalSetup.filter(hasDeck), arbSeed, arbScriptedCommands, (setup, seed, source) => {
        if (source.kind !== 'scripted') throw new Error('expected a scripted source');
        let state = createBattle(setup, seed);
        while (!state.ended) {
          const before = structuredClone(state);
          const intents = getIntents(state);
          expect(state).toEqual(before);
          const r = submitRound(state, source.next(state));
          if ('error' in r) throw new Error(r.error.message);
          seen.rounds++;
          const planned = r.events.filter((e): e is Extract<BattleEvent, { type: 'IntentsPlanned' }> => e.type === 'IntentsPlanned');
          expect(planned.map((e) => e.intents)).toEqual([intents.map(({ actor, moveId, target, cardId }) => ({ actor, moveId, target, cardId }))]);
          seen.deckIntents += intents.filter((i) => i.cardId !== null).length;
          // The round's first ActionStarted: nothing has resolved before it, so a deck-driven actor's trace fires
          // its intent's card unless obedience failed.
          const first = r.events.findIndex((e) => e.type === 'ActionStarted');
          const actor = first < 0 ? undefined : (r.events[first] as Extract<BattleEvent, { type: 'ActionStarted' }>).actor;
          const intent = intents.find((i) => i.actor === actor && i.cardId !== null);
          const trace = r.events.find((e): e is Extract<BattleEvent, { type: 'CardTrace' }> => e.type === 'CardTrace' && e.actor === actor);
          if (intent !== undefined && trace !== undefined) {
            seen.firstChecked++;
            if (trace.skipped.some((s) => s.cardId === intent.cardId && s.reason === 'disobeyed')) seen.disobeyed++;
            else expect(trace.firedCardId).toBe(intent.cardId);
          }
          state = r.state;
        }
      }),
      { numRuns: RUNS },
    );
    expect(seen.deckIntents).toBeGreaterThan(500);
    expect(seen.firstChecked).toBeGreaterThan(50);
    expect(seen.disobeyed).toBeGreaterThan(0);
  });
});
