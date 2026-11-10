// The one dialogue box all story text goes through: a typewriter over the pixel font in a 320x42 panel at the
// bottom of the screen (design bible: 3 lines of at most 36 characters). A advances; holding A or B speeds up.

import Phaser from 'phaser';
import type { App } from '../app.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { COLOR } from './palette.js';
import { advance, createTypewriter, isPageComplete, tick, visibleText, type TypewriterState } from './typewriter.js';

export const DIALOGUE_MAX_CHARS = 36;
export const DIALOGUE_MAX_LINES = 3;
const CHARS_PER_SECOND = 40;
const BOX_HEIGHT = 42;
const BLINK_MS = 400;

export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly more: Phaser.GameObjects.BitmapText;
  private state: TypewriterState | null = null;
  private resolve: (() => void) | null = null;
  private blinkMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
  ) {
    const y = GAME_HEIGHT - BOX_HEIGHT;
    const g = scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(0, y, GAME_WIDTH, BOX_HEIGHT);
    g.fillStyle(COLOR.ink).fillRect(1, y + 1, GAME_WIDTH - 2, BOX_HEIGHT - 2);
    g.fillStyle(COLOR.slate).fillRect(2, y + 2, GAME_WIDTH - 4, 1);
    this.text = addPixelText(scene, 8, y + 6, '');
    this.more = addPixelText(scene, GAME_WIDTH - 12, y + BOX_HEIGHT - CELL_HEIGHT - 1, '▼', { color: COLOR.amber });
    this.container = scene.add.container(0, 0, [g, this.text, this.more]).setVisible(false).setDepth(100);

    const off = app.input.subscribe((a) => {
      if (this.state && a.kind === 'press' && a.button === 'a') this.onA();
    });
    const onUpdate = (_time: number, delta: number) => this.update(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
  }

  get isOpen(): boolean {
    return this.state !== null;
  }

  /** Type `text` out; resolves once the player has read the last page and pressed A. */
  say(text: string): Promise<void> {
    this.state = createTypewriter(text, { maxChars: DIALOGUE_MAX_CHARS, maxLines: DIALOGUE_MAX_LINES, charsPerSecond: CHARS_PER_SECOND });
    this.container.setVisible(true);
    this.render();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private onA(): void {
    if (!this.state) return;
    this.state = advance(this.state);
    if (this.state.closed) {
      this.state = null;
      this.container.setVisible(false);
      const done = this.resolve;
      this.resolve = null;
      done?.();
      return;
    }
    this.render();
  }

  private update(deltaMs: number): void {
    if (!this.state) return;
    const fast = this.app.input.isHeld('a') || this.app.input.isHeld('b');
    this.state = tick(this.state, deltaMs, fast);
    this.blinkMs = (this.blinkMs + deltaMs) % (BLINK_MS * 2);
    this.render();
  }

  private render(): void {
    if (!this.state) return;
    this.text.setText(visibleText(this.state));
    this.more.setVisible(isPageComplete(this.state) && this.blinkMs < BLINK_MS);
  }
}
