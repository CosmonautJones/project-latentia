export type PieceKind = 'systemPrompt' | 'skill' | 'tool' | 'exampleCard' | 'subagentSlot' | 'graft' | 'cache';

export type Cell = readonly [number, number];
export type Rotation = 0 | 90 | 180 | 270;

export interface PlacedPiece {
  readonly id: string;
  readonly kind: PieceKind;
  /** Cell offsets [x, y], before rotation. */
  readonly shape: readonly (readonly [number, number])[];
  readonly anchor: readonly [number, number];
  readonly rotation: Rotation;
  readonly moveId?: string;
  readonly subagentId?: string;
}

export interface GridLayout {
  readonly width: number;
  readonly height: number;
  /** Array order is the compaction order. */
  readonly pieces: readonly PlacedPiece[];
}

/** [minimum orchestrator level, width, height], ascending. */
export const GRID_SIZE_BY_LEVEL: readonly (readonly [number, number, number])[] = [
  [1, 4, 4],
  [4, 5, 4],
  [7, 5, 5],
  [10, 6, 5],
  [13, 6, 6],
];

export const HEADROOM_FLOOR = 4;

/** Grid size for an orchestrator level: the last row whose minimum level is <= level (levels below 1 use the first row). */
export function gridSizeFor(level: number): { width: number; height: number } {
  let row = GRID_SIZE_BY_LEVEL[0] as readonly [number, number, number];
  for (let i = 0; i < GRID_SIZE_BY_LEVEL.length; i++) {
    const r = GRID_SIZE_BY_LEVEL[i] as readonly [number, number, number];
    if (r[0] <= level) row = r;
  }
  return { width: row[1], height: row[2] };
}

/**
 * Rotation convention: clockwise about the anchor by 0/90/180/270. Each offset
 * (x, y) rotates 90 -> (-y, x), 180 -> (-x, -y), 270 -> (y, -x); the rotated shape
 * is then normalized so its minimum x and minimum y offsets are 0, and the anchor
 * is added. The anchor is therefore the top-left corner of the rotated bounding box.
 */
export function rotateShape(shape: readonly (readonly [number, number])[], rotation: Rotation): [number, number][] {
  const turned: [number, number][] = [];
  for (let i = 0; i < shape.length; i++) {
    const c = shape[i] as readonly [number, number];
    const x = c[0];
    const y = c[1];
    if (rotation === 90) turned.push([-y, x]);
    else if (rotation === 180) turned.push([-x, -y]);
    else if (rotation === 270) turned.push([y, -x]);
    else turned.push([x, y]);
  }
  if (turned.length === 0) return turned;
  let minX = (turned[0] as [number, number])[0];
  let minY = (turned[0] as [number, number])[1];
  for (let i = 1; i < turned.length; i++) {
    const c = turned[i] as [number, number];
    if (c[0] < minX) minX = c[0];
    if (c[1] < minY) minY = c[1];
  }
  const out: [number, number][] = [];
  for (let i = 0; i < turned.length; i++) {
    const c = turned[i] as [number, number];
    out.push([c[0] - minX, c[1] - minY]);
  }
  return out;
}

/** Absolute grid cells of a piece (rotation applied, anchor added), in shape order. */
export function cellsOf(piece: PlacedPiece): [number, number][] {
  const rotated = rotateShape(piece.shape, piece.rotation);
  const out: [number, number][] = [];
  for (let i = 0; i < rotated.length; i++) {
    const c = rotated[i] as [number, number];
    out.push([c[0] + piece.anchor[0], c[1] + piece.anchor[1]]);
  }
  return out;
}
