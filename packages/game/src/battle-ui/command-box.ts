// The in-image battle text and menus. The bottom box (the DialogueBox's exact frame and place, so a popup over it shows
// one border) carries playback messages, the prompt and the highlighted item's hint. The menus are framed panels of
// tappable buttons right above it, in both orientations: the root commands three to a row, the moves and targets in
// one column in portrait and two or three in landscape (over the field when they need the room), the temperature
// notches in a row, and the round log. Every button is at least the layout's tap size (44 CSS px). Rebuilt from the
// menu state on every change and relayout (a few dozen objects). Q2 redesigns this screen.

import Phaser from 'phaser';
import type { Temperature } from '@latentia/engine';
import { armedHere, menuView, MENU_IDS, moveHint, TEMPERATURE_TIPS, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import type { App } from '../app.js';
import type { Layout, Rect } from '../layout/viewport.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../text/font-sheet.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { boxRect, drawBoxFrame } from '../ui/dialogue-box.js';
import { COLOR } from '../ui/palette.js';
import { addTapZone } from '../ui/tap-zone.js';

export type BoxModel =
  | { readonly kind: 'message'; readonly text: string }
  | {
      readonly kind: 'menu';
      readonly menu: BattleMenuState;
      readonly data: MenuData;
      readonly prompt: string;
      /** A new deck-driven action has happened since "why?" was last opened. */
      readonly whyFresh: boolean;
    };

const typeColor = (type: string): number => (type === 'system' ? COLOR.mist : (TYPE_COLORS[type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist));
const HEADER = 13;
const INSET = 4;

interface Button {
  readonly label: string;
  readonly meta?: { readonly cost: string; readonly ok: boolean; readonly color: number };
  readonly mark?: string | undefined;
}

export class CommandBox {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly layer: Phaser.GameObjects.Container;
  private model: BoxModel = { kind: 'message', text: '' };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
  ) {
    this.frame = scene.add.graphics().setDepth(50);
    this.layer = scene.add.container(0, 0).setDepth(51);
  }

  /** Draw again for the current layout (a rotation), from the last model. */
  relayout(): void {
    this.render(this.model);
  }

  render(model: BoxModel): void {
    this.model = model;
    const l = this.app.screen.layout();
    const box = boxRect(l);
    drawBoxFrame(this.frame.clear(), box);
    this.layer.removeAll(true);
    const chars = Math.min(60, Math.floor((box.width - 16) / CELL_WIDTH));
    const say = (text: string, color: number) => this.lines(text, box.x + 8, box.y + 6, chars, 3, color);
    if (model.kind === 'message') {
      say(model.text, COLOR.white);
      return;
    }
    const { menu, data } = model;
    const view = menuView(menu, data);
    const armed = armedHere(menu);
    const portrait = l.mode === 'portrait';
    switch (menu.screen) {
      case 'root':
        say(model.prompt, COLOR.white);
        this.panel(l, box, MENU_IDS.root, null, view.items.map((label, i) => ({ label, mark: i === 2 && model.whyFresh ? '!' : undefined })), view.index, false, 3);
        return;
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        say(`${m?.name ?? ''}: ${m === undefined ? '' : moveHint(m)}${armed ? ' TAP AGAIN TO USE.' : ''}`, m?.affordable === false ? COLOR.amber : COLOR.white);
        const items = data.moves.map((opt) => ({ label: opt.name.toUpperCase(), meta: { cost: String(opt.cost), ok: opt.affordable, color: typeColor(opt.type) } }));
        this.panel(l, box, MENU_IDS.moves, `PROMPT   T${menu.temperature}   COST`, items, view.index, armed, portrait ? 1 : this.listColumns(l, items.length));
        return;
      }
      case 'targets':
        say(armed ? 'Tap again to use it on this one.' : 'Pick a target.', COLOR.white);
        this.panel(l, box, MENU_IDS.targets, 'TARGET?', view.items.map((label) => ({ label })), view.index, armed, portrait ? 1 : 2);
        return;
      case 'temp': {
        const tip = TEMPERATURE_TIPS[menu.tempIndex as Temperature];
        say(armed ? `${tip} TAP AGAIN TO SET.` : tip, COLOR.cloud);
        this.panel(l, box, MENU_IDS.temp, null, view.items.map((label) => ({ label })), view.index, armed, 5);
        return;
      }
      case 'log':
        say('ROUND LOG.  UP/DOWN: SCROLL   A/B: BACK', COLOR.cloud);
        this.logPanel(l, box, view.items, view.index);
        return;
    }
  }

  /** Landscape move lists: three columns when they are wide enough for a move name, else two. */
  private listColumns(l: Layout, n: number): number {
    if (n <= 2) return 2;
    return l.safe.width - 2 * INSET >= 3 * 140 ? 3 : 2;
  }

  private text(x: number, y: number, text: string, color: number): Phaser.GameObjects.BitmapText {
    const t = addPixelText(this.scene, x, y, text, { color });
    this.layer.add(t);
    return t;
  }

  private lines(text: string, x: number, y: number, maxChars: number, maxLines: number, color: number): void {
    wrapText(text, maxChars)
      .slice(0, maxLines)
      .forEach((line, i) => this.text(x, y + i * CELL_HEIGHT, line, color));
  }

  private framed(r: Rect): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(r.x, r.y, r.width, r.height);
    g.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
    this.layer.add(g);
    return g;
  }

  /**
   * A framed panel of buttons sitting on the box: `columns` across, rows of the tap size, an optional header. The
   * cursor's button is outlined amber, an armed one (first tap) filled slate.
   */
  private panel(l: Layout, box: Rect, menuId: string, header: string | null, items: readonly Button[], index: number, armed: boolean, columns: number): void {
    const cols = Math.max(1, Math.min(columns, items.length));
    const rows = Math.ceil(items.length / cols);
    const pitch = l.tap;
    const height = (header === null ? 0 : HEADER) + rows * pitch + 2 * INSET;
    const r: Rect = { x: box.x, y: Math.max(l.safe.y, box.y - height + 1), width: box.width, height };
    const g = this.framed(r);
    let top = r.y + INSET;
    if (header !== null) {
      this.text(r.x + 8, top + 2, header, COLOR.cream);
      g.fillStyle(COLOR.slate).fillRect(r.x + 2, top + HEADER - 2, r.width - 4, 1);
      top += HEADER;
    }
    const colW = Math.floor((r.width - 2 * INSET) / cols);
    const textDy = Math.floor((pitch - 8) / 2);
    items.forEach((item, i) => {
      const bx = r.x + INSET + (i % cols) * colW;
      const by = top + Math.floor(i / cols) * pitch;
      const on = i === index;
      g.fillStyle(on ? COLOR.amber : COLOR.slate).fillRect(bx + 1, by + 1, colW - 2, pitch - 2);
      g.fillStyle(on && armed ? COLOR.slate : COLOR.ink).fillRect(bx + 2, by + 2, colW - 4, pitch - 4);
      const m = item.meta;
      const dim = m !== undefined && !m.ok;
      if (on) this.text(bx + 4, by + textDy, '▶', COLOR.amber);
      if (m !== undefined) g.fillStyle(m.color).fillRect(bx + 12, by + textDy, 2, 7);
      const nameX = bx + (m === undefined ? 12 : 17);
      const room = Math.floor((colW - (nameX - bx) - (m === undefined ? 4 : 6 + textWidth(m.cost) + 4)) / CELL_WIDTH) + 1;
      const label = [...item.label].length > room ? `${[...item.label].slice(0, room - 1).join('')}…` : item.label;
      this.text(nameX, by + textDy, label, dim ? COLOR.steel : on ? COLOR.white : COLOR.cloud);
      if (item.mark !== undefined) this.text(nameX + textWidth(label) + 2, by + textDy, item.mark, COLOR.amber);
      if (m !== undefined) this.text(bx + colW - 6 - textWidth(m.cost), by + textDy, m.cost, m.ok ? COLOR.cyan : COLOR.red);
      this.layer.add(addTapZone(this.scene, this.app, { x: bx, y: by, width: colW, height: pitch }, menuId, i, { pinned: false }));
    });
  }

  /** The last lines up to the cursor, newest at the bottom, in a panel from the top of the safe area to the box. */
  private logPanel(l: Layout, box: Rect, lines: readonly string[], index: number): void {
    const r: Rect = { x: box.x, y: l.safe.y, width: box.width, height: box.y - l.safe.y + 1 };
    this.framed(r);
    const shown = Math.max(1, Math.floor((r.height - 8) / CELL_HEIGHT));
    const chars = Math.floor((r.width - 12) / CELL_WIDTH);
    const first = Math.max(0, index - shown + 1);
    lines.slice(first, index + 1).forEach((line, i) => {
      const clipped = [...line].length > chars ? `${[...line].slice(0, chars - 1).join('')}…` : line;
      this.text(r.x + 6, r.y + 4 + i * CELL_HEIGHT, clipped, first + i === index ? COLOR.white : COLOR.mist);
    });
  }
}
