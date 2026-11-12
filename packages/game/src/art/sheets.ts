// The art pass's sheets, as the game uses them: the one place that knows sheet ids, animation names and frame
// numbers. Everything is read from the manifest that `pnpm --filter @latentia/game sync-art` copies from
// packages/art/out (test/unit/art-sheets.test.ts checks the copy and every frame used here). Pure: art/load.ts turns it
// into Phaser textures and animations.

import manifest from './manifest.json';
import type { Dir } from '../overworld/direction.js';
import type { TileKind } from '../overworld/map.js';

export interface AnimDef {
  readonly frames: readonly number[];
  readonly frameMs: number;
  readonly loop: boolean;
}

export interface SheetDef {
  /** Relative to packages/art/out, and to public/assets/art in the game. */
  readonly file: string;
  readonly kind: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  readonly animations: Readonly<Record<string, AnimDef>>;
  /** Battle sheets: which way the creature faces, and the row its feet stand on. */
  readonly facing?: string;
  readonly baseline?: number;
  /** The tileset: tile kind to frames, and the overlays drawn over tiles. */
  readonly tiles?: Readonly<Record<string, readonly number[]>>;
  readonly overlays?: Readonly<Record<string, readonly number[]>>;
  /** Character sheets: the row the feet stand on. */
  readonly footY?: number;
}

export interface ArtManifest {
  readonly version: number;
  readonly palette: string;
  readonly note: string;
  readonly sheets: Readonly<Record<string, SheetDef>>;
}

export const ART: ArtManifest = manifest;

function sheet(id: string): SheetDef {
  const s = ART.sheets[id];
  if (!s) throw new Error(`art: no sheet ${id}`);
  return s;
}

function anim(id: string, name: string): AnimDef {
  const a = sheet(id).animations[name];
  if (!a) throw new Error(`art: no animation ${name} on ${id}`);
  return a;
}

/** The Phaser texture key of a sheet. */
export const sheetKey = (id: string): string => `art.${id}`;
/** The Phaser animation key of one of a sheet's animations. */
export const animKey = (id: string, name: string): string => `art.${id}.${name}`;
/** Where the game loads a sheet's file from, relative to the page (see asset-url.ts). */
export const artFile = (file: string): string => `assets/art/${file}`;

// ------------------------------------------------------------------ the overworld tileset

export const TILESET_ID = 'tiles';

/** The tileset frame of a tile kind; `frame` steps through an animated tile's frames. */
export function tileFrame(kind: TileKind, frame = 0): number {
  const frames = sheet(TILESET_ID).tiles?.[kind];
  const f = frames?.[frame % frames.length];
  if (f === undefined) throw new Error(`art: no tile ${kind}`);
  return f;
}

/** The wild patch's sway. */
export const patchAnim: AnimDef = anim(TILESET_ID, 'patch');
/** The wild model's eyes peeking out of the patch: open, then a blink. */
export const lurkFrames: readonly number[] = sheet(TILESET_ID).overlays?.['lurk'] ?? [];

// ------------------------------------------------------------------ overworld people

export const CHARACTER_IDS = ['player', 'kip', 'professor', 'grad', 'farmer'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

/** Who is drawn with which sheet, by the id the maps give them (the player is `player`). */
const CHARACTER_OF: Readonly<Record<string, CharacterId>> = {
  player: 'player',
  kip: 'kip',
  professor: 'professor',
  farmer: 'farmer',
  'bootcamp-grad': 'grad',
};

export function characterFor(id: string): CharacterId {
  const c = CHARACTER_OF[id];
  if (!c) throw new Error(`art: no character sheet for ${id}`);
  return c;
}

export const characterSheet = (c: CharacterId): string => `characters/${c}`;
/** The animation name of standing or walking in a facing. */
export const characterAnim = (kind: 'idle' | 'walk', dir: Dir): string => `${kind}-${dir}`;
/** The standing frame of a facing. */
export const idleFrame = (c: CharacterId, dir: Dir): number => anim(characterSheet(c), characterAnim('idle', dir)).frames[0] ?? 0;

/** Figures stand with their feet this far above their tile's bottom edge, inside the tile and off the seam. */
export const FEET_ABOVE_TILE = 4;

/** A character frame's size, and the row its feet stand on. */
export function characterFrame(c: CharacterId): { width: number; height: number; footY: number } {
  const s = sheet(characterSheet(c));
  return { width: s.frameWidth, height: s.frameHeight, footY: s.footY ?? s.frameHeight - 1 };
}

// ------------------------------------------------------------------ battle creatures

export interface BattleSheet {
  readonly id: string;
  readonly frameSize: number;
  readonly facing: string;
  /** The row the creature's feet stand on. */
  readonly baseline: number;
  readonly idle: AnimDef;
}

/** Every species that has a battle sheet. */
export const BATTLE_SPECIES: readonly string[] = Object.keys(ART.sheets)
  .filter((id) => id.startsWith('battle/'))
  .map((id) => id.slice('battle/'.length));

/** A species' battle sheet, or null if the art pass has not drawn it (the game draws a placeholder). */
export function battleSheet(species: string): BattleSheet | null {
  const id = `battle/${species}`;
  const s = ART.sheets[id];
  if (!s) return null;
  return { id, frameSize: s.frameWidth, facing: s.facing ?? 'left', baseline: s.baseline ?? s.frameHeight - 1, idle: anim(id, 'idle') };
}
