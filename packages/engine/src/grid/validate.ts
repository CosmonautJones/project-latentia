import { cellsOf, HEADROOM_FLOOR, rotateShape, type GridLayout, type PieceKind, type PlacedPiece, type Rotation } from './model.js';

export interface GridError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export interface ValidationResult {
  readonly ok: boolean;
  readonly errors: GridError[];
}

type Shape = readonly (readonly [number, number])[];

const CANONICAL: Readonly<Record<Exclude<PieceKind, 'graft'>, Shape>> = {
  systemPrompt: [[0, 0], [1, 0], [2, 0]],
  skill: [[0, 0], [1, 0]],
  tool: [[0, 0]],
  exampleCard: [[0, 0]],
  cache: [[0, 0]],
  subagentSlot: [[0, 0], [1, 0], [0, 1], [1, 1]],
};

const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270];

function key(c: readonly [number, number]): string {
  return `${c[0]},${c[1]}`;
}

function sortedKeys(shape: Shape, rotation: Rotation): string {
  const keys = rotateShape(shape, rotation).map(key);
  keys.sort();
  return keys.join(';');
}

function sameUpToRotation(a: Shape, b: Shape): boolean {
  if (a.length !== b.length) return false;
  const target = sortedKeys(a, 0);
  for (let i = 0; i < ROTATIONS.length; i++) {
    if (sortedKeys(b, ROTATIONS[i] as Rotation) === target) return true;
  }
  return false;
}

function isConnected(shape: Shape): boolean {
  const all = new Set(shape.map(key));
  if (all.size !== shape.length) return false;
  const seen = new Set<string>();
  const stack: (readonly [number, number])[] = [shape[0] as readonly [number, number]];
  seen.add(key(shape[0] as readonly [number, number]));
  while (stack.length > 0) {
    const c = stack.pop() as readonly [number, number];
    const next: [number, number][] = [[c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1] + 1], [c[0], c[1] - 1]];
    for (let i = 0; i < next.length; i++) {
      const n = next[i] as [number, number];
      const k = key(n);
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push(n);
      }
    }
  }
  return seen.size === shape.length;
}

function shapeError(piece: PlacedPiece): string | undefined {
  if (piece.shape.length === 0) return 'shape has no cells';
  for (let i = 0; i < piece.shape.length; i++) {
    const c = piece.shape[i] as readonly [number, number];
    if (!Number.isSafeInteger(c[0]) || !Number.isSafeInteger(c[1])) return 'shape offsets must be integers';
  }
  if (!Number.isSafeInteger(piece.anchor[0]) || !Number.isSafeInteger(piece.anchor[1])) return 'anchor must be integers';
  if (piece.rotation !== 0 && piece.rotation !== 90 && piece.rotation !== 180 && piece.rotation !== 270) {
    return 'rotation must be 0, 90, 180 or 270';
  }
  if (piece.kind === 'graft') {
    if (piece.shape.length < 3 || piece.shape.length > 4) return 'graft shape must have 3-4 cells';
    if (!isConnected(piece.shape)) return 'graft shape must be orthogonally connected';
    return undefined;
  }
  if (!sameUpToRotation(CANONICAL[piece.kind], piece.shape)) return `shape does not match the canonical ${piece.kind} shape`;
  return undefined;
}

export function validateGrid(grid: GridLayout, level: number): ValidationResult {
  const errors: GridError[] = [];
  const add = (code: string, path: string, message: string): void => {
    errors.push({ code, path, message });
  };

  void level; // size is supplied by the caller; the level is accepted for interface stability.
  const occupied = new Map<string, string>();
  const seenIds = new Set<string>();
  const reported = new Set<string>();
  let systemPrompts = 0;
  let skills = 0;

  for (let p = 0; p < grid.pieces.length; p++) {
    const piece = grid.pieces[p] as PlacedPiece;
    const path = `pieces[${p}]`;
    if (seenIds.has(piece.id)) add('duplicateId', path, `duplicate piece id ${piece.id}`);
    seenIds.add(piece.id);
    if (piece.kind === 'systemPrompt') systemPrompts++;
    if (piece.kind === 'skill') skills++;

    const bad = shapeError(piece);
    if (bad !== undefined) {
      add('shape', path, `${piece.id}: ${bad}`);
      continue;
    }
    const cells = cellsOf(piece);
    let outOfBounds = false;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i] as [number, number];
      if (c[0] < 0 || c[1] < 0 || c[0] >= grid.width || c[1] >= grid.height) {
        outOfBounds = true;
        continue;
      }
      const k = key(c);
      const other = occupied.get(k);
      if (other !== undefined && other !== piece.id) {
        const pair = `${other}|${piece.id}`;
        if (!reported.has(pair)) {
          reported.add(pair);
          add('overlap', path, `${piece.id} overlaps ${other} at (${c[0]}, ${c[1]})`);
        }
      } else {
        occupied.set(k, piece.id);
      }
    }
    if (outOfBounds) add('bounds', path, `${piece.id} extends outside the ${grid.width}x${grid.height} grid`);
  }

  if (systemPrompts !== 1) add('systemPromptCount', 'pieces', `expected exactly 1 System Prompt, found ${systemPrompts}`);
  if (skills > 4) add('skillCount', 'pieces', `at most 4 Skills allowed, found ${skills}`);
  const headroom = grid.width * grid.height - occupied.size;
  if (headroom < HEADROOM_FLOOR) add('headroomFloor', 'pieces', `headroom ${headroom} is below the floor of ${HEADROOM_FLOOR}`);

  return { ok: errors.length === 0, errors };
}
