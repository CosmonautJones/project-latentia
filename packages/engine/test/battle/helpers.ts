import { SPECIES } from '../../src/content/species.js';
import { createBattle } from '../../src/battle/setup.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { BattleState, CreatureState } from '../../src/battle/state.js';

export const SEED = '0123456789abcdef0123456789abcdef';

export const mon = (id: string, species: string, level = 5): CreatureSetup => ({
  id,
  species,
  level,
  version: 'v1',
  moves: [...(SPECIES[species as keyof typeof SPECIES]?.moves ?? [])],
});

/** A gridless side (both slots exist): sagelet orchestrator, blitzr + forkling active, three bench. */
export const gridlessSide = (tag: string, over: Partial<SideSetup> = {}): SideSetup => ({
  orchestrator: mon(`${tag}-orch`, 'sagelet'),
  active: [mon(`${tag}-act1`, 'blitzr'), mon(`${tag}-act2`, 'forkling')],
  bench: [mon(`${tag}-b1`, 'tokenibble'), mon(`${tag}-b2`, 'agentoad'), mon(`${tag}-b3`, 'blitzr')],
  grid: null,
  opponentId: tag === 'a' ? 'b' : 'a',
  ...over,
});

export const gridlessSetup = (a: Partial<SideSetup> = {}, b: Partial<SideSetup> = {}): BattleSetup => ({
  a: gridlessSide('a', a),
  b: gridlessSide('b', b),
  kind: 'trainer',
});

/**
 * Canonical indices of the default gridless battle:
 * 0 a-orch, 1 a-act1, 2 a-act2, 3-5 a-b1..b3, 6 b-orch, 7 b-act1, 8 b-act2, 9-11 b-b1..b3.
 */
export const battle = (a: Partial<SideSetup> = {}, b: Partial<SideSetup> = {}): BattleState => createBattle(gridlessSetup(a, b), SEED);

/** Crafts a KO directly on the state (no damage pipeline yet). */
export function faint(c: CreatureState | undefined): void {
  if (c === undefined) throw new Error('no such creature');
  c.hp = 0;
  c.fainted = true;
}

export function at(state: BattleState, i: number): CreatureState {
  const c = state.creatures[i];
  if (c === undefined) throw new Error(`no creature ${i}`);
  return c;
}
