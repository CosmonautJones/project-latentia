// A vertical pixel-text menu with a ▶ cursor, driven by the action stream (keys, touch band, and taps on items).

import Phaser from 'phaser';
import type { App } from '../app.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { createMenu, menuInput, type MenuState } from './menu.js';
import { COLOR } from './palette.js';

export interface MenuListOptions {
  readonly id: string;
  readonly items: readonly string[];
  readonly x: number;
  readonly y: number;
  /** Width of each item's tap target, in game px. */
  readonly width: number;
  /** Row pitch in game px; also the tap target height (16 px = 48 CSS px on a 3x phone). */
  readonly rowHeight?: number;
  readonly onConfirm: (index: number) => void;
  readonly onCancel?: () => void;
  /** Display depth, for a menu drawn over a scene (default 0). */
  readonly depth?: number;
}

const CURSOR_GAP = 10;

export class MenuList {
  private state: MenuState;
  private readonly labels: Phaser.GameObjects.BitmapText[];
  private readonly cursor: Phaser.GameObjects.BitmapText;
  private readonly zones: Phaser.GameObjects.Zone[];
  private readonly rowHeight: number;
  private active = true;
  private readonly off: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
    private readonly opts: MenuListOptions,
  ) {
    this.state = createMenu(opts.id, opts.items);
    this.rowHeight = opts.rowHeight ?? 14;
    const textDy = Math.floor((this.rowHeight - CELL_HEIGHT) / 2) + 1;
    // Pinned to the screen (scroll factor 0), so a menu over a scrolled overworld camera stays where it is drawn.
    const depth = opts.depth ?? 0;
    this.labels = opts.items.map((item, i) =>
      addPixelText(scene, opts.x + CURSOR_GAP, opts.y + i * this.rowHeight + textDy, item).setScrollFactor(0).setDepth(depth),
    );
    this.cursor = addPixelText(scene, opts.x, opts.y + textDy, '▶', { color: COLOR.amber }).setScrollFactor(0).setDepth(depth);
    this.zones = opts.items.map((_, i) => {
      const z = scene.add.zone(opts.x - 4, opts.y + i * this.rowHeight, opts.width + 8, this.rowHeight).setOrigin(0).setScrollFactor(0).setDepth(depth);
      z.setInteractive({ useHandCursor: true });
      z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (this.active) app.input.pick(opts.id, i);
      });
      return z;
    });
    this.off = app.input.subscribe((a) => {
      if (!this.active) return;
      const r = menuInput(this.state, a);
      this.state = r.menu;
      this.render();
      if (r.confirm !== undefined) opts.onConfirm(r.confirm);
      else if (r.cancel) opts.onCancel?.();
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.off());
    this.render();
  }

  /** Show and take input, or hide and ignore it. */
  setActive(active: boolean): this {
    this.active = active;
    this.render();
    return this;
  }

  destroy(): void {
    this.off();
    if (this.app.probe.menu?.id === this.state.id) this.app.probe.menu = null;
    for (const o of [...this.labels, ...this.zones, this.cursor]) o.destroy();
  }

  private render(): void {
    const textDy = Math.floor((this.rowHeight - CELL_HEIGHT) / 2) + 1;
    this.labels.forEach((l, i) => {
      l.setVisible(this.active);
      l.setTint(i === this.state.index ? COLOR.white : COLOR.mist);
    });
    for (const z of this.zones) if (z.input) z.input.enabled = this.active;
    this.cursor.setVisible(this.active);
    this.cursor.setPosition(this.opts.x, this.opts.y + this.state.index * this.rowHeight + textDy);
    if (this.active) this.app.probe.menu = this.state;
    else if (this.app.probe.menu?.id === this.state.id) this.app.probe.menu = null;
  }
}
