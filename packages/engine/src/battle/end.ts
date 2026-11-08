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

/** A side's bench creatures in bench order (KO'd ones included). */
export function benchOf(state: BattleState, side: SideId): CreatureState[] {
  return state.creatures
    .filter((c) => c.side === side && c.slot === 'bench')
    .sort((x, y) => (x.benchOrder ?? 0) - (y.benchOrder ?? 0) || x.index - y.index);
}

/** Bench orders become 0..n-1 in the given order. */
export function renumber(bench: readonly CreatureState[]): void {
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

function wiped(state: BattleState, side: SideId): boolean {
  return state.creatures.every((c) => c.side !== side || c.fainted);
}

/**
 * The win decision (spec §5, Ruling 32), without emitting anything: a side loses when every creature on
 * it is KO'd; both wiped → draw; null while both sides stand. Checked after every action and at end of round.
 */
export function winOutcome(state: BattleState): Outcome | null {
  const a = wiped(state, 'a');
  const b = wiped(state, 'b');
  if (a && b) return 'draw';
  return a ? 'b' : b ? 'a' : null;
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
 * The cap decision (spec §5 "Cap"), without emitting anything: from round 50 on, A wins if
 * ΣhpA × ΣmaxB > ΣhpB × ΣmaxA, B if less, draw if equal (every creature counts, benched and KO'd
 * included); null before the cap.
 */
export function capOutcome(state: BattleState): Outcome | null {
  if (state.round < ROUND_CAP) return null;
  const a = sums(state, 'a');
  const b = sums(state, 'b');
  const left = assertSafe(a.hp * b.max, 'cap ΣhpA×ΣmaxB');
  const right = assertSafe(b.hp * a.max, 'cap ΣhpB×ΣmaxA');
  return left > right ? 'a' : left < right ? 'b' : 'draw';
}

/**
 * Ends the battle if it is decided — a knockout first, then the round-50 cap — setting `ended`/`result`
 * and returning the single BattleEnd; nothing while undecided or once already ended. Called after RoundEnd.
 */
export function checkEnd(state: BattleState): BattleEvent[] {
  if (state.ended) return [];
  const knockout = winOutcome(state);
  const result = knockout ?? capOutcome(state);
  if (result === null) return [];
  state.ended = true;
  state.result = result;
  return [{ round: state.round, type: 'BattleEnd', winner: result === 'draw' ? null : sideNumber(result), reason: knockout === null ? 'cap' : 'knockout' }];
}
