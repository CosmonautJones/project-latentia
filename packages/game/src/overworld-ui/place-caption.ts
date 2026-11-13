// The place-name caption, GBA style: entering a map (or walking into a named stretch of it) slides a small sign with
// the place's name down from the top-left corner of the safe area, holds it about 2 s, and slides it back up. Pinned
// to the camera, over the map and under the dialogue box; laid out again on a relayout.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { Layout } from '../layout/viewport.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';

/** How long the name stays up, ms (the slides come on top). */
export const CAPTION_HOLD_MS = 2000;
const SLIDE_MS = 180;
// Over the map and the people, under a choice panel (90) and the dialogue box (100).
const DEPTH = 85;
const PAD = 5;
const MARGIN = 4;

export class PlaceCaption {
  private readonly box: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private shown: string | null = null;
  /** The sign's y while it is held. */
  private restY = MARGIN;
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    app: App,
  ) {
    this.frame = scene.add.graphics();
    this.label = addPixelText(scene, PAD, PAD, '', { color: COLOR.cream });
    this.box = scene.add.container(0, 0, [this.frame, this.label]).setDepth(DEPTH).setScrollFactor(0).setVisible(false);
    const off = app.screen.onLayout((l) => this.place(l));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.stop();
    });
    this.place(app.screen.layout());
  }

  /** The name on screen now (for the dev probe), or null. */
  get text(): string | null {
    return this.shown;
  }

  /** Show `name`, replacing whatever is up. */
  show(name: string): void {
    this.stop();
    this.shown = name;
    this.label.setText(name);
    const width = textWidth(name) + 2 * PAD;
    const height = CELL_HEIGHT + 2 * PAD - 2;
    this.frame.clear();
    this.frame.fillStyle(COLOR.cloud).fillRect(0, 0, width, height);
    this.frame.fillStyle(COLOR.ink).fillRect(1, 1, width - 2, height - 2);
    this.frame.fillStyle(COLOR.amber).fillRect(2, height - 3, width - 4, 1);
    this.box.setVisible(true).setY(this.restY - height - MARGIN);
    const slideIn = this.scene.tweens.add({ targets: this.box, y: this.restY, duration: SLIDE_MS, ease: 'Quad.easeOut' });
    const slideOut = this.scene.tweens.add({
      targets: this.box,
      y: this.restY - height - MARGIN,
      delay: SLIDE_MS + CAPTION_HOLD_MS,
      duration: SLIDE_MS,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.box.setVisible(false);
        this.shown = null;
      },
    });
    this.tweens = [slideIn, slideOut];
  }

  private place(l: Layout): void {
    this.restY = l.safe.y + MARGIN;
    this.box.setX(l.safe.x + MARGIN);
    // A rotation while the name is up shows it again in the new corner.
    if (this.shown !== null) this.show(this.shown);
  }

  private stop(): void {
    for (const t of this.tweens) t.remove();
    this.tweens = [];
  }
}
