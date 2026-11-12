// A vertical pixel-text menu with a ▶ cursor, drawn in the game image and driven by the action stream (keys, the
// touch D-pad, and taps on items). Each row is at least the layout's tap size (44 CSS px) tall; on a touch screen it is
// drawn as a framed button. Where it sits comes from `place`, asked again on every relayout.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { Layout } from '../layout/viewport.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { createMenu, menuInput, type MenuState } from './menu.js';
import { COLOR } from './palette.js';
import { addTapZone } from './tap-zone.js';

export interface MenuPlace {
  /** Left edge of the rows (the cursor sits inside it), logical px. */
  readonly x: number;
  /** Top of the first row; with `bottom`, the bottom of the last row instead. */
  readonly y: number;
  readonly bottom?: boolean;
  /** Width of each row (its tap target), logical px. */
  readonly width: number;
}

export interface MenuListOptions {
  readonly id: string;
  readonly items: readonly string[];
  /** Where the menu goes in a layout; `pitch` is the row pitch it will use there. */
  readonly place: (layout: Layout, pitch: number) => MenuPlace;
  /** The least row pitch in logical px (default 14); the layout's tap size wins when it is larger. */
  readonly rowHeight?: number;
  readonly onConfirm: (index: number) => void;
  readonly onCancel?: () => void;
  /** Display depth, for a menu drawn over a scene (default 0). */
  readonly depth?: number;
}

const CURSOR_GAP = 10;

/** The row pitch a menu uses in a layout. */
export const menuPitch = (l: Layout, rowHeight = 14): number => Math.max(rowHeight, l.tap);

export class MenuList {
  private state: MenuState;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private active = true;
  private destroyed = false;
  private readonly offs: (() => void)[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
    private readonly opts: MenuListOptions,
  ) {
    this.state = createMenu(opts.id, opts.items);
    this.offs.push(
      app.input.subscribe((a) => {
        if (!this.active) return;
        const r = menuInput(this.state, a);
        this.state = r.menu;
        this.render();
        if (r.confirm !== undefined) opts.onConfirm(r.confirm);
        else if (r.cancel) opts.onCancel?.();
      }),
      app.screen.onLayout(() => this.render()),
    );
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.render();
  }

  /** Show and take input, or hide and ignore it. */
  setActive(active: boolean): this {
    this.active = active;
    this.render();
    return this;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const off of this.offs) off();
    this.clear();
    if (this.app.probe.menu?.id === this.state.id) this.app.probe.menu = null;
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.labels = [];
  }

  /** Rebuilt on every change: a handful of objects. */
  private render(): void {
    if (this.destroyed) return;
    this.clear();
    if (this.active) this.app.probe.menu = this.state;
    else if (this.app.probe.menu?.id === this.state.id) this.app.probe.menu = null;
    if (!this.active) return;
    const { scene, opts } = this;
    const l = this.app.screen.layout();
    const pitch = menuPitch(l, opts.rowHeight);
    const p = opts.place(l, pitch);
    const top = p.bottom ? p.y - pitch * opts.items.length : p.y;
    const depth = opts.depth ?? 0;
    const textDy = Math.floor((pitch - CELL_HEIGHT) / 2) + 1;
    const buttons = l.controls === 'overlay';
    // Pinned to the screen (scroll factor 0), so a menu over a scrolled overworld camera stays where it is drawn.
    const add = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T): T => {
      o.setScrollFactor(0).setDepth(depth);
      this.objects.push(o);
      return o;
    };
    opts.items.forEach((item, i) => {
      const y = top + i * pitch;
      const on = i === this.state.index;
      if (buttons) {
        const g = add(scene.add.graphics());
        g.fillStyle(on ? COLOR.amber : COLOR.slate).fillRect(p.x - 4, y + 1, p.width + 8, pitch - 2);
        g.fillStyle(COLOR.ink).fillRect(p.x - 3, y + 2, p.width + 6, pitch - 4);
      }
      this.labels.push(add(addPixelText(scene, p.x + CURSOR_GAP, y + textDy, item, { color: on ? COLOR.white : COLOR.mist })));
      this.objects.push(addTapZone(scene, this.app, { x: p.x - 4, y, width: p.width + 8, height: pitch }, opts.id, i, { depth }));
    });
    add(addPixelText(scene, p.x, top + this.state.index * pitch + textDy, '▶', { color: COLOR.amber }));
  }
}
