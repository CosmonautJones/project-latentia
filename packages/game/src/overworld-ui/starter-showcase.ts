// The starters at the lab's pick, in their 96 px battle art with the idle animation: in portrait all three stand in
// a framed strip under the choice panel, the cursor's one animated and the others dimmed; in landscape the cursor's
// one stands in a framed box beside the panel (the panel leaves ASIDE px for it). On the player's side, so mirrored
// (ruling V15). Pinned to the camera, redrawn on each cursor move and relayout through ChoicePanel's onDraw.

import type Phaser from 'phaser';
import { CreatureSprite } from '../battle-ui/creature-sprite.js';
import type { Layout, Rect } from '../layout/viewport.js';
import { COLOR } from '../ui/palette.js';

/** Landscape: logical px the panel leaves free on its right for the box. */
export const ASIDE = 104;
/** A 96 px creature's box: its frame plus room for the frame line and the floor. */
const BOX_HEIGHT = 106;
const DEPTH = 90;
/** The floor under the feet, from the box's bottom. */
const FLOOR = 8;

export class StarterShowcase {
  private objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly starters: readonly string[],
  ) {}

  /** For ChoicePanel's reserveRight. */
  readonly reserve = (l: Layout): number => (l.mode === 'landscape' ? ASIDE : 0);

  /** For ChoicePanel's onDraw. */
  readonly draw = (panel: Rect, index: number, l: Layout): void => {
    this.clear();
    if (l.mode === 'landscape') {
      const box = { x: panel.x + panel.width + 4, y: panel.y, width: ASIDE - 4, height: Math.max(panel.height, BOX_HEIGHT) };
      this.frame(box);
      this.creature(this.starters[index], box.x + Math.floor(box.width / 2), box.y + box.height - FLOOR, true);
      return;
    }
    const box = { x: panel.x, y: panel.y + panel.height + 4, width: panel.width, height: BOX_HEIGHT };
    // No room under the panel (a very short safe area): the panel's text says it all.
    if (box.y + box.height > l.safe.y + l.safe.height) return;
    this.frame(box);
    this.starters.forEach((s, i) => this.creature(s, box.x + Math.floor((box.width * (2 * i + 1)) / (2 * this.starters.length)), box.y + box.height - FLOOR, i === index));
  };

  clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private frame(r: Rect): void {
    const g = this.scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    g.fillStyle(COLOR.cloud).fillRect(r.x, r.y, r.width, r.height);
    g.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
    g.fillStyle(COLOR.night).fillRect(r.x + 1, r.y + r.height - FLOOR - 4, r.width - 2, FLOOR + 3);
    this.objects.push(g);
  }

  private creature(species: string | undefined, x: number, feet: number, on: boolean): void {
    if (!species) return;
    const c = new CreatureSprite(this.scene, x, feet, species, true);
    c.sprite.setScrollFactor(0).setDepth(DEPTH + 1);
    if (!on) {
      c.sprite.anims.pause();
      c.sprite.setAlpha(0.4);
    }
    this.objects.push(c.sprite);
  }
}
