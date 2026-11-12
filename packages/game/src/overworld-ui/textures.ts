// Turns the generated overworld pixels (tile-art, figure-art) into Phaser canvas textures, once per game: 24 px tiles
// and 24x32 figure frames.

import Phaser from 'phaser';
import { FIGURE_FRAME_W, FIGURE_FRAMES, FIGURE_H, figureSheetFrame } from '../overworld/figure-art.js';
import { DIRS } from '../overworld/direction.js';
import type { LookId } from '../overworld/map.js';
import { lurkTile, TILE, TILESET, worldTile } from '../overworld/tile-art.js';

export const TILESET_KEY = 'ow.tiles';
export const LURK_KEY = 'ow.lurk';
export const figureKey = (look: LookId): string => `ow.figure.${look}`;

/** Paint row-major palette pixels (null = transparent) into a canvas at (ox, oy). */
function paint(ctx: CanvasRenderingContext2D, px: readonly (number | null)[], w: number, h: number, ox: number, oy: number): void {
  const img = ctx.createImageData(w, h);
  px.forEach((c, i) => {
    if (c === null) return;
    img.data[i * 4] = (c >> 16) & 255;
    img.data[i * 4 + 1] = (c >> 8) & 255;
    img.data[i * 4 + 2] = c & 255;
    img.data[i * 4 + 3] = 255;
  });
  ctx.putImageData(img, ox, oy);
}

/** A canvas texture of `frames` equal frames in a row, painted by `pixels(i)`. */
function sheet(scene: Phaser.Scene, key: string, frames: number, w: number, h: number, pixels: (i: number) => readonly (number | null)[]): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w * frames, h);
  if (!tex) throw new Error(`could not create ${key}`);
  const ctx = tex.getContext();
  for (let i = 0; i < frames; i++) {
    paint(ctx, pixels(i), w, h, i * w, 0);
    tex.add(i, 0, i * w, 0, w, h);
  }
  tex.refresh();
}

export function ensureOverworldTextures(scene: Phaser.Scene, looks: readonly LookId[]): void {
  sheet(scene, TILESET_KEY, TILESET.length, TILE, TILE, (i) => {
    const f = TILESET[i];
    if (!f) throw new Error(`no tileset frame ${i}`);
    return worldTile(f.kind, f.frame);
  });
  sheet(scene, LURK_KEY, 2, TILE, TILE, (i) => lurkTile(i));
  for (const look of looks) {
    sheet(scene, figureKey(look), FIGURE_FRAMES, FIGURE_FRAME_W, FIGURE_H, (i) => figureSheetFrame(look, DIRS[Math.floor(i / 2)] ?? 'down', i % 2 === 0 ? 0 : 1));
  }
}
