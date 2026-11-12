// The battle's band along the bottom (plan v0.1 Q2): text lines on top, buttons under them, never over the field.
// - Text: playback messages; on the menus the prompt or the focused item's details, in plain words (V14), or the
//   numbers with NUMBERS on. With a subagent on your side (the Bootcamp Grad, V14) the first two lines are its plan:
//   "▶ TOKENIBBLE WILL: EARLY EXIT → VIBRAT" and "its card: IF foe HP < 50%".
// - Buttons: the root three to a row; the moves two to a row, each with its full name (wrapped onto two lines when
//   long) and its cost as pips (V13). A move that does not fit the free context is dimmed and the text says why
//   ("needs 3 context, 1 free"); it still runs. When the moves outnumber the slots, the last slot is MORE (a page).
// - Direct mode (tall portrait): the moves are the first screen, with WHY? LOG NUMBERS SPEED in one compact row under
//   them; the text lines start with the prompt, then the focused move's details.
// - The frame is one rect, or notched around the side controls in landscape (stage-layout.ts); its bottom is closed.
// Every button is at least the layout's tap size (44 CSS px). Rebuilt from the model on every change; the scene
// rebuilds the model from live state on a relayout (a rotation), so paging always matches the new geometry.

import Phaser from 'phaser';
import { moveDef, type Temperature } from '@latentia/engine';
import { armedHere, menuView, MENU_IDS, moveHint, movePage, PAGE_MENU_ID, rootItems, rootLabels, TARGET_COLUMNS, TEMPERATURE_TIPS, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import { moveSentence } from '../battle/move-words.js';
import { costView, OVERFLOW_NOTE } from '../battle/pips.js';
import type { MatePlan } from '../battle/plans.js';
import type { MoveOption } from '../battle/session.js';
import type { App } from '../app.js';
import type { Layout, Rect } from '../layout/viewport.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../text/font-sheet.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { COLOR } from '../ui/palette.js';
import { addTapZone } from '../ui/tap-zone.js';
import { PIP_PITCH } from './creature-panel.js';
import type { BattleGeometry } from './stage-layout.js';

export type BoxModel =
  | { readonly kind: 'message'; readonly text: string }
  | {
      readonly kind: 'menu';
      readonly menu: BattleMenuState;
      readonly data: MenuData;
      readonly prompt: string;
      /** A new deck-driven action has happened since "why?" was last opened. */
      readonly whyFresh: boolean;
      /** The player's subagent's plan for the coming round, when this fight shows it. */
      readonly mate: MatePlan | null;
    };

const typeColor = (type: string): number => (type === 'system' ? COLOR.mist : (TYPE_COLORS[type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist));

interface Button {
  readonly label: string;
  readonly move?: MoveOption;
  readonly mark?: string | undefined;
  /** The tap zone's menu and index (a page's MORE button has its own menu). */
  readonly menuId: string;
  readonly index: number;
}

/** What the focused move says in the text lines: plain words, or the numbers. */
export function moveDetails(m: MoveOption, numbers: boolean): string {
  const name = m.name.toUpperCase();
  if (numbers) return `${name}: ${moveHint(m)}`;
  const d = moveDef(m.moveId);
  const words = d === null ? '' : moveSentence(d, m.cost);
  const cost = costView(m.cost, m.free);
  return cost.reason === null ? `${name}: ${words}` : `${name}: ${cost.reason}. ${OVERFLOW_NOTE}`;
}

export class CommandBox {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly layer: Phaser.GameObjects.Container;
  private model: BoxModel = { kind: 'message', text: '' };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
    private readonly geometry: () => BattleGeometry,
  ) {
    this.frame = scene.add.graphics().setDepth(50);
    this.layer = scene.add.container(0, 0).setDepth(51);
  }

  /** Draw again for the current layout (a rotation), from the last model. */
  relayout(): void {
    this.render(this.model);
  }

  /** The text lines on screen, for the dev probe. */
  lines(): string[] {
    return this.layer.list.filter((o): o is Phaser.GameObjects.BitmapText => o instanceof Phaser.GameObjects.BitmapText && o.getData('line') === true).map((t) => t.text);
  }

  render(model: BoxModel): void {
    this.model = model;
    const l = this.app.screen.layout();
    const g = this.geometry();
    const f = this.frame.clear();
    // The outline of the frame's rects together: each filled ink inside its edge, and open into the next one below.
    for (const r of g.frame) f.fillStyle(COLOR.cloud).fillRect(r.x, r.y, r.width, r.height);
    g.frame.forEach((r, i) => f.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - (i < g.frame.length - 1 ? 1 : 2)));
    this.layer.removeAll(true);
    const chars = Math.floor(g.text.width / CELL_WIDTH);
    if (model.kind === 'message') {
      this.say(model.text, g.text, 0, g.lines, chars, COLOR.white);
      return;
    }
    let row = 0;
    if (model.mate !== null && g.lines >= 4) {
      const full = `▶ ${model.mate.who} ${model.mate.line}`;
      this.line([...full].length <= chars ? full : `${model.mate.who} ${model.mate.line}`, g.text, 0, chars, COLOR.cyan);
      this.line(`  ${model.mate.card}`, g.text, 1, chars, COLOR.mist);
      row = 2;
    }
    const left = g.lines - row;
    const { menu, data } = model;
    const view = menuView(menu, data);
    const armed = armedHere(menu);
    if (data.direct === true && g.system !== null && (menu.screen === 'root' || menu.screen === 'moves')) {
      this.direct(model, g, row, left, chars);
      return;
    }
    switch (menu.screen) {
      case 'root':
        this.say(model.prompt, g.text, row, left, chars, COLOR.white);
        this.grid(g, view.items.map((label, i) => ({ label, mark: label === 'WHY?' && model.whyFresh ? '!' : undefined, menuId: MENU_IDS.root, index: i })), view.index, false, 3);
        return;
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        this.say(this.details(menu, data), g.text, row, left, chars, m?.affordable === false ? COLOR.amber : COLOR.white);
        this.moveGrid(g, menu, data, true);
        return;
      }
      case 'targets':
        this.say(armed ? 'Tap again to use it on this one.' : 'Pick a target.', g.text, row, left, chars, COLOR.white);
        this.grid(g, view.items.map((label, i) => ({ label, menuId: MENU_IDS.targets, index: i })), view.index, armed, TARGET_COLUMNS);
        return;
      case 'temp': {
        const tip = TEMPERATURE_TIPS[menu.tempIndex as Temperature];
        this.say(armed ? `${tip} TAP AGAIN TO SET.` : tip, g.text, row, left, chars, COLOR.cloud);
        this.grid(g, view.items.map((label, i) => ({ label, menuId: MENU_IDS.temp, index: i })), view.index, armed, 5);
        return;
      }
      case 'log':
        this.say('ROUND LOG.  UP/DOWN: SCROLL   A/B: BACK', g.text, row, left, chars, COLOR.cloud);
        this.logPanel(l, g, view.items, view.index);
        return;
    }
  }

  /** The focused move's details ("TAP AGAIN TO USE." first while it is armed). */
  private details(menu: BattleMenuState, data: MenuData): string {
    const m = data.moves[menu.moveIndex];
    return m === undefined ? '' : `${armedHere(menu) ? 'TAP AGAIN TO USE. ' : ''}${moveDetails(m, menu.numbers)}`;
  }

  /** The move list's page in the button grid; `focused` when the cursor is on it. */
  private moveGrid(g: BattleGeometry, menu: BattleMenuState, data: MenuData, focused: boolean): void {
    const page = movePage(menu.moveIndex, data);
    const shown = data.moves.slice(page.first, page.first + page.size);
    const items: Button[] = shown.map((opt, i) => ({ label: opt.name.toUpperCase(), move: opt, menuId: MENU_IDS.moves, index: page.first + i }));
    if (page.pages > 1) items.push({ label: `MORE ${Math.floor(page.first / page.size) + 1}/${page.pages} ▶`, menuId: PAGE_MENU_ID, index: 0 });
    this.grid(g, items, focused ? menu.moveIndex - page.first : -1, armedHere(menu), g.columns);
  }

  /** Direct mode: the prompt and the focused move's details over the moves, the system row under them. */
  private direct(model: Extract<BoxModel, { kind: 'menu' }>, g: BattleGeometry, row: number, left: number, chars: number): void {
    const { menu, data } = model;
    const onMoves = menu.screen === 'moves';
    const m = data.moves[menu.moveIndex];
    const promptRows = left >= 4 ? 1 : 0;
    if (promptRows > 0) this.line(model.prompt, g.text, row, chars, COLOR.white);
    if (onMoves) this.say(this.details(menu, data), g.text, row + promptRows, left - promptRows, chars, m?.affordable === false ? COLOR.amber : COLOR.white);
    else if (promptRows === 0) this.say(model.prompt, g.text, row, left, chars, COLOR.white);
    this.moveGrid(g, menu, data, onMoves);
    if (g.system !== null) this.systemRow(g.system, model, onMoves ? -1 : menu.rootIndex);
  }

  /** The compact row of the root's other items (WHY? LOG NUMBERS SPEED), centred labels, short ones where long don't fit. */
  private systemRow(area: Rect, model: Extract<BoxModel, { kind: 'menu' }>, index: number): void {
    const items = rootItems(model.data);
    const shown = items.flatMap((r, i) => (r === 'prompt' ? [] : [i]));
    const colW = Math.floor(area.width / Math.max(1, shown.length));
    const full = rootLabels(model.menu, model.data);
    const fits = shown.every((i) => textWidth(full[i] ?? '') + 6 <= colW);
    const labels = fits ? full : rootLabels(model.menu, model.data, true);
    const g = this.scene.add.graphics();
    this.layer.add(g);
    shown.forEach((at, k) => {
      const bx = area.x + k * colW;
      const on = at === index;
      g.fillStyle(on ? COLOR.amber : COLOR.slate).fillRect(bx + 1, area.y + 1, colW - 2, area.height - 2);
      g.fillStyle(COLOR.ink).fillRect(bx + 2, area.y + 2, colW - 4, area.height - 4);
      const label = labels[at] ?? '';
      const clipped = textWidth(label) + 4 > colW ? `${[...label].slice(0, Math.max(1, Math.floor((colW - 4) / CELL_WIDTH) - 1)).join('')}…` : label;
      const tx = bx + Math.floor((colW - textWidth(clipped)) / 2);
      const ty = area.y + Math.floor((area.height - CELL_HEIGHT + 2) / 2);
      this.text(tx, ty, clipped, on ? COLOR.white : COLOR.cloud);
      if (items[at] === 'why' && model.whyFresh) this.text(tx + textWidth(clipped) + 1, ty, '!', COLOR.amber);
      this.layer.add(addTapZone(this.scene, this.app, { x: bx, y: area.y, width: colW, height: area.height }, MENU_IDS.root, at, { pinned: false }));
    });
  }

  private text(x: number, y: number, text: string, color: number, line = false): Phaser.GameObjects.BitmapText {
    const t = addPixelText(this.scene, x, y, text, { color });
    if (line) t.setData('line', true);
    this.layer.add(t);
    return t;
  }

  private line(text: string, area: Rect, row: number, chars: number, color: number): void {
    const clipped = [...text].length > chars ? `${[...text].slice(0, chars - 1).join('')}…` : text;
    this.text(area.x, area.y + row * CELL_HEIGHT, clipped, color, true);
  }

  /** `text` wrapped into at most `lines` lines from `row`; the last line ends in "…" when there is more. */
  private say(text: string, area: Rect, row: number, lines: number, chars: number, color: number): void {
    const wrapped = wrapText(text, chars);
    wrapped.slice(0, lines).forEach((l, i) => this.line(i === lines - 1 && wrapped.length > lines ? `${l}…` : l, area, row + i, chars, color));
  }

  private framed(r: Rect): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(r.x, r.y, r.width, r.height);
    g.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
    this.layer.add(g);
    return g;
  }

  /** The buttons in the band's grid, `columns` across, rows of the band's pitch; the cursor's outlined amber, an armed one filled slate. */
  private grid(geo: BattleGeometry, items: readonly Button[], index: number, armed: boolean, columns: number): void {
    const area = geo.buttons;
    const cols = Math.max(1, Math.min(columns, items.length));
    const pitch = geo.pitch;
    const colW = Math.floor(area.width / cols);
    const g = this.scene.add.graphics();
    this.layer.add(g);
    items.forEach((item, i) => {
      const bx = area.x + (i % cols) * colW;
      const by = area.y + Math.floor(i / cols) * pitch;
      if (by + pitch > area.y + area.height + 1) {
        // The caller pages the list to fit the grid; an item past it would be lost input, so say so loudly.
        console.error(`command box: ${item.menuId}[${item.index}] does not fit the ${cols}x${geo.rows} grid`);
        return;
      }
      const on = i === index && item.menuId !== PAGE_MENU_ID;
      g.fillStyle(on ? COLOR.amber : COLOR.slate).fillRect(bx + 1, by + 1, colW - 2, pitch - 2);
      g.fillStyle(on && armed ? COLOR.slate : COLOR.ink).fillRect(bx + 2, by + 2, colW - 4, pitch - 4);
      const m = item.move;
      const cost = m === undefined ? null : costView(m.cost, m.free);
      const dim = cost !== null && !cost.affordable;
      const pipsW = cost === null ? 0 : Math.max(1, cost.pips.length) * PIP_PITCH + 4;
      if (on) this.text(bx + 4, by + Math.floor((pitch - 8) / 2), '▶', COLOR.amber);
      if (m !== undefined) g.fillStyle(typeColor(m.type)).fillRect(bx + 12, by + 4, 2, pitch - 8);
      const nameX = bx + 17;
      const room = Math.max(3, Math.floor((colW - 17 - pipsW - 4 + 1) / CELL_WIDTH));
      const wrapped = wrapText(item.label, room);
      const twoLines = wrapped.length > 1 && pitch >= 2 * CELL_HEIGHT + 4;
      const nameLines = twoLines ? wrapped.slice(0, 2) : [[...item.label].length > room ? `${[...item.label].slice(0, room - 1).join('')}…` : item.label];
      const top = by + Math.floor((pitch - nameLines.length * CELL_HEIGHT + 2) / 2);
      const color = dim ? COLOR.steel : item.menuId === PAGE_MENU_ID ? COLOR.cream : on ? COLOR.white : COLOR.cloud;
      nameLines.forEach((t, k) => this.text(nameX, top + k * CELL_HEIGHT, t, color));
      if (item.mark !== undefined) this.text(nameX + textWidth(nameLines[0] ?? '') + 2, top, item.mark, COLOR.amber);
      if (cost !== null) this.costPips(g, cost.pips, bx + colW - 4 - pipsW + 4, by + Math.floor(pitch / 2) - 3);
      this.layer.add(addTapZone(this.scene, this.app, { x: bx, y: by, width: colW, height: pitch }, item.menuId, item.index, { pinned: false }));
    });
  }

  /** A move's cost as pips: cyan while the free context covers it, red past it; a free move shows one hollow pip. */
  private costPips(g: Phaser.GameObjects.Graphics, pips: readonly ('fits' | 'over')[], x: number, y: number): void {
    if (pips.length === 0) {
      g.fillStyle(COLOR.steel).fillRect(x, y, 3, 6);
      g.fillStyle(COLOR.ink).fillRect(x + 1, y + 1, 1, 4);
      return;
    }
    pips.forEach((p, i) => g.fillStyle(p === 'fits' ? COLOR.cyan : COLOR.red).fillRect(x + i * PIP_PITCH, y, 3, 6));
  }

  /** The last lines up to the cursor, newest at the bottom, in a panel from the top of the safe area to the band. */
  private logPanel(l: Layout, geo: BattleGeometry, lines: readonly string[], index: number): void {
    const r: Rect = { x: l.safe.x, y: l.safe.y, width: l.safe.width, height: geo.band.y - l.safe.y + 1 };
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
