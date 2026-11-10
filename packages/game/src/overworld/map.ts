// Overworld maps as data: each area is a typed character grid read through LEGEND, plus the things placed on it
// (signs, NPCs, the trainer, warps, the wild encounter and the spawn point of each overworld step). Pure: parsing
// throws on a malformed grid; the design rules (warps land, spawns are walkable, ...) are in validate.ts.
//
// Format (see content/maps/localhost.ts): `areas.<id>.rows` are equal-length strings, one char per 16x16 tile, x to
// the right and y down from the top-left. Everything else refers to tiles as { area, x, y }.

import type { OverworldStep } from '../flow/flow.js';
import type { Dir } from './direction.js';

export type TileKind = 'void' | 'grass' | 'path' | 'tree' | 'oldTree' | 'wall' | 'roof' | 'rack' | 'floor' | 'door' | 'sign' | 'patch';

/** One character per tile. */
export const LEGEND: Readonly<Record<string, TileKind>> = {
  ' ': 'void',
  '.': 'grass',
  ',': 'path',
  '#': 'tree',
  '%': 'oldTree', // the Deprecated Forest's autumn-rust trees
  W: 'wall',
  R: 'roof',
  K: 'rack', // a server rack in the lab
  _: 'floor',
  D: 'door',
  S: 'sign',
  '"': 'patch', // unindexed data: the trailhead's tall grass, where the wild model waits
};

const WALKABLE: ReadonlySet<TileKind> = new Set<TileKind>(['grass', 'path', 'floor', 'door', 'patch']);
export const isWalkableKind = (k: TileKind): boolean => WALKABLE.has(k);

export interface Pos {
  readonly x: number;
  readonly y: number;
}
export interface Place extends Pos {
  readonly area: string;
}
/** A place and a facing: where someone stands and which way they look. */
export interface Spot extends Place {
  readonly facing: Dir;
}

export type LookId = 'player' | 'professor' | 'farmer' | 'grad';

export interface NpcDef {
  readonly id: string;
  readonly look: LookId;
  readonly at: Spot;
  /** What A gets them to say. */
  readonly line: string;
  /** A different line at some steps of the journey. */
  readonly lines?: Readonly<Partial<Record<OverworldStep, string>>>;
}

/** A trainer: an NPC with a sightline. `line` is said while it only blocks the way; `engage` before its battle. */
export interface TrainerDef extends NpcDef {
  readonly sight: number;
  readonly engage: string;
}

export interface SignDef {
  readonly at: Place;
  readonly text: string;
}

/** Stepping onto `from` moves the player to `to`. */
export interface WarpDef {
  readonly from: Place;
  readonly to: Spot;
}

/** The scripted wild encounter: every patch tile of `area` triggers it; the wild model peeks out at `lurk`. */
export interface EncounterDef {
  readonly area: string;
  readonly lurk: Pos;
}

export interface AreaSource {
  readonly name: string;
  readonly rows: readonly string[];
  /** Named stretches of a wide area, west to east: from column `fromX` on, the place is called `name`. */
  readonly regions?: readonly { readonly fromX: number; readonly name: string }[];
}

export interface WorldSource {
  readonly areas: Readonly<Record<string, AreaSource>>;
  readonly signs: readonly SignDef[];
  readonly npcs: readonly NpcDef[];
  readonly trainer: TrainerDef;
  readonly warps: readonly WarpDef[];
  readonly encounter: EncounterDef;
  /** Where each overworld step starts (and Continue resumes). */
  readonly spawns: Readonly<Record<OverworldStep, Spot>>;
}

export interface Area {
  readonly id: string;
  readonly name: string;
  readonly regions: readonly { readonly fromX: number; readonly name: string }[];
  readonly width: number;
  readonly height: number;
  /** Row-major, width x height. */
  readonly tiles: readonly TileKind[];
}

export interface World extends Omit<WorldSource, 'areas'> {
  readonly areas: Readonly<Record<string, Area>>;
}

export function parseArea(id: string, src: AreaSource): Area {
  const { rows } = src;
  const first = rows[0];
  if (first === undefined) throw new Error(`${id}: no rows`);
  const width = first.length;
  const tiles: TileKind[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${id}: row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((ch, x) => {
      const kind = Object.hasOwn(LEGEND, ch) ? LEGEND[ch] : undefined;
      if (!kind) throw new Error(`${id}: unknown tile '${ch}' at (${x},${y})`);
      tiles.push(kind);
    });
  });
  return { id, name: src.name, regions: src.regions ?? [], width, height: rows.length, tiles };
}

export function parseWorld(src: WorldSource): World {
  const areas = Object.fromEntries(Object.entries(src.areas).map(([id, a]) => [id, parseArea(id, a)]));
  return { ...src, areas };
}

export const inBounds = (a: Area, p: Pos): boolean => p.x >= 0 && p.y >= 0 && p.x < a.width && p.y < a.height;

/** The tile at a place; off the map, or in an unknown area, is void. */
export function tileAt(w: World, p: Place): TileKind {
  const a = w.areas[p.area];
  if (!a || !inBounds(a, p)) return 'void';
  return a.tiles[p.y * a.width + p.x] ?? 'void';
}

/** What the place is called: the area's name, or the region of it the place is in. */
export function regionName(w: World, p: Place): string {
  const a = w.areas[p.area];
  if (!a) return '';
  return a.regions.filter((r) => p.x >= r.fromX).at(-1)?.name ?? a.name;
}

export const placeKey = (p: Place): string => `${p.area}:${p.x},${p.y}`;
export const samePlace = (a: Place, b: Place): boolean => a.area === b.area && a.x === b.x && a.y === b.y;
