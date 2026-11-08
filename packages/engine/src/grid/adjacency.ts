import { cellsOf, type GridLayout, type PlacedPiece } from './model.js';

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function neighbourPieces(grid: GridLayout, piece: PlacedPiece): PlacedPiece[] {
  const own = new Set<string>();
  const mine = cellsOf(piece);
  for (let i = 0; i < mine.length; i++) {
    const c = mine[i] as [number, number];
    own.add(cellKey(c[0], c[1]));
  }
  const out: PlacedPiece[] = [];
  for (let p = 0; p < grid.pieces.length; p++) {
    const other = grid.pieces[p] as PlacedPiece;
    if (other.id === piece.id) continue;
    const theirs = cellsOf(other);
    let touching = false;
    for (let i = 0; i < theirs.length && !touching; i++) {
      const c = theirs[i] as [number, number];
      touching =
        own.has(cellKey(c[0] + 1, c[1])) ||
        own.has(cellKey(c[0] - 1, c[1])) ||
        own.has(cellKey(c[0], c[1] + 1)) ||
        own.has(cellKey(c[0], c[1] - 1));
    }
    if (touching) out.push(other);
  }
  return out;
}

function findPiece(grid: GridLayout, pieceId: string): PlacedPiece | undefined {
  for (let i = 0; i < grid.pieces.length; i++) {
    const p = grid.pieces[i] as PlacedPiece;
    if (p.id === pieceId) return p;
  }
  return undefined;
}

/** Ids of pieces orthogonally adjacent to the piece, in grid piece order. Unknown id -> []. */
export function neighbours(grid: GridLayout, pieceId: string): string[] {
  const piece = findPiece(grid, pieceId);
  if (piece === undefined) return [];
  return neighbourPieces(grid, piece).map((p) => p.id);
}

function countAdjacentOfKind(grid: GridLayout, pieceId: string, kind: PlacedPiece['kind']): number {
  const piece = findPiece(grid, pieceId);
  if (piece === undefined) return 0;
  const adj = neighbourPieces(grid, piece);
  let n = 0;
  for (let i = 0; i < adj.length; i++) if ((adj[i] as PlacedPiece).kind === kind) n++;
  return n;
}

/** Effect steps (+1000 bp each) a Skill gains: the number of orthogonally adjacent Tools. */
export function toolStepsFor(grid: GridLayout, pieceId: string): number {
  return countAdjacentOfKind(grid, pieceId, 'tool');
}

/** Card slots per subagent version (spec §5 grid): the most active cards it can ever have. */
export const VERSION_SLOTS = { v1: 3, v2: 5, 'v3.5': 7, v4: 8 } as const;

/** Active cards for a subagent slot: min(version slots, adjacent Example Cards). Non-slot or unknown id -> 0. */
export function activeCardCount(grid: GridLayout, slotId: string, version: 'v1' | 'v2' | 'v3.5' | 'v4'): number {
  const slot = findPiece(grid, slotId);
  if (slot === undefined || slot.kind !== 'subagentSlot') return 0;
  const cards = countAdjacentOfKind(grid, slotId, 'exampleCard');
  const cap = VERSION_SLOTS[version];
  return cards < cap ? cards : cap;
}

/**
 * Compactable per spec §5: not pinned (System Prompt), not adjacent to a Cache,
 * covers at least 2 cells, and not already summarized.
 */
export function isCompactable(grid: GridLayout, pieceId: string, summarized: readonly string[]): boolean {
  const piece = findPiece(grid, pieceId);
  if (piece === undefined) return false;
  if (piece.kind === 'systemPrompt') return false;
  if (piece.shape.length < 2) return false;
  for (let i = 0; i < summarized.length; i++) if (summarized[i] === pieceId) return false;
  const adj = neighbourPieces(grid, piece);
  for (let i = 0; i < adj.length; i++) if ((adj[i] as PlacedPiece).kind === 'cache') return false;
  return true;
}
