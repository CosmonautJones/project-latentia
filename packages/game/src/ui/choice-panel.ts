// A framed panel of choices drawn over a scene: an optional title and body text, then rows that each have a label and
// an optional one-line (wrapped) detail under it. Up/down move the ▶ cursor, A or a tap picks, B cancels when the
// panel allows it. Used for the starter pick, the distill choice, the card tutorial, the debrief and its card swap.
// When the layout puts menus in the band (portrait, touch landscape) the rows are band buttons instead
// (ui/band-choices.ts) and the canvas keeps only the title and body; a rotation rebuilds it, keeping the cursor. The
// menu state goes to the dev hook's `menu()` like MenuList's, and the text to `panel()`.

import Phaser from 'phaser';
import type { App } from '../app.js';
import { GAME_WIDTH } from '../layout/compute.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../text/font-sheet.js';
import { addPixelText } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { BandChoices } from './band-choices.js';
import { createMenu, menuInput, type MenuState } from './menu.js';
import { COLOR } from './palette.js';

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
  /** Top edge in game px (the panel is full width less a margin, and as tall as its content). */
  readonly y?: number;
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
}

const MARGIN = 8;
const PAD = 6;
const CURSOR = 10;
const LINE = CELL_HEIGHT;
const ROW_GAP = 3;

export class ChoicePanel {
  private state: MenuState;
  /** The canvas objects of the current build; rebuilt when the layout moves the rows between canvas and band. */
  private objects: Phaser.GameObjects.GameObject[] = [];
  private labels: Phaser.GameObjects.BitmapText[] = [];
  private rowTops: number[] = [];
  private cursor: Phaser.GameObjects.BitmapText | null = null;
  private band: BandChoices | null = null;
  private rowsOnCanvas: boolean | null = null;
  private readonly offs: (() => void)[] = [];
  private closed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
    private readonly opts: ChoicePanelOptions,
  ) {
    this.state = createMenu(opts.id, opts.items.map((i) => i.label));
    this.build();
    this.offs.push(
      app.input.subscribe((a) => {
        if (this.closed) return;
        const r = menuInput(this.state, a);
        this.state = r.menu;
        this.render();
        if (r.confirm !== undefined) opts.onConfirm(r.confirm);
        else if (r.cancel) opts.onCancel?.();
      }),
      // Rotating the phone moves the rows between the canvas and the band; the cursor and the choice stay put.
      app.screen.onLayout(() => {
        if (this.closed) return;
        this.build();
        this.render();
      }),
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
    this.band?.destroy();
    this.band = null;
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.labels = [];
    this.rowTops = [];
    this.cursor = null;
  }

  /**
   * Draw the panel for the current layout. Canvas menus: the title, the body and every row (label, detail, a tap
   * zone). Band menus: the canvas keeps the title and the body as context, and the rows are band buttons only.
   */
  private build(): void {
    const onCanvas = this.app.screen.layout().menus === 'canvas';
    if (onCanvas === this.rowsOnCanvas) return;
    this.clear();
    this.rowsOnCanvas = onCanvas;
    const { scene, opts } = this;
    const depth = opts.depth ?? 90;
    const width = GAME_WIDTH - 2 * MARGIN;
    const chars = Math.floor((width - 2 * PAD - CURSOR) / CELL_WIDTH);
    const text = (x: number, y: number, s: string, color: number) => {
      const t = addPixelText(scene, x, y, s, { color }).setScrollFactor(0).setDepth(depth + 1);
      this.objects.push(t);
      return t;
    };
    const top = opts.y ?? MARGIN;
    let y = top + PAD;
    const left = MARGIN + PAD;
    if (opts.title) {
      text(left, y, opts.title, COLOR.amber);
      y += LINE + 2;
    }
    for (const para of opts.body ?? []) {
      for (const line of wrapText(para, chars + 1)) {
        text(left, y, line, COLOR.cloud);
        y += LINE;
      }
    }
    if (onCanvas) {
      if ((opts.body ?? []).length > 0) y += 4;
      opts.items.forEach((item, i) => {
        this.rowTops.push(y);
        this.labels.push(text(left + CURSOR, y, item.label, COLOR.mist));
        let rowEnd = y + LINE;
        for (const line of item.detail ? wrapText(item.detail, chars) : []) {
          text(left + CURSOR + 6, rowEnd, line, COLOR.steel);
          rowEnd += LINE;
        }
        const zone = scene.add.zone(MARGIN, y - 1, width, rowEnd - y + 2).setOrigin(0).setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
        zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          if (!this.closed) this.app.input.pick(opts.id, i);
        });
        this.objects.push(zone);
        y = rowEnd + ROW_GAP;
      });
      this.cursor = text(left, 0, '▶', COLOR.amber);
    } else {
      this.band = new BandChoices(this.app.screen.bandPanel, this.app, opts.id, opts.items);
      y += ROW_GAP;
    }
    // Nothing to frame when the band has the rows and there is no title or body.
    if (y - ROW_GAP <= top + PAD) return;
    const frame = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    const height = y - top + PAD - ROW_GAP;
    frame.fillStyle(COLOR.cloud).fillRect(MARGIN, top, width, height);
    frame.fillStyle(COLOR.ink).fillRect(MARGIN + 1, top + 1, width - 2, height - 2);
    this.objects.push(frame);
  }

  private render(): void {
    if (this.closed) return;
    this.labels.forEach((l, i) => l.setTint(i === this.state.index ? COLOR.white : COLOR.mist));
    this.cursor?.setPosition(MARGIN + PAD, this.rowTops[this.state.index] ?? 0);
    this.band?.render(this.state.index);
    this.app.probe.menu = this.state;
    this.app.probe.panel = { id: this.opts.id, title: this.opts.title ?? null, body: this.opts.body ?? [], items: this.opts.items };
  }
}
