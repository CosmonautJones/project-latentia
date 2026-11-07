import type { GridLayout, PieceKind, PlacedPiece } from '../../src/grid/model.js';

const SHAPES: Record<Exclude<PieceKind, 'graft'>, [number, number][]> = {
  systemPrompt: [[0, 0], [1, 0], [2, 0]],
  skill: [[0, 0], [1, 0]],
  tool: [[0, 0]],
  exampleCard: [[0, 0]],
  cache: [[0, 0]],
  subagentSlot: [[0, 0], [1, 0], [0, 1], [1, 1]],
};

export function piece(id: string, kind: Exclude<PieceKind, 'graft'>, x: number, y: number, rotation: PlacedPiece['rotation'] = 0): PlacedPiece {
  return { id, kind, shape: SHAPES[kind], anchor: [x, y], rotation };
}

export function grid(width: number, height: number, pieces: PlacedPiece[]): GridLayout {
  return { width, height, pieces };
}
