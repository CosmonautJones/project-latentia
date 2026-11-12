// A framed panel of choices drawn over a scene: an optional title and body text, then rows that each have a label and
// an optional (wrapped) detail under it. Up/down move the ▶ cursor, A or a tap picks, B cancels when the panel allows
// it. Used for the starter pick, the distill choice, the card tutorial, the debrief and its card swap, and the title's
// START OVER? confirm. It sits in the layout's safe area (never under the touch controls); every row is a tap target at
// least the layout's tap size (44 CSS px) tall. When the details of every row do not fit the height, only the cursor's
// row shows its detail. Rebuilt on every change and relayout, keeping the cursor. The menu state goes to the dev hook's
// `menu()` like MenuList's, and the text to `panel()`.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { Layout } from '../layout/viewport.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { createMenu, menuInput, type MenuState } from './menu.js';
import { COLOR } from './palette.js';
import { addTapZone } from './tap-zone.js';

export interface ChoiceItem {
  readonly label: string;
  readonly detail?: string;
}

export interface ChoicePanelOptions {
  readonly id: string;
  readonly title?: string;
  /** Text above the choices (each entry starts a new paragraph). */
  readonly body?: readonly string[];
  readonly items: readonly ChoiceItem[];
  /** The row the cursor opens on (default 0). */
  readonly index?: number;
  /** Where in the safe area: at the top (default) or centred. */
  readonly align?: 'top' | 'centre';
  readonly onConfirm: (index: number) => void;
  /** B: omit for a choice that must be made (B then does nothing). */
  readonly onCancel?: () => void;
  readonly depth?: number;
}

/** What the dev hook sees of the open panel. */
export interface PanelProbe {
  readonly id: string;
  readonly title: string | null;
  readonly body: readonly string[];
  readonly items: readonly ChoiceItem[];
  /** Whether every row's detail is on screen (false: only the cursor's row shows its detail). */
  readonly allDetails: boolean;
}

const MARGIN = 6;
const PAD = 6;
const CURSOR = 10;
const LINE = CELL_HEIGHT;
const ROW_GAP = 2;

interface Row {
  readonly label: readonly string[];
  readonly detail: readonly string[];
}

export class ChoicePanel {
  private state: MenuState;
  private objects: Phaser.GameObjects.GameObject[] = [];
  private allDetails = true;
  private readonly offs: (() => void)[] = [];
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
    private readonly opts: ChoicePanelOptions,
  ) {
    this.state = createMenu(opts.id, opts.items.map((i) => i.label), opts.index ?? 0);
    this.offs.push(
      app.input.subscribe((a) => {
        if (this.closed) return;
        const r = menuInput(this.state, a);
        this.state = r.menu;
        this.render();
        if (r.confirm !== undefined) opts.onConfirm(r.confirm);
        else if (r.cancel) opts.onCancel?.();
      }),
      // Rotating the phone lays the panel out again; the cursor and the choice stay put.
      app.screen.onLayout(() => this.render()),
    );
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.render();
  }

  /** The row the cursor is on. */
  get index(): number {
    return this.state.index;
  }

  destroy(): void {
    if (this.closed) return;
    this.closed = true;
    for (const off of this.offs) off();
    this.clear();
    if (this.app.probe.menu?.id === this.state.id) this.app.probe.menu = null;
    if (this.app.probe.panel?.id === this.opts.id) this.app.probe.panel = null;
  }

  private clear(): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }

  private render(): void {
    if (this.closed) return;
    this.clear();
    this.draw(this.app.screen.layout());
    this.app.probe.menu = this.state;
    this.app.probe.panel = { id: this.opts.id, title: this.opts.title ?? null, body: this.opts.body ?? [], items: this.opts.items, allDetails: this.allDetails };
  }

  private draw(l: Layout): void {
    const { scene, opts } = this;
    const depth = opts.depth ?? 90;
    const x = l.safe.x + MARGIN;
    const width = l.safe.width - 2 * MARGIN;
    const chars = Math.floor((width - 2 * PAD - CURSOR) / CELL_WIDTH);
    const head = [...(opts.title ? [opts.title] : []), ...(opts.body ?? []).flatMap((p) => wrapText(p, chars + 1))];
    const headHeight = head.length * LINE + (opts.title ? 2 : 0) + (head.length > 0 ? 4 : 0);
    const rows: Row[] = opts.items.map((item) => ({ label: wrapText(item.label, chars), detail: item.detail ? wrapText(item.detail, chars - 1) : [] }));
    const rowHeight = (r: Row, withDetail: boolean) => Math.max(l.tap, (r.label.length + (withDetail ? r.detail.length : 0)) * LINE + 4);
    const total = (all: boolean) => rows.reduce((h, r, i) => h + rowHeight(r, all || i === this.state.index) + ROW_GAP, 0);
    const room = l.safe.height - 2 * MARGIN - 2 * PAD - headHeight + ROW_GAP;
    this.allDetails = total(true) <= room;
    const height = 2 * PAD + headHeight + total(this.allDetails) - ROW_GAP;
    const top = opts.align === 'centre' ? l.safe.y + Math.max(MARGIN, Math.floor((l.safe.height - height) / 2)) : l.safe.y + MARGIN;

    const pin = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, d: number): T => {
      o.setScrollFactor(0).setDepth(d);
      this.objects.push(o);
      return o;
    };
    const text = (tx: number, ty: number, s: string, color: number) => pin(addPixelText(scene, tx, ty, s, { color }), depth + 1);
    const frame = pin(scene.add.graphics(), depth);
    frame.fillStyle(COLOR.cloud).fillRect(x, top, width, height);
    frame.fillStyle(COLOR.ink).fillRect(x + 1, top + 1, width - 2, height - 2);

    const left = x + PAD;
    let y = top + PAD;
    head.forEach((line, i) => {
      text(left, y, line, i === 0 && opts.title ? COLOR.amber : COLOR.cloud);
      y += LINE + (i === 0 && opts.title ? 2 : 0);
    });
    if (head.length > 0) y += 4;
    const buttons = l.controls === 'overlay';
    rows.forEach((r, i) => {
      const on = i === this.state.index;
      const withDetail = this.allDetails || on;
      const h = rowHeight(r, withDetail);
      const lines = r.label.length + (withDetail ? r.detail.length : 0);
      let ty = y + Math.floor((h - lines * LINE) / 2) + 1;
      if (buttons) frame.fillStyle(on ? COLOR.amber : COLOR.slate).fillRect(x + 3, y, width - 6, h).fillStyle(COLOR.ink).fillRect(x + 4, y + 1, width - 8, h - 2);
      if (on) text(left, ty, '▶', COLOR.amber);
      for (const line of r.label) {
        text(left + CURSOR, ty, line, on ? COLOR.white : COLOR.mist);
        ty += LINE;
      }
      if (withDetail) {
        for (const line of r.detail) {
          text(left + CURSOR + 6, ty, line, COLOR.steel);
          ty += LINE;
        }
      }
      this.objects.push(addTapZone(scene, this.app, { x: x + 3, y, width: width - 6, height: h }, opts.id, i, { depth: depth + 2 }));
      y += h + ROW_GAP;
    });
  }
}
