import { describe, expect, it } from 'vitest';
import { assertInvariants } from '../../../src/battle/invariants.js';
import { submitRound } from '../../../src/battle/round.js';
import { createBattle } from '../../../src/battle/setup.js';
import type { BattleState, Temperature } from '../../../src/battle/state.js';
import { MOVES, type MoveId } from '../../../src/content/moves.js';
import { EFFECT_KINDS, type MoveDef, type NonPassiveEffect } from '../../../src/content/primitives.js';
import { SPECIES, SPECIES_IDS } from '../../../src/content/species.js';
import { at, gridlessSetup, mon, SEED } from '../helpers.js';
import { fresh, run } from './kit.js';

// After A13 no effect kind may throw "unimplemented": every move's every effect list (normal, Wild, Wild T4)
// resolves in a crafted battle, and every species' passives fire through a few real rounds.

const MOVE_IDS = Object.keys(MOVES) as MoveId[];

function allEffects(): NonPassiveEffect[] {
  const moves = MOVE_IDS.flatMap((id) => {
    const m: MoveDef = MOVES[id];
    return [...m.effects, ...(m.wild ?? []), ...(m.wildT4 ?? [])];
  });
  const passives = SPECIES_IDS.flatMap((id) => SPECIES[id].passives.flatMap((p) => p.effects));
  return [...moves, ...passives];
}

/** A target the move accepts from a-act1 (1): an ally for ally moves, the user for self/none, else b-act1 (7). */
function targetFor(def: MoveDef): number {
  if (def.target === 'ally') return 2;
  if (def.target === 'self' || def.target === 'none') return 1;
  return 7;
}

/** Round 1 with history (a side-A last move, a b-act1 last move) and buffs to copy or steal. */
function crafted(): BattleState {
  const s = fresh();
  run(s, 2, 'ship-it', 7);
  run(s, 7, 'ship-it', 2);
  Object.assign(at(s, 7).stages, { compute: 1, latency: 2 });
  return s;
}

describe('content coverage', () => {
  it('content uses every effect kind, and the passives use every passive trigger they are documented with', () => {
    const kinds = new Set<string>([...allEffects().map((e) => e.kind), 'passive']);
    expect([...kinds].sort()).toEqual([...EFFECT_KINDS].sort());
  });

  for (const id of MOVE_IDS) {
    for (const t of [2, 3, 4] as Temperature[]) {
      it(`${id} resolves at T${t}`, () => {
        const s = crafted();
        at(s, 1).trainedTemperature = t;
        const def: MoveDef = MOVES[id];
        expect(() => run(s, 1, id, targetFor(def))).not.toThrow();
        if (at(s, 1).charging !== null) {
          s.round = 2;
          expect(() => run(s, 1, id, targetFor(def))).not.toThrow();
        }
        assertInvariants(s);
      });
    }
  }

  for (const species of SPECIES_IDS) {
    it(`${species}'s passives fire through five real rounds`, () => {
      const side = (tag: string) => ({
        orchestrator: mon(`${tag}-orch`, species),
        active: [mon(`${tag}-act1`, species), mon(`${tag}-act2`, species)],
        bench: [mon(`${tag}-b1`, species)],
      });
      let s: BattleState = createBattle(gridlessSetup(side('a'), side('b')), SEED);
      for (let r = 0; r < 5 && !s.ended; r++) {
        const next = submitRound(s, {});
        if ('error' in next) throw new Error(next.error.message);
        s = next.state;
      }
      assertInvariants(s);
    });
  }
});
