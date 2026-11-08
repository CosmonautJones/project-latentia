import {
  SPECIES,
  type Card,
  type Condition,
  type CreatureSetup,
  type Deck,
  type FieldKind,
  type GridLayout,
  type PlacedPiece,
  type SpeciesId,
  type StatusId,
  type Subject,
  type TargetSelector,
  type Temperature,
  type TypeId,
  type Version,
} from '@latentia/engine';
import type { Archetype } from '../types.js';

// Builders the archetype files author their teams with: conditions, cards, decks, creatures, grids drawn as text,
// and `archetype`, which names every creature after its archetype so any two archetypes can meet.

// --- conditions -------------------------------------------------------------------------------------------------

/** True every round: a card that always fires while its move fits. */
export const ALWAYS: Condition = { category: 'turn', op: 'atLeast', round: 1 };
/** Round 1 only. */
export const OPENER: Condition = { category: 'turn', op: 'below', round: 2 };
export const fromRound = (round: number): Condition => ({ category: 'turn', op: 'atLeast', round });
/** The actor has not used the card's move in the last `rounds` rounds (or ever). */
export const cooldown = (rounds: 1 | 2 | 3): Condition => ({ category: 'cooldown', rounds });
export const COIN: Condition = { category: 'coin' };
/** Subject below 25% HP. */
export const WEAK: Condition = { category: 'hp', op: 'below', pct: 25 };
/** Subject below 50% HP. */
export const HURT: Condition = { category: 'hp', op: 'below', pct: 50 };
/** Subject at 75% HP or more. */
export const HEALTHY: Condition = { category: 'hp', op: 'atLeast', pct: 75 };
/** Another living ally of the actor is below 50% HP. */
export const ALLY_HURT: Condition = { category: 'allyHp', op: 'below', pct: 50 };
/** Subject's context is at least 75% full. */
export const FULL: Condition = { category: 'contextFill', op: 'atLeast', pct: 75 };
export const hasStatus = (status: StatusId): Condition => ({ category: 'status', status });
export const DRIFT: Condition = hasStatus('drift');
/** The card's move is super effective against the subject. */
export const WEAK_TO_MOVE: Condition = { category: 'foeType', is: 'weakToMove' };
export const isType = (type: TypeId): Condition => ({ category: 'foeType', is: type });
export const BUFFED: Condition = { category: 'foeBuffed' };
export const lastMove = (move: string): Condition => ({ category: 'foeLastMove', move });
export const inField = (effect: FieldKind): Condition => ({ category: 'field', effect });

// --- cards and decks --------------------------------------------------------------------------------------------

export const card = (id: string, subject: Subject, condition: Condition, move: string, target: TargetSelector, extra: Pick<Card, 'recordedFrom' | 'allowOverflow'> = {}): Card => ({
  id,
  subject,
  condition,
  move,
  target,
  ...extra,
});

/** A deck read top to bottom: `cards` in priority order, then the Default card (given first, as the one always there). */
export const deck = (fallback: Card, ...cards: Card[]): Deck => ({ cards, default: fallback });

// --- creatures --------------------------------------------------------------------------------------------------

/** The bible's version ladder by level: v2 at L6, v3.5 Turbo at L12 (v4 Max Preview at L20 is post-demo). */
export function versionFor(level: number): Version {
  return level >= 12 ? 'v3.5' : level >= 6 ? 'v2' : 'v1';
}

/** A gridded orchestrator: it lists no moves (its signature and Skills come from the grid). `version` pins it below its level's. */
export const orchestrator = (id: string, species: SpeciesId, level: number, version: Version = versionFor(level)): CreatureSetup => ({ id, species, level, version, moves: [] });

export type Training = { deck: Deck; generalization: number; trainedTemperature: Temperature; recordedFoes?: string[]; version?: Version };

/** A trained subagent knowing its species' four moves. */
export function subagent(id: string, species: SpeciesId, level: number, t: Training): CreatureSetup {
  return {
    id,
    species,
    level,
    version: t.version ?? versionFor(level),
    moves: [...SPECIES[species].moves],
    deck: t.deck,
    generalization: t.generalization,
    trainedTemperature: t.trainedTemperature,
    ...(t.recordedFoes === undefined ? {} : { recordedFoes: t.recordedFoes }),
  };
}

// --- grids ------------------------------------------------------------------------------------------------------

/** A multi-cell piece a layout letter stands for. */
export type LegendEntry = { skill: string } | { graft: string } | { slot: string };

const ONE_CELL: Readonly<Record<string, PlacedPiece['kind']>> = { t: 'tool', e: 'exampleCard', c: 'cache' };

type Offsets = [number, number][];

function normalized(cells: readonly (readonly [number, number])[]): Offsets {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]): [number, number] => [x - minX, y - minY]);
}

const keyOf = (cells: Offsets): string =>
  cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(';');

