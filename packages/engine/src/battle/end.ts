import type { BattleEvent } from '../events/types.js';
import { assertSafe } from '../math/bp.js';
import { slotRemoved } from './order.js';
import type { BattleState, CreatureState, Outcome, SideId } from './state.js';

/** The last round (spec §5 "Cap"); after it the HP-ratio tiebreak decides. */
export const ROUND_CAP = 50;

const SIDES: readonly SideId[] = ['a', 'b'];

/** Sides are numbered in events: a = 0, b = 1. */
export function sideNumber(side: SideId): number {
  return side === 'a' ? 0 : 1;
}

function benchOf(state: BattleState, side: SideId): CreatureState[] {
  return state.creatures
    .filter((c) => c.side === side && c.slot === 'bench')
    .sort((x, y) => (x.benchOrder ?? 0) - (y.benchOrder ?? 0) || x.index - y.index);
}

/** Bench orders become 0..n-1 in the given order. */
function renumber(bench: readonly CreatureState[]): void {
  bench.forEach((c, i) => {
    c.benchOrder = i;
  });
}

/**
 * Bench auto-fill (spec §5 "Sides and roster"), side A then B, slot 0 then 1. Each existing,
 * non-removed slot whose occupant is null or KO'd takes the first living bench creature by bench order.
 * A KO'd occupant moves to the end of the bench; the bench is re-numbered contiguously. A gridded side's
 * slot with `pieceId: null` does not exist and is never filled. Emits one Swapped per fill, with
 * `outIndex: -1` for an empty slot.
 */
export function autofillBench(state: BattleState, round: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (const side of SIDES) {
    const s = state.sides[side];
    s.slots.forEach((slot, i) => {
      const exists = s.grid === null || slot.pieceId !== null;
      if (!exists || slotRemoved(state, side, slot.pieceId)) return;
      const out = slot.occupant === null ? null : (state.creatures[slot.occupant] ?? null);
      if (out !== null && !out.fainted) return;
      const bench = benchOf(state, side);
      const inc = bench.find((c) => !c.fainted);
      if (inc === undefined) return;
      const rest = bench.filter((c) => c !== inc);
      inc.slot = 'active';
      inc.activeSlot = i === 0 ? 0 : 1;
      inc.benchOrder = null;
      slot.occupant = inc.index;
      if (out !== null) {
        out.slot = 'bench';
        out.activeSlot = null;
        rest.push(out);
      }
      renumber(rest);
      events.push({ round, type: 'Swapped', side: sideNumber(side), outIndex: out === null ? -1 : out.index, inIndex: inc.index });
    });
  }
  return events;
}

function finish(state: BattleState, result: Outcome, reason: 'knockout' | 'cap'): BattleEvent[] {
  state.ended = true;
  state.result = result;
  return [{ round: state.round, type: 'BattleEnd', winner: result === 'draw' ? null : sideNumber(result), reason }];
}

function wiped(state: BattleState, side: SideId): boolean {
  return state.creatures.every((c) => c.side !== side || c.fainted);
}

/**
 * Win check (spec §5): a side loses when every creature on it is KO'd; both wiped → draw. Sets
 * `ended`/`result` and returns the single BattleEnd, or nothing while both sides stand.
 */
export function checkEnd(state: BattleState): BattleEvent[] {
  if (state.ended) return [];
  const a = wiped(state, 'a');
  const b = wiped(state, 'b');
  if (!a && !b) return [];
  return finish(state, a && b ? 'draw' : a ? 'b' : 'a', 'knockout');
}

function sums(state: BattleState, side: SideId): { hp: number; max: number } {
  let hp = 0;
  let max = 0;
  for (const c of state.creatures) {
    if (c.side !== side) continue;
    hp += c.hp;
    max += c.maxHp;
  }
  return { hp, max };
}

/**
 * Round cap (spec §5 "Cap"): once round 50 has ended with no winner, A wins if ΣhpA × ΣmaxB > ΣhpB × ΣmaxA,
 * B if less, draw if equal (every creature counts, benched and KO'd included).
 */
export function checkCap(state: BattleState): BattleEvent[] {
  if (state.ended || state.round < ROUND_CAP) return [];
  const a = sums(state, 'a');
  const b = sums(state, 'b');
  const left = assertSafe(a.hp * b.max, 'cap ΣhpA×ΣmaxB');
  const right = assertSafe(b.hp * a.max, 'cap ΣhpB×ΣmaxA');
  return finish(state, left > right ? 'a' : left < right ? 'b' : 'draw', 'cap');
}
