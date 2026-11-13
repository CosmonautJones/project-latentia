// Context as pips (ruling V13): one pip per context cell, used ones filled, the free capacity as empty pips; each move
// shows its cost as pips too. A move that costs more than the free cells is shown dimmed with a reason line. It is
// never silently refused: it still runs, and the spill becomes Drift (worse aim), which the line says. Pure.

export type Pip = 'used' | 'free';

/** The window as pips, used first: 12 cells with 5 used → 5 'used' then 7 'free'. */
export function contextPips(used: number, window: number): Pip[] {
  const w = Math.max(0, window);
  const u = Math.max(0, Math.min(w, used));
  return [...Array<Pip>(u).fill('used'), ...Array<Pip>(w - u).fill('free')];
}

export interface CostView {
  /** The move's cost pips: 'fits' while a free cell covers it, 'over' for each cell past the free ones. */
  readonly pips: readonly ('fits' | 'over')[];
  readonly affordable: boolean;
  /** Why it is dimmed ("needs 3 context, 1 free"), or null when it fits. */
  readonly reason: string | null;
}

export function costView(cost: number, free: number): CostView {
  const c = Math.max(0, cost);
  const f = Math.max(0, free);
  const pips = Array.from({ length: c }, (_, i): 'fits' | 'over' => (i < f ? 'fits' : 'over'));
  const affordable = c <= f;
  return { pips, affordable, reason: affordable ? null : `needs ${c} context, ${f} free` };
}

/** The reason line under a dimmed move: what using it anyway does. */
export const OVERFLOW_NOTE = 'Use it anyway and the spill becomes Drift (worse aim). COMPACT frees room.';
