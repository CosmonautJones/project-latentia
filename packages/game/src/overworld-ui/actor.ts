// A person on the overworld: a 24x32 character sprite (art/sheets.ts, picked by the id the maps give them) standing in
// a 24 px tile with its feet 4 px above the tile's bottom edge, depth-sorted by its feet. It stands in its facing's
// idle frame, or plays that facing's walk while moving. The player is moved by the scene's walker; NPCs stand still,
// and a trainer can show a "!" and walk a scripted path up to the player.

import type Phaser from 'phaser';
import { animKey, characterAnim, characterFor, characterFrame, characterSheet, FEET_ABOVE_TILE, idleFrame, sheetKey, type CharacterId } from '../art/sheets.js';
import type { Dir } from '../overworld/direction.js';
import type { Pos } from '../overworld/map.js';
import { TILE } from '../overworld/tile.js';
import { STEP_MS } from '../overworld/walker.js';
import { addPixelText } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';

/** The bible's trainer "!" beat: 0.6 s. */
export const ALERT_MS = 600;
const BUBBLE_DEPTH = 60;

/** Figures sort among themselves by their feet, above the ground and the lurker, below bubbles and the dialogue box. */
const depthFor = (feetY: number): number => 10 + feetY / 1000;
export class Actor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly character: CharacterId;
  /** The frame's top-left from the tile's top-left: centred across, the feet FEET_ABOVE_TILE px above its bottom. */
  private readonly offset: Pos;
  private facing: Dir;

  /** `id`: the player's `player`, or an NPC's id on the map. */
  constructor(
    private readonly scene: Phaser.Scene,
    id: string,
    at: Pos & { readonly facing: Dir },
  ) {
    this.character = characterFor(id);
    const f = characterFrame(this.character);
    this.offset = { x: Math.floor((TILE - f.width) / 2), y: TILE - FEET_ABOVE_TILE - (f.footY + 1) };
    this.facing = at.facing;
    this.sprite = scene.add.sprite(0, 0, sheetKey(characterSheet(this.character)), idleFrame(this.character, at.facing)).setOrigin(0, 0);
    this.place({ x: at.x * TILE, y: at.y * TILE }, at.facing, false);
  }

  /** Stand (or walk) in the tile whose top-left pixel is `px`. */
  place(px: Pos, facing: Dir, walking: boolean): void {
    this.facing = facing;
    this.sprite.setPosition(px.x + this.offset.x, px.y + this.offset.y).setDepth(depthFor(px.y + TILE));
    if (walking) {
      // The same walk keeps playing from tile to tile; a new facing starts its own.
      this.sprite.play(animKey(characterSheet(this.character), characterAnim('walk', facing)), true);
    } else {
      if (this.sprite.anims.isPlaying) this.sprite.stop();
      this.sprite.setFrame(idleFrame(this.character, facing));
    }
  }

  /** Show a "!" over the head for ALERT_MS. */
  alert(): Promise<void> {
    const { x, y } = this.sprite;
    const g = this.scene.add.graphics().setDepth(BUBBLE_DEPTH);
    const cx = x + this.sprite.width / 2;
    // Just over the head (the art's hair reaches the frame's top rows).
    const top = y - 12;
    g.fillStyle(COLOR.ink).fillRect(cx - 4, top, 9, 12);
    g.fillStyle(COLOR.white).fillRect(cx - 3, top + 1, 7, 10);
    const mark = addPixelText(this.scene, cx - 2, top + 2, '!', { color: COLOR.red }).setDepth(BUBBLE_DEPTH + 1);
    return new Promise((resolve) => {
      this.scene.time.delayedCall(ALERT_MS, () => {
        g.destroy();
        mark.destroy();
        resolve();
      });
    });
  }

  /** Walk tile by tile along `path` (pixel-tweened at the player's pace, walking). */
  async walk(path: readonly Pos[]): Promise<void> {
    for (const tile of path) {
      const from = { x: this.sprite.x - this.offset.x, y: this.sprite.y - this.offset.y };
      const to = { x: tile.x * TILE, y: tile.y * TILE };
      await new Promise<void>((resolve) => {
        const p = { t: 0 };
        this.scene.tweens.add({
          targets: p,
          t: 1,
          duration: STEP_MS,
          onUpdate: () => {
            const px = { x: Math.round(from.x + (to.x - from.x) * p.t), y: Math.round(from.y + (to.y - from.y) * p.t) };
            this.place(px, this.facing, true);
          },
          onComplete: () => {
            this.place(to, this.facing, true);
            resolve();
          },
        });
      });
    }
    this.place({ x: this.sprite.x - this.offset.x, y: this.sprite.y - this.offset.y }, this.facing, false);
  }

  /** The tile the actor stands on now. */
  get tile(): Pos {
    return { x: Math.round((this.sprite.x - this.offset.x) / TILE), y: Math.round((this.sprite.y - this.offset.y) / TILE) };
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
