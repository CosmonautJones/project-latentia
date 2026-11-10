// Grid movement, pure: one tile per step at about 4 tiles a second (design bible "overworld rules"). Holding a
// direction walks; from a standstill a short tap in a new direction only turns. A step always finishes once begun,
// and the time left over at arrival carries into the next step, so a held walk is smooth with no per-tile hitch.
// The logical tile changes on arrival: contact (warps, the patch, trainer sight) is checked on step completion.

import { DELTA, type Dir } from './direction.js';
import type { Pos } from './map.js';

/** Milliseconds per tile. */
export const STEP_MS = 250;
/** How long a new direction must be held, from a standstill, before the turn becomes a step. */
export const TURN_MS = 90;

export interface Move {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly elapsed: number;
}

export interface WalkerState {
  readonly x: number;
  readonly y: number;
  readonly facing: Dir;
  readonly move: Move | null;
  /** Leftover ms from the last arrival, spent on the next step if the walk goes on. */
  readonly carry: number;
  /** True right after an arrival: a held walk continues without a turn pause. */
  readonly momentum: boolean;
  /** Ms a fresh turn has been held, or null when not turning. */
  readonly turnMs: number | null;
  /** The direction last bumped into a wall, so a held bump reports once. */
  readonly bumped: Dir | null;
}

export interface WalkerUpdate {
  readonly state: WalkerState;
  /** A step completed this update; the walker now stands on its new tile. */
  readonly arrived: boolean;
  /** The walker tried to step into a blocked tile (once per press). */
  readonly bumped: boolean;
}

export function createWalker(at: Pos & { readonly facing: Dir }): WalkerState {
  return { x: at.x, y: at.y, facing: at.facing, move: null, carry: 0, momentum: false, turnMs: null, bumped: null };
}

/** Put the walker somewhere (a warp, a spawn) or turn it (a script), dropping any step in progress. */
export function placeWalker(_s: WalkerState, at: Pos & { readonly facing: Dir }): WalkerState {
  return createWalker(at);
}

const idle = (s: WalkerState): WalkerUpdate => ({ state: s, arrived: false, bumped: false });

export function updateWalker(s: WalkerState, dtMs: number, held: Dir | null, canEnter: (x: number, y: number) => boolean): WalkerUpdate {
  if (s.move) {
    const elapsed = s.move.elapsed + dtMs;
    if (elapsed < STEP_MS) return idle({ ...s, move: { ...s.move, elapsed } });
    const arrivedAt = { ...s, x: s.move.toX, y: s.move.toY, move: null, carry: elapsed - STEP_MS, momentum: true };
    return { state: arrivedAt, arrived: true, bumped: false };
  }
  if (held === null) return idle({ ...s, carry: 0, momentum: false, turnMs: null, bumped: null });

  if (held !== s.facing && !s.momentum) return idle({ ...s, facing: held, turnMs: 0, bumped: null });
  if (s.turnMs !== null && s.turnMs + dtMs < TURN_MS) return idle({ ...s, turnMs: s.turnMs + dtMs });

  const toX = s.x + DELTA[held].dx;
  const toY = s.y + DELTA[held].dy;
  if (!canEnter(toX, toY)) {
    const first = s.bumped !== held;
    return { state: { ...s, facing: held, carry: 0, momentum: false, turnMs: null, bumped: held }, arrived: false, bumped: first };
  }
  const move: Move = { fromX: s.x, fromY: s.y, toX, toY, elapsed: s.carry + dtMs };
  return idle({ ...s, facing: held, move, carry: 0, momentum: false, turnMs: null, bumped: null });
}

/** Where to draw the walker: the tile's top-left in pixels, tweened mid-step, rounded to whole pixels. */
export function pixelPos(s: WalkerState, tile: number): Pos {
  if (!s.move) return { x: s.x * tile, y: s.y * tile };
  const t = Math.min(1, s.move.elapsed / STEP_MS);
  return {
    x: Math.round((s.move.fromX + (s.move.toX - s.move.fromX) * t) * tile),
    y: Math.round((s.move.fromY + (s.move.toY - s.move.fromY) * t) * tile),
  };
}

/** The 2-frame walk bob: the stride frame in the first half of each step, standing otherwise. */
export const walkFrame = (s: WalkerState): 0 | 1 => (s.move && s.move.elapsed < STEP_MS / 2 ? 1 : 0);