/** Whether `drawn` is `shape` turned by some quarter turn (the set of four turns does not depend on the convention). */
function sameUpToRotation(drawn: Offsets, shape: readonly (readonly [number, number])[]): boolean {
  let turned: Offsets = shape.map(([x, y]): [number, number] => [x, y]);
  for (let i = 0; i < 4; i++) {
    if (keyOf(normalized(turned)) === keyOf(drawn)) return true;
    turned = turned.map(([x, y]): [number, number] => [-y, x]);
  }
  return false;
}

/** The slice species whose signature `moveId` is: a graft piece takes that species' graft shape. */
function graftSource(moveId: string) {
  const source = Object.values(SPECIES).find((s) => s.signature === moveId);
  if (source === undefined) throw new Error(`graft ${moveId} is no species' signature`);
  return source;
}

/**
 * A grid drawn as text, one string per row (the row count is the height, the length the width). `P` is the System
 * Prompt, `t` a Tool, `e` an Example Card, `c` a Cache and `.` an empty cell; every other letter is the multi-cell
 * piece its `legend` entry names. Each piece is placed as drawn (rotation 0, its shape the drawn cells, anchored at
 * their top-left), which validateGrid accepts for any quarter turn of the canonical shape; a graft must be drawn as a
 * turn of its source species' graft shape. Piece order — the compaction order — is the System Prompt, then the legend
 * in its order, then the 1×1 pieces in reading order.
 */
export function layout(rows: readonly string[], legend: Readonly<Record<string, LegendEntry>>): GridLayout {
  const width = rows[0]?.length ?? 0;
  const cellsByChar = new Map<string, [number, number][]>();
  const singles: PlacedPiece[] = [];
  const count: Record<string, number> = {};
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`layout row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const kind = ONE_CELL[ch];
      if (kind !== undefined) {
        count[kind] = (count[kind] ?? 0) + 1;
        singles.push({ id: `${kind}-${count[kind]}`, kind, shape: [[0, 0]], anchor: [x, y], rotation: 0 });
        return;
      }
      if (ch !== 'P' && legend[ch] === undefined) throw new Error(`layout letter ${ch} is not in the legend`);
      cellsByChar.set(ch, [...(cellsByChar.get(ch) ?? []), [x, y]]);
    });
  });
  const place = (ch: string, base: Omit<PlacedPiece, 'shape' | 'anchor' | 'rotation'>): PlacedPiece => {
    const cells = cellsByChar.get(ch);
    if (cells === undefined) throw new Error(`legend letter ${ch} is not drawn`);
    const anchor: [number, number] = [Math.min(...cells.map((c) => c[0])), Math.min(...cells.map((c) => c[1]))];
    return { ...base, shape: normalized(cells), anchor, rotation: 0 };
  };
  const pieces: PlacedPiece[] = [place('P', { id: 'system-prompt', kind: 'systemPrompt' })];
  for (const [ch, entry] of Object.entries(legend)) {
    if ('skill' in entry) pieces.push(place(ch, { id: `skill:${entry.skill}`, kind: 'skill', moveId: entry.skill }));
    else if ('slot' in entry) pieces.push(place(ch, { id: `slot-${ch}`, kind: 'subagentSlot', subagentId: entry.slot }));
    else {
      const piece = place(ch, { id: `graft:${entry.graft}`, kind: 'graft', moveId: entry.graft });
      if (!sameUpToRotation(normalized(piece.shape), graftSource(entry.graft).graftShape)) throw new Error(`graft ${entry.graft} is not drawn in its species' shape`);
      pieces.push(piece);
    }
  }
  return { width, height: rows.length, pieces: [...pieces, ...singles] };
}

// --- archetypes -------------------------------------------------------------------------------------------------

export type ArchetypeSpec = {
  orchestrator: CreatureSetup;
  active: CreatureSetup[];
  bench?: CreatureSetup[];
  grid: GridLayout;
  autopilot: Deck;
  temperature: Temperature;
};

/**
 * An archetype from creatures with short local ids: each creature id (and each Subagent Slot's subagentId) becomes
 * `<archetype id>/<local id>`, so creature ids never collide between two archetypes. `opponentId` is a placeholder
 * (`field`): runMatch sets it per match (Ruling 127).
 */
export function archetype(id: string, spec: ArchetypeSpec): Archetype {
  const named = (c: CreatureSetup): CreatureSetup => ({ ...c, id: `${id}/${c.id}` });
  const pieces = spec.grid.pieces.map((p) => (p.subagentId === undefined ? p : { ...p, subagentId: `${id}/${p.subagentId}` }));
  return {
    id,
    side: {
      orchestrator: named(spec.orchestrator),
      active: spec.active.map(named),
      bench: (spec.bench ?? []).map(named),
      grid: { ...spec.grid, pieces },
      autopilot: { deck: spec.autopilot, temperature: spec.temperature },
      opponentId: 'field',
    },
  };
}
