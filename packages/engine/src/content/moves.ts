import { deepFreeze, type MoveDef } from './primitives.js';
import { CODE_MOVES } from './moves/code.js';
import { MEMORY_MOVES } from './moves/memory.js';
import { OPEN_MOVES } from './moves/open.js';
import { REASONING_MOVES } from './moves/reasoning.js';
import { SEARCH_MOVES } from './moves/search.js';
import { SIGNATURE_MOVES } from './moves/signatures.js';
import { SPEED_MOVES } from './moves/speed.js';
import { SYSTEM_MOVES } from './moves/system.js';
import { VISION_MOVES } from './moves/vision.js';
import { VOICE_MOVES } from './moves/voice.js';

// Move data lives in moves/<type>.ts (one object per move); this module merges and freezes it.

const LAUNCH = {
  ...REASONING_MOVES,
  ...SPEED_MOVES,
  ...OPEN_MOVES,
  ...CODE_MOVES,
  ...VISION_MOVES,
  ...VOICE_MOVES,
  ...SEARCH_MOVES,
  ...MEMORY_MOVES,
  ...SYSTEM_MOVES,
};

const ALL = { ...LAUNCH, ...SIGNATURE_MOVES };

export type MoveId = keyof typeof ALL;

export const MOVES: Readonly<Record<MoveId, MoveDef>> = deepFreeze(ALL);

/** The bible's 57 launch moves, in table order. */
export const LAUNCH_MOVE_IDS: readonly MoveId[] = deepFreeze(Object.keys(LAUNCH) as MoveId[]);

/** One signature per slice species. */
export const SIGNATURE_MOVE_IDS: readonly MoveId[] = deepFreeze(Object.keys(SIGNATURE_MOVES) as MoveId[]);

/** Every move by id: moveDef runs on every card judged and every move resolved. */
const BY_ID: ReadonlyMap<string, MoveDef> = new Map(Object.entries(MOVES));

/** The move with this id, or null for an id that is not a move (lever names, typos, prototype keys). */
export function moveDef(moveId: string): MoveDef | null {
  return BY_ID.get(moveId) ?? null;
}
