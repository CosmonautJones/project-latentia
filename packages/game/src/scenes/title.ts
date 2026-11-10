// Title: the logo, New Game, and Continue when a valid save exists. New Game over a save asks before erasing it.

import { ENGINE_VERSION } from '@latentia/engine';
import type { App } from '../app.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import {
  CONFIRM_BODY,
  CONFIRM_DEFAULT,
  CONFIRM_ITEMS,
  CONFIRM_MENU_ID,
  CONFIRM_TITLE,
  confirmPick,
  TITLE_MENU_ID,
  titleItems,
  titlePick,
} from '../flow/title-menu.js';
import { loadSave } from '../save/save.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { ChoicePanel } from '../ui/choice-panel.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const LOGO = 'LATENTIA';
const LOGO_SCALE = 3;
const TAGLINE = 'Teach your models. Beat the benchmarks.';

// Fixed star field (no randomness): a small integer hash picks which cells of a coarse grid get a mote.
const motes = (): { x: number; y: number; bright: boolean }[] => {
  const out: { x: number; y: number; bright: boolean }[] = [];
  for (let cy = 0; cy < 12; cy++) {
    for (let cx = 0; cx < 20; cx++) {
      const h = Math.imul(cx * 73856093 + cy * 19349663 + 7, 2654435761) >>> 0;
      if (h % 5 !== 0) continue;
      out.push({ x: cx * 16 + ((h >>> 8) % 16), y: cy * 10 + ((h >>> 16) % 10), bright: h % 3 === 0 });
    }
  }
  return out;
};

export class TitleScene extends BaseScene {
  constructor(app: App) {
    super('Title', app);
  }

  create(): void {
    this.drawBackdrop();

    const logoX = Math.floor((GAME_WIDTH - textWidth(LOGO, LOGO_SCALE)) / 2);
    addPixelText(this, logoX + 1, 33, LOGO, { scale: LOGO_SCALE, color: COLOR.navy });
    addPixelText(this, logoX, 32, LOGO, { scale: LOGO_SCALE, color: COLOR.cyan });
    addPixelText(this, Math.floor((GAME_WIDTH - textWidth(TAGLINE)) / 2), 62, TAGLINE, { color: COLOR.amber });

    const save = loadSave(this.app.storage);
    const hasSave = save.status === 'ok';
    const items = titleItems(hasSave);
    const menuWidth = textWidth('CONTINUE') + 10;
    const menu = new MenuList(this, this.app, {
      id: TITLE_MENU_ID,
      items,
      x: Math.floor((GAME_WIDTH - menuWidth) / 2),
      y: 92,
      width: menuWidth,
      rowHeight: 16,
      onConfirm: (i) => {
        const pick = titlePick(items[i], hasSave);
        if (pick === 'continue' && save.status === 'ok') this.send({ type: 'continue', progress: save.save.progress });
        else if (pick === 'newGame') this.send({ type: 'newGame' });
        else this.confirmNewGame(menu);
      },
    });

    addPixelText(this, 4, GAME_HEIGHT - 12, `v0  engine ${ENGINE_VERSION}`, { color: COLOR.steel });
    const hint = this.sys.game.device.input.touch ? 'A: SELECT' : 'Z/ENTER: SELECT';
    addPixelText(this, GAME_WIDTH - 4 - textWidth(hint), GAME_HEIGHT - 12, hint, { color: COLOR.steel });
    this.ready();
  }

  /** NEW GAME over a save: ask before erasing it. START OVER starts over; CANCEL or B goes back to the title menu. */
  private confirmNewGame(menu: MenuList): void {
    menu.setActive(false);
    const panel = new ChoicePanel(this, this.app, {
      id: CONFIRM_MENU_ID,
      title: CONFIRM_TITLE,
      body: [CONFIRM_BODY],
      items: CONFIRM_ITEMS.map((label) => ({ label })),
      index: CONFIRM_DEFAULT,
      y: 84,
      depth: 100,
      onConfirm: (i) => {
        if (confirmPick(i) === 'startOver') this.send({ type: 'newGame' });
        else back();
      },
      onCancel: () => back(),
    });
    const back = () => {
      panel.destroy();
      menu.setActive(true);
    };
  }

  private drawBackdrop(): void {
    // A dark sky over a skyline of server racks; the glow behind the racks is dithered in, not banded.
    const g = this.add.graphics();
    g.fillStyle(COLOR.ink).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    for (const m of motes()) g.fillStyle(m.bright ? COLOR.cloud : COLOR.steel).fillRect(m.x, m.y, 1, 1);
    const glowTop = 118;
    g.fillStyle(COLOR.night).fillRect(0, glowTop + 6, GAME_WIDTH, GAME_HEIGHT - glowTop - 6);
    for (let y = glowTop; y < glowTop + 6; y++) {
      // Sparse checker rows thickening toward the solid glow.
      const step = y < glowTop + 2 ? 4 : y < glowTop + 4 ? 3 : 2;
      for (let x = (y * 2) % step; x < GAME_WIDTH; x += step) g.fillRect(x, y, 1, 1);
    }
    for (let x = 0; x < GAME_WIDTH; x += 20) {
      const h = 14 + ((x * 7) % 18);
      g.fillStyle(COLOR.ink).fillRect(x, GAME_HEIGHT - 20 - h, 18, h + 20);
      for (let y = GAME_HEIGHT - 16 - h; y < GAME_HEIGHT - 20; y += 4) {
        g.fillStyle(((x + y) & 4) === 0 ? COLOR.green : COLOR.blue).fillRect(x + 3, y, 1, 1);
      }
    }
    g.fillStyle(COLOR.ink).fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);
  }
}
