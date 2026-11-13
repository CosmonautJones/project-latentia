import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ART,
  artFile,
  BATTLE_SPECIES,
  battleSheet,
  CHARACTER_IDS,
  characterAnim,
  characterFor,
  FEET_ABOVE_TILE,
  lurkFrames,
  patchAnim,
  sheetKey,
  tileFrame,
} from '../../src/art/sheets.js';
import { LOCALHOST } from '../../src/content/maps/localhost.js';
import { allNpcs } from '../../src/overworld/rules.js';
import { DIRS } from '../../src/overworld/direction.js';
import { LEGEND } from '../../src/overworld/map.js';
import { TILE } from '../../src/overworld/tile.js';

const GAME = join(import.meta.dirname, '../..');
const ART_OUT = join(GAME, '../art/out');
const PUBLIC = join(GAME, 'public');

/** A PNG's width and height, from its IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('ascii'), file).toBe('PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

const sheetIds = Object.keys(ART.sheets);

describe('the copied art (pnpm --filter @latentia/game sync-art)', () => {
  it('the manifest is the art package output, as is', () => {
    expect(ART).toEqual(JSON.parse(readFileSync(join(ART_OUT, 'manifest.json'), 'utf8')));
  });

  it('every sheet in the manifest is copied byte for byte, and nothing else is', () => {
    const copied = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? copied(join(dir, e.name)).map((f) => `${e.name}/${f}`) : [e.name]));
    const files = Object.values(ART.sheets).map((s) => s.file);
    expect(copied(join(PUBLIC, 'assets/art')).sort()).toEqual([...files].sort());
    for (const f of files) expect(readFileSync(join(PUBLIC, artFile(f))).equals(readFileSync(join(ART_OUT, f))), f).toBe(true);
  });

  it('every sheet image is frameCount frames in one row of the manifest frame size', () => {
    for (const id of sheetIds) {
      const s = ART.sheets[id];
      if (!s) throw new Error(id);
      expect(pngSize(join(PUBLIC, artFile(s.file))), id).toEqual({ width: s.frameWidth * s.frameCount, height: s.frameHeight });
      for (const a of Object.values(s.animations)) for (const f of a.frames) expect(f >= 0 && f < s.frameCount, `${id} frame ${f}`).toBe(true);
    }
  });
});

describe('the frames the game uses', () => {
  const tiles = ART.sheets['tiles'];
  if (!tiles) throw new Error('no tiles sheet');

  it('every tile kind of the legend has a 24 px frame on the tileset; the patch sways over 2', () => {
    expect(tiles.frameWidth).toBe(TILE);
    for (const kind of Object.values(LEGEND)) {
      const f = tileFrame(kind, 0);
      expect(f >= 0 && f < tiles.frameCount, kind).toBe(true);
    }
    expect(patchAnim.frames).toHaveLength(2);
    expect(patchAnim.frames.map((_, i) => tileFrame('patch', i))).toEqual(patchAnim.frames);
    expect(patchAnim.frameMs).toBeGreaterThan(0);
  });

  it('the lurker eyes are overlay frames after the tiles: open, then a blink', () => {
    expect(lurkFrames).toHaveLength(2);
    const used = new Set(Object.values(LEGEND).flatMap((k) => [0, 1].map((i) => tileFrame(k, i))));
    for (const f of lurkFrames) {
      expect(f >= 0 && f < tiles.frameCount).toBe(true);
      expect(used.has(f)).toBe(false);
    }
  });

  it('the player and every NPC on the maps (by id) have a 24x32 sheet with an idle and a walk per facing', () => {
    const ids = ['player', ...allNpcs(LOCALHOST).map((n) => n.id)];
    expect(ids).toEqual(expect.arrayContaining(['player', 'professor', 'kip', 'farmer', 'bootcamp-grad']));
    for (const id of ids) {
      const c = characterFor(id);
      expect(CHARACTER_IDS).toContain(c);
      const s = ART.sheets[sheetKey(`characters/${c}`).slice('art.'.length)];
      expect(s, id).toMatchObject({ frameWidth: 24, frameHeight: 32 });
      for (const d of DIRS) for (const kind of ['idle', 'walk'] as const) expect(s?.animations[characterAnim(kind, d)], `${id} ${kind}-${d}`).toBeDefined();
    }
    // The walk is 4 steps (through the standing frame) at 130 ms.
    expect(ART.sheets['characters/player']?.animations['walk-down']).toMatchObject({ frameMs: 130, loop: true });
    expect(ART.sheets['characters/player']?.animations['walk-down']?.frames).toHaveLength(4);
  });

  it('figures stand with their feet 4 px above the tile bottom edge', () => {
    expect(FEET_ABOVE_TILE).toBe(4);
    expect(ART.sheets['characters/player']).toMatchObject({ footY: 31 });
  });

  it('every species a v0.1 fight or scene shows has a 96 px battle sheet facing left with an idle loop', () => {
    expect([...BATTLE_SPECIES].sort()).toEqual(['blitzr', 'forkling', 'sagelet', 'tokenibble', 'vibrat']);
    for (const sp of BATTLE_SPECIES) {
      const b = battleSheet(sp);
      expect(b, sp).not.toBeNull();
      expect(b).toMatchObject({ frameSize: 96, facing: 'left' });
      expect(b?.idle.frames.length).toBeGreaterThan(1);
      expect(b?.baseline).toBeLessThan(96);
    }
    expect(battleSheet('stochastiparrot')).toBeNull();
  });
});
