// Turns the code-drawn font sheet into a Phaser texture and RetroFont bitmap font, and adds pixel text.

import Phaser from 'phaser';
import { CELL_HEIGHT, CELL_WIDTH, fontSheet } from './font-sheet.js';
import { sanitize } from './wrap.js';

export const FONT_KEY = 'latentia-5x8';

export function registerPixelFont(scene: Phaser.Scene): void {
  if (scene.cache.bitmapFont.exists(FONT_KEY)) return;
  const sheet = fontSheet();
  const texture = scene.textures.createCanvas(FONT_KEY, sheet.width, sheet.height);
  if (!texture) throw new Error(`could not create the ${FONT_KEY} texture`);
  const ctx = texture.getContext();
  ctx.fillStyle = '#ffffff';
  for (const p of sheet.pixels) ctx.fillRect(p.x, p.y, 1, 1);
  texture.refresh();
  // Parse returns the cache entry ({ data, texture, frame }), whatever its typings say.
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    chars: sheet.chars,
    charsPerRow: sheet.charsPerRow,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  }) as unknown;
  scene.cache.bitmapFont.add(FONT_KEY, entry);
}

export interface PixelTextStyle {
  readonly color?: number;
  /** Integer multiple of the 5x8 glyphs. */
  readonly scale?: number;
}

/** Pixel text at an integer position and scale, so every glyph pixel lands on whole screen pixels. */
export function addPixelText(scene: Phaser.Scene, x: number, y: number, text: string, style: PixelTextStyle = {}): Phaser.GameObjects.BitmapText {
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), FONT_KEY, sanitize(text), CELL_WIDTH * (style.scale ?? 1));
  t.setTint(style.color ?? 0xffffff);
  return t;
}

/** Width in game pixels of a single line of `text` at `scale` (fixed advance; the last column of spacing dropped). */
export const textWidth = (text: string, scale = 1): number => Math.max(0, [...text].length * CELL_WIDTH - 1) * scale;
