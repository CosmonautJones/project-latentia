// The one dialogue box all story text goes through: a typewriter over the pixel font in a 42 px panel along the bottom
// of the layout's safe area, so the touch controls never cover it (design bible: 3 lines of at most 36 characters).
// A finishes a typing page, then advances; holding A or B speeds up. A click or tap anywhere on the screen counts as A.
// A popup opened with `closeOnB` also closes on B (a back path for "why?"). It lays itself out again on a relayout.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { Layout, Rect } from '../layout/viewport.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { COLOR } from './palette.js';
import { advance, createTypewriter, isPageComplete, tick, visibleText, type TypewriterState } from './typewriter.js';

export const DIALOGUE_MAX_CHARS = 36;
export const DIALOGUE_MAX_LINES = 3;
const CHARS_PER_SECOND = 40;
/** The bottom box's height, shared with the battle command box so the two frames line up exactly. */
export const BOX_HEIGHT = 42;
const BLINK_MS = 400;

/** The bottom box's rect for a layout: the full width of the safe area, at its bottom. */
export const boxRect = (l: Layout): Rect => ({ x: l.safe.x, y: l.safe.y + l.safe.height - BOX_HEIGHT, width: l.safe.width, height: BOX_HEIGHT });

/** Draw the box's frame (cloud border, ink fill, a slate rule) into `g`. */
export function drawBoxFrame(g: Phaser.GameObjects.Graphics, r: Rect): void {
  g.fillStyle(COLOR.cloud).fillRect(r.x, r.y, r.width, r.height);
  g.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
  g.fillStyle(COLOR.slate).fillRect(r.x + 2, r.y + 2, r.width - 4, 1);
}

export class DialogueBox {
  private readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.BitmapText;
  private readonly more: Phaser.GameObjects.BitmapText;
  /** A full-screen tap target, on top while the box is open, so a click advances like A (and nothing below sees it). */
  private readonly clickZone: Phaser.GameObjects.Zone;
  private state: TypewriterState | null = null;
  private resolve: (() => void) | null = null;
  private closeOnB = false;
  private blinkMs = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
  ) {
    this.frame = scene.add.graphics();
    this.text = addPixelText(scene, 0, 0, '');
    this.more = addPixelText(scene, 0, 0, '▼', { color: COLOR.amber });
    // Pinned to the screen (scroll factor 0), so it stays put over a scrolling overworld camera.
    this.container = scene.add.container(0, 0, [this.frame, this.text, this.more]).setVisible(false).setDepth(100).setScrollFactor(0);
    this.clickZone = scene.add.zone(0, 0, 1, 1).setOrigin(0).setDepth(101).setScrollFactor(0).setInteractive();
    this.clickZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.state) this.onA();
    });
    this.setZone(false);
    this.layout(app.screen.layout());

    const off = app.input.subscribe((a) => {
      if (!this.state || a.kind !== 'press') return;
      if (a.button === 'a') this.onA();
      else if (a.button === 'b' && this.closeOnB) this.close();
    });
    const offLayout = app.screen.onLayout((l) => this.layout(l));
    const onUpdate = (_time: number, delta: number) => this.update(delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      offLayout();
      scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    });
  }

  /** Type `text` out; resolves once the player has read the last page and pressed A (or B, with `closeOnB`). */
  say(text: string, opts: { readonly closeOnB?: boolean } = {}): Promise<void> {
    this.closeOnB = opts.closeOnB === true;
    this.setZone(true);
    this.state = createTypewriter(text, { maxChars: DIALOGUE_MAX_CHARS, maxLines: DIALOGUE_MAX_LINES, charsPerSecond: CHARS_PER_SECOND });
    this.container.setVisible(true);
    this.render();
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Fit the box to the layout's safe area, and the tap catcher to the whole screen. */
  private layout(l: Layout): void {
    const r = boxRect(l);
    drawBoxFrame(this.frame.clear(), r);
    this.text.setPosition(r.x + 8, r.y + 6);
    this.more.setPosition(r.x + r.width - 12, r.y + BOX_HEIGHT - CELL_HEIGHT - 1);
    this.clickZone.setSize(l.logical.width, l.logical.height);
    if (this.clickZone.input) this.clickZone.input.hitArea.setTo(0, 0, l.logical.width, l.logical.height);
  }

  private onA(): void {
    if (!this.state) return;
    this.state = advance(this.state);
    if (this.state.closed) {
      this.close();
      return;
    }
    this.render();
  }

  private setZone(open: boolean): void {
    if (this.clickZone.input) this.clickZone.input.enabled = open;
  }

  private close(): void {
    this.setZone(false);
    this.state = null;
    this.container.setVisible(false);
    const done = this.resolve;
    this.resolve = null;
    done?.();
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
