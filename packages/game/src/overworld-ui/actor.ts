// A person on the overworld: a 16x32 figure sprite standing on a tile (it rises one tile above it), depth-sorted by
// its feet. The player is moved by the scene's walker; NPCs stand still, and a trainer can show a "!" and walk a
// scripted path up to the player.

import Phaser from 'phaser';
import { figureFrameIndex } from '../overworld/figure-art.js';
import type { Dir } from '../overworld/direction.js';
import type { LookId, Pos } from '../overworld/map.js';
import { TILE } from '../overworld/tile-art.js';
import { STEP_MS } from '../overworld/walker.js';
import { addPixelText } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';
import { figureKey } from './textures.js';

/** The bible's trainer "!" beat: 0.6 s. */
export const ALERT_MS = 600;
const BUBBLE_DEPTH = 60;

/** Figures sort among themselves by their feet, above the ground and the lurker, below bubbles and the dialogue box. */
const depthFor = (feetY: number): number => 10 + feetY / 1000;

export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private facing: Dir;

  constructor(
    private readonly scene: Phaser.Scene,
    look: LookId,
    at: Pos & { readonly facing: Dir },
  ) {
    this.facing = at.facing;
    this.sprite = scene.add.sprite(0, 0, figureKey(look), 0).setOrigin(0, 0);
    this.place({ x: at.x * TILE, y: at.y * TILE }, at.facing, 0);
  }

  /** Stand with the feet on the tile whose top-left pixel is `px`. */
  place(px: Pos, facing: Dir, frame: 0 | 1): void {
    this.facing = facing;
    this.sprite.setPosition(px.x, px.y - TILE).setFrame(figureFrameIndex(facing, frame)).setDepth(depthFor(px.y + TILE));
  }

  /** Show a "!" over the head for ALERT_MS. */
  alert(): Promise<void> {
    const { x, y } = this.sprite;
    const g = this.scene.add.graphics().setDepth(BUBBLE_DEPTH);
    g.fillStyle(COLOR.ink).fillRect(x + 4, y - 2, 9, 12);
    g.fillStyle(COLOR.white).fillRect(x + 5, y - 1, 7, 10);
    const mark = addPixelText(this.scene, x + 6, y, '!', { color: COLOR.red }).setDepth(BUBBLE_DEPTH + 1);
    return new Promise((resolve) => {
      this.scene.time.delayedCall(ALERT_MS, () => {
        g.destroy();
        mark.destroy();
        resolve();
      });
    });
  }

  /** Walk tile by tile along `path` (pixel-tweened at the player's pace, with the walk bob). */
  async walk(path: readonly Pos[]): Promise<void> {
    for (const tile of path) {
      const from = { x: this.sprite.x, y: this.sprite.y + TILE };
      const to = { x: tile.x * TILE, y: tile.y * TILE };
      await new Promise<void>((resolve) => {
        const p = { t: 0 };
        this.scene.tweens.add({
          targets: p,
          t: 1,
          duration: STEP_MS,
          onUpdate: () => {
            const px = { x: Math.round(from.x + (to.x - from.x) * p.t), y: Math.round(from.y + (to.y - from.y) * p.t) };
            this.place(px, this.facing, p.t < 0.5 ? 1 : 0);
          },
          onComplete: () => {
            this.place(to, this.facing, 0);
            resolve();
          },
        });
      });
    }
  }

  /** The tile the actor stands on now. */
  get tile(): Pos {
    return { x: Math.round(this.sprite.x / TILE), y: Math.round((this.sprite.y + TILE) / TILE) };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
