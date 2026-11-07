import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ROUND_CAP } from '../../src/battle/end.js';
import type { RoundCommand } from '../../src/battle/log.js';
import { submitRound } from '../../src/battle/round.js';
import { createBattle, validateSetup, type BattleSetup } from '../../src/battle/setup.js';
import { simulate, type CommandSource } from '../../src/battle/simulate.js';
import type { BattleState } from '../../src/battle/state.js';
import type { BattleEvent } from '../../src/events/types.js';
import { parseSeed } from '../../src/rng/seed.js';
import { nextU32, seedRng } from '../../src/rng/sfc32.js';
import { arbLegalSetup, arbScriptedCommands, arbSeed } from '../helpers/arbitraries.js';

const RUNS = 200;

/** HP within [0, max] and tokens within the window for every creature. */
function checkState(state: BattleState): void {
  for (const c of state.creatures) {
    expect(c.hp).toBeGreaterThanOrEqual(0);
    expect(c.hp).toBeLessThanOrEqual(c.maxHp);
    expect(c.context.tokens.length).toBeLessThanOrEqual(c.context.window);
  }
}

/** The source, checking every state it is shown (the state before each round). Counts the rounds. */
function watched(source: CommandSource, shown: { rounds: number }): CommandSource {
  if (source.kind !== 'scripted') return source;
  return {
    kind: 'scripted',
    next: (state) => {
      checkState(state);
      shown.rounds++;
      return source.next(state);
    },
  };
}

/** The final state, re-run round by round through submitRound, every intermediate state checked. */
function finalState(setup: BattleSetup, seed: string, rounds: readonly RoundCommand[]): BattleState {
  let state = createBattle(setup, seed);
  for (const cmd of rounds) {
    const out = submitRound(state, cmd);
    if ('error' in out) throw new Error(out.error.message);
    state = out.state;
    checkState(state);
  }
  return state;
}

/**
 * Re-derives the rng stream from the seed: each RoundStart takes two draws per creature, each
 * ActionStarted exactly the next six, in order — and nothing else draws (the final rng state matches).
 */
function checkDraws(seed: string, creatures: number, events: readonly BattleEvent[], final: BattleState): void {
  const parsed = parseSeed(seed);
  if (!parsed.ok) throw new Error('bad seed');
  const rng = seedRng(parsed.words);
  for (const e of events) {
    if (e.type === 'RoundStart') for (let i = 0; i < 2 * creatures; i++) nextU32(rng);
    if (e.type === 'ActionStarted') {
      const six = [nextU32(rng), nextU32(rng), nextU32(rng), nextU32(rng), nextU32(rng), nextU32(rng)];
      expect(Object.keys(e.draws).sort()).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
      expect([e.draws.d1, e.draws.d2, e.draws.d3, e.draws.d4, e.draws.d5, e.draws.d6]).toEqual(six);
    }
  }
  expect(final.rng).toEqual(rng);
}

describe('invariants over random legal battles (spec §8 properties)', () => {
  it('arbLegalSetup only builds setups validateSetup accepts, gridded and gridless', () => {
    let gridded = 0;
    fc.assert(
      fc.property(arbLegalSetup, (setup) => {
        expect(validateSetup(setup).errors).toEqual([]);
        if (setup.a.grid !== null || setup.b.grid !== null) gridded++;
      }),
      { numRuns: 500 },
    );
    expect(gridded).toBeGreaterThan(100);
  });

  it(`${RUNS} battles: HP in [0, max], tokens ≤ window, ≤ ${ROUND_CAP} rounds, exactly six draws per ActionStarted`, () => {
    fc.assert(
      fc.property(arbLegalSetup, arbSeed, arbScriptedCommands, (setup, seed, source) => {
        const shown = { rounds: 0 };
        const r = simulate(setup, seed, watched(source, shown));
        const initial = createBattle(setup, seed);

        expect(r.rounds).toBeGreaterThanOrEqual(1);
        expect(r.rounds).toBeLessThanOrEqual(ROUND_CAP);
        expect(shown.rounds).toBe(r.rounds);
        expect(r.events.filter((e) => e.type === 'RoundStart')).toHaveLength(r.rounds);
        expect(r.events.filter((e) => e.type === 'BattleEnd')).toHaveLength(1);
        expect(r.events[r.events.length - 1]?.type).toBe('BattleEnd');

        for (const e of r.events) {
          if (e.type === 'Damage' || e.type === 'Healed') {
            expect(e.hpAfter).toBeGreaterThanOrEqual(0);
            expect(e.hpAfter).toBeLessThanOrEqual(initial.creatures[e.target]?.maxHp ?? -1);
          }
        }

        // Tokens ≤ window is checked on every intermediate state (the window grows as grid pieces compact).
        const final = finalState(setup, seed, r.log.rounds);
        expect(final.ended).toBe(true);
        checkDraws(seed, initial.creatures.length, r.events, final);
      }),
      { numRuns: RUNS },
    );
  });
});
