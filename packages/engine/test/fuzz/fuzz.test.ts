import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ROUND_CAP } from '../../src/battle/end.js';
import { simulate } from '../../src/battle/simulate.js';
import { arbLegalSetup, arbSeed } from '../helpers/arbitraries.js';
import { arbScriptedCommands } from '../helpers/commands.js';

// Fuzz (spec §2 criterion 4, §8): random legal battles finish with no exception and no invariant error
// (submitRound's per-round assertInvariants runs inside simulate), each ending by the round cap.
// 500 battles on every push; FUZZ_N raises it (the nightly job runs 10,000). Node only (not in the browser run).

const DEFAULT_N = 500;
const requested = Number.parseInt(process.env['FUZZ_N'] ?? '', 10);
const N = Number.isSafeInteger(requested) && requested > DEFAULT_N ? requested : DEFAULT_N;

describe('fuzz', () => {
  it(`${N} random legal battles end by round ${ROUND_CAP} with no exception`, () => {
    let battles = 0;
    fc.assert(
      fc.property(arbLegalSetup, arbSeed, arbScriptedCommands, fc.boolean(), (setup, seed, scripted, defaults) => {
        const r = simulate(setup, seed, defaults ? { kind: 'recorded', rounds: [] } : scripted);
        battles++;
        expect(r.rounds).toBeLessThanOrEqual(ROUND_CAP);
        expect(r.events[r.events.length - 1]?.type).toBe('BattleEnd');
      }),
      { numRuns: N },
    );
    expect(battles).toBe(N);
  }, 600_000);
});
