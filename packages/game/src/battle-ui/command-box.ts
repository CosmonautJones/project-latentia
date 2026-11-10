// The in-canvas battle text and menus. The bottom box (the DialogueBox's exact frame, so a popup over it shows one
// border) carries playback messages and the prompt. In landscape it also holds the root grid and the temperature
// notches, a framed panel over the left side lists moves or targets, and a full-width panel shows the round log. In
// portrait the band menu has the buttons, and this box keeps the prompt or the highlighted item's hint. Rebuilt from
// the menu state on every change (a few dozen objects).

import Phaser from 'phaser';
import type { Temperature } from '@latentia/engine';
import { armedHere, menuView, MENU_IDS, moveHint, TEMPERATURE_TIPS, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { TYPE_COLORS } from '../battle/labels.js';
import type { App } from '../app.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { BOX_HEIGHT, BOX_Y } from '../ui/dialogue-box.js';
import { COLOR } from '../ui/palette.js';

/** The move/target list panel: left of the player panel, down to the bottom edge. */
const LIST = { x: 0, y: 56, w: 186, row: 12 } as const;
/** The log panel: full width above the box. */
const LOG = { y: 2, lines: 12, chars: 51 } as const;

export type BoxModel =
  | { readonly kind: 'message'; readonly text: string }
  | {
      readonly kind: 'menu';
      readonly menu: BattleMenuState;
      readonly data: MenuData;
      readonly prompt: string;
      /** Canvas menus (desktop): draw the buttons here. Band menus (portrait, touch landscape): the band has them. */
      readonly buttons: boolean;
      /** A new deck-driven action has happened since "why?" was last opened. */
      readonly whyFresh: boolean;
    };

const typeColor = (type: string): number => (type === 'system' ? COLOR.mist : (TYPE_COLORS[type as keyof typeof TYPE_COLORS]?.fill ?? COLOR.mist));

export class CommandBox {
  private readonly layer: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly app: App,
  ) {
    const g = scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(0, BOX_Y, GAME_WIDTH, BOX_HEIGHT);
    g.fillStyle(COLOR.ink).fillRect(1, BOX_Y + 1, GAME_WIDTH - 2, BOX_HEIGHT - 2);
    g.fillStyle(COLOR.slate).fillRect(2, BOX_Y + 2, GAME_WIDTH - 4, 1);
    g.setDepth(50);
    this.layer = scene.add.container(0, 0).setDepth(51);
  }

  render(model: BoxModel): void {
    this.layer.removeAll(true);
    if (model.kind === 'message') {
      this.lines(model.text, 8, BOX_Y + 6, 50, 3, COLOR.white);
      return;
    }
    const { menu, data } = model;
    const view = menuView(menu, data);
    const armed = armedHere(menu);
    switch (menu.screen) {
      case 'root':
        this.lines(model.prompt, 8, BOX_Y + 6, model.buttons ? 25 : 50, 3, COLOR.white);
        if (model.buttons) this.rootGrid(view.items, view.index, model.whyFresh);
        return;
      case 'moves': {
        const m = data.moves[menu.moveIndex];
        const hint = `${m === undefined ? '' : moveHint(m)}${armed ? ' TAP AGAIN TO USE.' : ''}`;
        const color = m?.affordable === false ? COLOR.amber : COLOR.cloud;
        if (model.buttons) {
          this.list(MENU_IDS.moves, view.items, view.index, `PROMPT   T${menu.temperature}`, (i) => {
            const opt = data.moves[i];
            return opt === undefined ? null : { cost: String(opt.cost), ok: opt.affordable, color: typeColor(opt.type) };
          });
          // Two lines of hint, then the next step: the second tap after a first one, else the way back.
          this.lines(m === undefined ? '' : moveHint(m), 198, BOX_Y + 5, 19, 2, color);
          this.text(198, BOX_Y + 27, armed ? 'TAP AGAIN TO USE' : 'B: BACK', armed ? COLOR.amber : COLOR.steel);
        } else {
          this.lines(`${m?.name ?? ''}: ${hint}`, 8, BOX_Y + 6, 50, 3, m?.affordable === false ? COLOR.amber : COLOR.white);
        }
        return;
      }
      case 'targets': {
        const text = armed ? 'Tap again to use it on this one.' : 'Pick a target.';
        if (model.buttons) {
          this.list(MENU_IDS.targets, view.items, view.index, 'TARGET?', () => null);
          this.lines(text, 198, BOX_Y + 5, 19, 3, COLOR.cloud);
        } else {
          this.lines(text, 8, BOX_Y + 6, 50, 3, COLOR.white);
        }
        return;
      }
      case 'temp': {
        const tip = TEMPERATURE_TIPS[menu.tempIndex as Temperature];
        // With the notches in the band, the second-tap prompt is here (the canvas notches draw their own).
        this.lines(model.buttons || !armed ? tip : `${tip} TAP AGAIN TO SET.`, 8, BOX_Y + 5, model.buttons ? 26 : 50, 3, COLOR.cloud);
        if (model.buttons) this.notches(view.index, armed);
        return;
      }
      case 'log':
        if (model.buttons) this.logPanel(view.items, view.index);
        this.lines(model.buttons ? 'ROUND LOG.  UP/DOWN: SCROLL   A/B: BACK' : 'ROUND LOG (BELOW).  UP/DOWN: SCROLL   A/B: BACK', 8, BOX_Y + 6, 50, 3, COLOR.cloud);
        return;
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

  private frame(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR.cloud).fillRect(x, y, w, h);
    g.fillStyle(COLOR.ink).fillRect(x + 1, y + 1, w - 2, h - 2);
    this.layer.add(g);
    return g;
  }

  /** PROMPT TEMP / WHY? LOG / SPEED, two to a row. */
  private rootGrid(items: readonly string[], index: number, whyFresh: boolean): void {
    items.forEach((item, i) => {
      const x = 182 + (i % 2) * 70;
      const y = BOX_Y + 2 + Math.floor(i / 2) * 13;
      if (i === index) this.cursor(x - 9, y + 3);
      this.text(x, y + 3, item, i === index ? COLOR.white : COLOR.mist);
      if (i === 2 && whyFresh) this.text(x + textWidth(item) + 2, y + 3, '!', COLOR.amber);
      this.zone(x - 10, y, 68, 13, MENU_IDS.root, i);
    });
  }

  private list(menuId: string, items: readonly string[], index: number, header: string, meta: (i: number) => { cost: string; ok: boolean; color: number } | null): void {
    const g = this.frame(LIST.x, LIST.y, LIST.w, GAME_HEIGHT - LIST.y);
    g.fillStyle(COLOR.slate).fillRect(LIST.x + 2, LIST.y + 13, LIST.w - 4, 1);
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

  private notches(index: number, armed: boolean): void {
    for (let t = 0; t <= 4; t++) {
      const x = 180 + t * 27;
      const y = BOX_Y + 7;
      const g = this.scene.add.graphics();
      g.fillStyle(t === index ? COLOR.amber : COLOR.slate).fillRect(x - 2, y - 2, 22, 14);
      this.layer.add(g);
      this.text(x + 3, y + 1, `T${t}`, t === index ? COLOR.ink : COLOR.cloud);
      this.zone(x - 2, y - 2, 22, 14, MENU_IDS.temp, t);
    }
    this.text(176, BOX_Y + 26, armed ? 'TAP AGAIN TO SET' : 'A: SET  B: BACK', armed ? COLOR.amber : COLOR.steel);
  }

  /** The last lines up to the cursor, newest at the bottom. */
  private logPanel(lines: readonly string[], index: number): void {
    this.frame(0, LOG.y, GAME_WIDTH, LOG.lines * 10 + 6);
    const first = Math.max(0, index - LOG.lines + 1);
    lines.slice(first, index + 1).forEach((line, i) => {
      const clipped = [...line].length > LOG.chars ? `${[...line].slice(0, LOG.chars - 1).join('')}…` : line;
      this.text(6, LOG.y + 4 + i * 10, clipped, first + i === index ? COLOR.white : COLOR.mist);
    });
  }
}
