import { SPECIES } from '../../src/content/species.js';
import { createBattle } from '../../src/battle/setup.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { ActionEntry } from '../../src/battle/order.js';
import type { BattleState, CreatureState } from '../../src/battle/state.js';
import type { ActionDraws } from '../../src/rng/draws.js';

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
 * For tests of other rules. Clears every creature's shields and pending next-action modifiers — at creation
 * these are exactly what the battleStart passives set up (Sagelet's status shield, Forkling's hit shield,
 * Blitzr's +1 priority) — and sets every creature's round-start draws to R1 = 0, R2 with hi(r2, 100) = 99.
 * That neutralizes chance passives (Blitzr's first-action recoil) only for actions resolved directly with
 * resolveAction/resolveEntry: submitRound redraws R1/R2 every round, so there they can still proc. Passives
 * without a chance — Slopling's notKoThisRound stage — are not neutralized. Passive tests use
 * `battleWithPassives` or createBattle.
 */
export function withoutPassives(s: BattleState): BattleState {
  for (const c of s.creatures) {
    c.shields = [];
    c.nextActionMods = [];
    c.roundStart = { r1: 0, r2: word(99, 0) };
  }
  return s;
}

/**
 * Canonical indices of the default gridless battle:
 * 0 a-orch, 1 a-act1, 2 a-act2, 3-5 a-b1..b3, 6 b-orch, 7 b-act1, 8 b-act2, 9-11 b-b1..b3.
 * Passives are neutralized (see withoutPassives).
 */
export const battle = (a: Partial<SideSetup> = {}, b: Partial<SideSetup> = {}): BattleState => withoutPassives(createBattle(gridlessSetup(a, b), SEED));

/** The default battle exactly as createBattle builds it, battleStart passives applied. */
export const battleWithPassives = (a: Partial<SideSetup> = {}, b: Partial<SideSetup> = {}): BattleState => createBattle(gridlessSetup(a, b), SEED);

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

/** A draw word from its high and low 16-bit halves. */
export const word = (hiV: number, loV: number): number => ((hiV << 16) | loV) >>> 0;

export type DrawHalves = Partial<Record<'d1lo' | 'd1hi' | 'd2lo' | 'd2hi' | 'd3lo' | 'd3hi' | 'd4lo' | 'd4hi' | 'd5lo' | 'd5hi' | 'd6lo' | 'd6hi', number>>;

/**
 * Six action draws from their halves. Defaults trigger nothing: obedience and Drift miss (99), no Rate
 * Limited skip or hallucination (99), accuracy hits (0), no crit below stage 6 (47), roll 100% at T2
 * (lo 15 → 85 + 15), no multi-hit extra (0), riders miss (99).
 */
export function draws(h: DrawHalves = {}): ActionDraws {
  const v = { d1lo: 0, d1hi: 99, d2lo: 99, d2hi: 99, d3lo: 0, d3hi: 0, d4lo: 47, d4hi: 0, d5lo: 15, d5hi: 0, d6lo: 99, d6hi: 0, ...h };
  return {
    d1: word(v.d1hi, v.d1lo),
    d2: word(v.d2hi, v.d2lo),
    d3: word(v.d3hi, v.d3lo),
    d4: word(v.d4hi, v.d4lo),
    d5: word(v.d5hi, v.d5lo),
    d6: word(v.d6hi, v.d6lo),
  };
}

/** A move entry for `actor` (priority/latency/tie-break do not matter once sorted). */
export const entry = (actor: number, moveId: string, target: number): ActionEntry => ({ actor, priority: 0, latency: 0, tieBreak: 0, moveId, target });
