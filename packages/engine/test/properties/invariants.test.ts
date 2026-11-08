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
import { arbLegalSetup, arbSeed, recordedFoeCandidates } from '../helpers/arbitraries.js';
import { arbScriptedCommands } from '../helpers/commands.js';

const RUNS = 200;

/** HP within [0, max] and tokens within the window for every creature. */
function checkState(state: BattleState): void {
  for (const c of state.creatures) {
    expect(c.hp).toBeGreaterThanOrEqual(0);
    expect(c.hp).toBeLessThanOrEqual(c.maxHp);
    expect(c.context.tokens.length).toBeLessThanOrEqual(c.context.window);
  }
}

/** What the scripted sources sent, over every battle: orchestrator commands by kind. */
const sent = { commands: 0, swap: 0, directive: 0, injection: 0, policyUpdate: 0 };

function tally(cmd: RoundCommand): void {
  for (const sc of [cmd.a, cmd.b]) {
    if (sc === undefined) continue;
    sent.commands++;
    const a = sc.action;
    if (a.kind === 'swap' || a.kind === 'directive' || a.kind === 'policyUpdate') sent[a.kind]++;
    if (a.kind === 'move' && a.injection !== undefined) sent.injection++;
  }
}

/** The source, checking every state it is shown (the state before each round). Counts the rounds and tallies the commands. */
function watched(source: CommandSource, shown: { rounds: number }): CommandSource {
  if (source.kind !== 'scripted') return source;
  return {
    kind: 'scripted',
    next: (state) => {
      checkState(state);
      shown.rounds++;
      const cmd = source.next(state);
      tally(cmd);
      return cmd;
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

  it('arbLegalSetup trains subagents and builds sides with no active subagent (Ruling 77)', () => {
    const seen = { temps: new Set<number>(), untrained: 0, robustWithFoes: 0, robustVsRecorded: 0, robustVsUnseen: 0, generalizationUnset: 0, noActives: 0, griddedNoActives: 0, decks: 0, noDeck: 0 };
    fc.assert(
      fc.property(arbLegalSetup, (setup) => {
        for (const own of [setup.a, setup.b]) {
          const candidates = new Set(recordedFoeCandidates(own));
          expect(own.orchestrator.trainedTemperature ?? own.orchestrator.generalization ?? own.orchestrator.recordedFoes).toBeUndefined();
          if (own.active.length === 0) {
            seen.noActives++;
            if (own.grid !== null) seen.griddedNoActives++;
          }
          for (const c of [...own.active, ...own.bench]) {
            if (c.trainedTemperature === undefined) seen.untrained++;
            else seen.temps.add(c.trainedTemperature);
            if (c.generalization === undefined) seen.generalizationUnset++;
            if (c.deck === undefined) seen.noDeck++;
            else seen.decks++;
            for (const id of c.recordedFoes ?? []) expect(candidates.has(id)).toBe(true);
            if ((c.generalization ?? 0) >= 70 && (c.recordedFoes ?? []).length > 0) {
              seen.robustWithFoes++;
              if ((c.recordedFoes ?? []).includes(own.opponentId)) seen.robustVsRecorded++;
              else seen.robustVsUnseen++;
            }
          }
        }
      }),
      { numRuns: 500 },
    );
    expect([...seen.temps].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(seen.untrained).toBeGreaterThan(0);
    expect(seen.generalizationUnset).toBeGreaterThan(0);
    expect(seen.robustWithFoes).toBeGreaterThan(20);
    expect(seen.robustVsRecorded).toBeGreaterThan(5); // Robust's +5 off (Ruling 80)
    expect(seen.robustVsUnseen).toBeGreaterThan(5); // and on
    expect(seen.noActives).toBeGreaterThan(20);
    expect(seen.griddedNoActives).toBeGreaterThan(0);
    expect(seen.decks).toBeGreaterThan(100); // B2: subagents acting from decks
    expect(seen.noDeck).toBeGreaterThan(100);
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
    // The lever and injection paths are exercised, not just moves: ≥ 10% of the orchestrator commands
    // are a swap, a directive, a policy update or a move carrying an injection, and each kind occurs.
    expect(sent.swap).toBeGreaterThan(0);
    expect(sent.directive).toBeGreaterThan(0);
    expect(sent.policyUpdate).toBeGreaterThan(0);
    expect(sent.injection).toBeGreaterThan(0);
    expect((sent.swap + sent.directive + sent.policyUpdate + sent.injection) * 10).toBeGreaterThanOrEqual(sent.commands);
  });
});
