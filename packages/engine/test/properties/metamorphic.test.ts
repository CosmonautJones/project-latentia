import { describe, expect, it } from 'vitest';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import { simulate } from '../../src/battle/simulate.js';
import type { SideId } from '../../src/battle/state.js';
import { SPECIES } from '../../src/content/species.js';
import { seedAt } from '../helpers/arbitraries.js';

// Metamorphic (spec §8): swapping sides with the mirrored setup mirrors the outcome. Tested statistically:
// over the same fixed seeds, team X's win rate as side A and as side B (against the same team Y, both sides
// on default intents) differ by at most 5 points. Runtime: 4,000 battles, about 2-4 s on Node 22.

const SEEDS = 2000;
const MAX_GAP_POINTS = 5;

const mon = (id: string, species: keyof typeof SPECIES, level: number): CreatureSetup => ({
  id,
  species,
  level,
  version: 'v2',
  moves: [...SPECIES[species].moves],
});

type Team = (tag: SideId) => SideSetup;

const X: Team = (tag) => ({
  orchestrator: mon(`${tag}-x-orch`, 'sagelet', 10),
  active: [mon(`${tag}-x-blitzr`, 'blitzr', 10), mon(`${tag}-x-forkling`, 'forkling', 10)],
  bench: [mon(`${tag}-x-tokenibble`, 'tokenibble', 10)],
  grid: null,
  opponentId: 'y',
});

const Y: Team = (tag) => ({
  orchestrator: mon(`${tag}-y-orch`, 'cobolt', 10),
  active: [mon(`${tag}-y-vibrat`, 'vibrat', 10), mon(`${tag}-y-hallucinat`, 'hallucinat', 10)],
  bench: [mon(`${tag}-y-agentoad`, 'agentoad', 10)],
  grid: null,
  opponentId: 'x',
});

const setup = (a: Team, b: Team): BattleSetup => ({ a: a('a'), b: b('b'), kind: 'trainer' });

/** Wins of the team on `side`, in percentage points, over the fixed seeds. */
function winRate(s: BattleSetup, side: SideId): number {
  let wins = 0;
  for (let i = 0; i < SEEDS; i++) if (simulate(s, seedAt(i), { kind: 'recorded', rounds: [] }).winner === side) wins++;
  return (wins * 100) / SEEDS;
}

describe('metamorphic: mirrored sides mirror the outcome (statistical)', () => {
  it(`X's win rate as side A and as side B differ by ≤ ${MAX_GAP_POINTS} points over ${SEEDS} seeds`, () => {
    const asA = winRate(setup(X, Y), 'a');
    const asB = winRate(setup(Y, X), 'b');
    // Guard against a vacuous pass: the matchup must be decided by the battles, not one-sided.
    expect(asA).toBeGreaterThan(5);
    expect(asA).toBeLessThan(95);
    expect(Math.abs(asA - asB)).toBeLessThanOrEqual(MAX_GAP_POINTS);
  }, 60_000);
});
