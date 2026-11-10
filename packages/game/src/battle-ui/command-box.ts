// The in-canvas battle text and menus. The bottom 320×44 box carries playback messages and the prompt; in landscape
// it also holds the 2×2 root grid and the temperature notches, and a framed panel over the left side lists moves or
// targets. In portrait the band menu takes the buttons, and this box keeps the prompt and the highlighted item's hint.
// Rebuilt from the menu state on every change (a few dozen objects).

import Phaser from 'phaser';
import type { Temperature } from '@latentia/engine';
import { menuView, MENU_IDS, moveHint, TEMPERATURE_TIPS, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import type { App } from '../app.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { COLOR } from '../ui/palette.js';

export const BOX_Y = 136;
const BOX_H = GAME_HEIGHT - BOX_Y;
/** The move/target list panel: left of the player panel, down to the bottom edge. */
const LIST = { x: 0, y: 56, w: 186, row: 12 } as const;

export type BoxModel =
  | { readonly kind: 'message'; readonly text: string }
  | {
      readonly kind: 'menu';
      readonly menu: BattleMenuState;
      readonly data: MenuData;
      readonly prompt: string;
      /** Landscape: draw the buttons here. Portrait: the band has them. */
      readonly buttons: boolean;
      /** A new deck-driven action has happened since "why?" was last opened. */
      readonly whyFresh: boolean;
    };

export class CommandBox {
  private readonly layer: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
  ) {
    const g = scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(0, BOX_Y, GAME_WIDTH, BOX_H);
    g.fillStyle(COLOR.ink).fillRect(1, BOX_Y + 1, GAME_WIDTH - 2, BOX_H - 2);
    g.fillStyle(COLOR.slate).fillRect(2, BOX_Y + 2, GAME_WIDTH - 4, 1);
    g.setDepth(50);
    this.layer = scene.add.container(0, 0).setDepth(51);
  }

  render(model: BoxModel): void {
    this.layer.removeAll(true);
    if (model.kind === 'message') {
      this.lines(model.text, 8, BOX_Y + 5, 50, 4, COLOR.white);
      return;
    }
    const { menu, data } = model;
    const view = menuView(menu, data);
    switch (menu.screen) {
      case 'root':
        this.lines(model.prompt, 8, BOX_Y + 6, model.buttons ? 25 : 50, 3, COLOR.white);
        if (model.buttons) this.rootGrid(view.items, view.index, model.whyFresh);
        return;
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        const hint = m === undefined ? '' : moveHint(m);
        if (model.buttons) {
          this.list(MENU_IDS.moves, view.items, view.index, `PROMPT   T${menu.temperature}`, (i) => {
            const opt = data.moves[i];
            return opt === undefined ? null : { cost: String(opt.cost), ok: opt.affordable, color: opt.type === 'system' ? COLOR.mist : TYPE_COLORS[opt.type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist };
          });
          this.lines(hint, 198, BOX_Y + 6, 19, 3, m?.affordable === false ? COLOR.amber : COLOR.cloud);
          this.text(GAME_WIDTH - 6 - textWidth('B: BACK'), BOX_Y + 34, 'B: BACK', COLOR.steel);
        } else {
          this.lines(`${m?.name ?? ''}: ${hint}`, 8, BOX_Y + 6, 50, 3, m?.affordable === false ? COLOR.amber : COLOR.white);
        }
        return;
      }
      case 'targets':
        if (model.buttons) {
          this.list(MENU_IDS.targets, view.items, view.index, 'TARGET?', () => null);
          this.text(198, BOX_Y + 6, 'Pick a target.', COLOR.cloud);
        } else {
          this.lines('Pick a target.', 8, BOX_Y + 6, 50, 3, COLOR.white);
        }
        return;
      case 'temp': {
        const tip = TEMPERATURE_TIPS[menu.tempIndex as Temperature];
        this.lines(tip, 8, BOX_Y + 6, model.buttons ? 26 : 50, 3, COLOR.cloud);
        if (model.buttons) this.notches(view.index);
        return;
      }
    }
  }

  private text(x: number, y: number, text: string, color: number): Phaser.GameObjects.BitmapText {
    const t = addPixelText(this.scene, x, y, text, { color });
    this.layer.add(t);
    return t;
  }

  private lines(text: string, x: number, y: number, maxChars: number, maxLines: number, color: number): void {
    wrapText(text, maxChars)
      .slice(0, maxLines)
      .forEach((line, i) => this.text(x, y + i * 10, line, color));
  }

  /** A tap target over a row that picks it through the action stream. */
  private zone(x: number, y: number, w: number, h: number, menuId: string, index: number): void {
    const z = this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.app.input.pick(menuId, index));
    this.layer.add(z);
  }

  private cursor(x: number, y: number): void {
    this.text(x, y, '▶', COLOR.amber);
  }

  private rootGrid(items: readonly string[], index: number, whyFresh: boolean): void {
    items.forEach((item, i) => {
      const x = 176 + (i % 2) * 74;
      const y = BOX_Y + 5 + Math.floor(i / 2) * 18;
      if (i === index) this.cursor(x - 9, y + 3);
      this.text(x, y + 3, item, i === index ? COLOR.white : COLOR.mist);
      if (i === 2 && whyFresh) this.text(x + textWidth(item) + 2, y + 3, '!', COLOR.amber);
      this.zone(x - 10, y, 72, 18, MENU_IDS.root, i);
    });
  }

  private list(menuId: string, items: readonly string[], index: number, header: string, meta: (i: number) => { cost: string; ok: boolean; color: number } | null): void {
    const g = this.scene.add.graphics();
    const h = GAME_HEIGHT - LIST.y;
    g.fillStyle(COLOR.cloud).fillRect(LIST.x, LIST.y, LIST.w, h);
    g.fillStyle(COLOR.ink).fillRect(LIST.x + 1, LIST.y + 1, LIST.w - 2, h - 2);
    g.fillStyle(COLOR.slate).fillRect(LIST.x + 2, LIST.y + 13, LIST.w - 4, 1);
    this.layer.add(g);
    this.text(LIST.x + 6, LIST.y + 3, header, COLOR.cream);
    items.forEach((item, i) => {
      const y = LIST.y + 15 + i * LIST.row;
      const m = meta(i);
      if (i === index) this.cursor(LIST.x + 4, y + 2);
      if (m !== null) g.fillStyle(m.color).fillRect(LIST.x + 13, y + 2, 2, 7);
      const dim = m !== null && !m.ok;
      this.text(LIST.x + 18, y + 2, item, dim ? COLOR.steel : i === index ? COLOR.white : COLOR.cloud);
      if (m !== null) this.text(LIST.x + LIST.w - 6 - textWidth(m.cost), y + 2, m.cost, m.ok ? COLOR.cyan : COLOR.red);
      this.zone(LIST.x + 2, y, LIST.w - 4, LIST.row, menuId, i);
    });
  }

  private notches(index: number): void {
    for (let t = 0; t <= 4; t++) {
      const x = 180 + t * 27;
      const y = BOX_Y + 8;
      const g = this.scene.add.graphics();
      g.fillStyle(t === index ? COLOR.amber : COLOR.slate).fillRect(x - 2, y - 2, 22, 14);
      this.layer.add(g);
      this.text(x + 3, y + 1, `T${t}`, t === index ? COLOR.ink : COLOR.cloud);
      this.zone(x - 2, y - 2, 22, 14, MENU_IDS.temp, t);
    }
    this.text(176, BOX_Y + 28, 'A: SET  B: BACK', COLOR.steel);
  }
}
