// Title: the logo, New Game, and Continue when a valid save exists. New Game over a save asks before erasing it.

import { ENGINE_VERSION } from '@latentia/engine';
import type Phaser from 'phaser';
import type { App } from '../app.js';
import type { Layout } from '../layout/viewport.js';
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
const motes = (width: number, height: number): { x: number; y: number; bright: boolean }[] => {
  const out: { x: number; y: number; bright: boolean }[] = [];
  for (let cy = 0; cy < Math.ceil(height / 10); cy++) {
    for (let cx = 0; cx < Math.ceil(width / 16); cx++) {
      const h = Math.imul(cx * 73856093 + cy * 19349663 + 7, 2654435761) >>> 0;
      if (h % 5 !== 0) continue;
      out.push({ x: cx * 16 + ((h >>> 8) % 16), y: cy * 10 + ((h >>> 16) % 10), bright: h % 3 === 0 });
    }
  }
  return out;
};

export class TitleScene extends BaseScene {
  /** The backdrop, logo and footers: drawn again on every relayout. */
  private statics: Phaser.GameObjects.GameObject[] = [];

  constructor(app: App) {
    super('Title', app);
  }

  create(): void {
    this.statics = [];
    this.drawStatics(this.layout);
    this.onRelayout((l) => this.drawStatics(l));

    const save = loadSave(this.app.storage);
    const hasSave = save.status === 'ok';
    const items = titleItems(hasSave);
    const menuWidth = textWidth('CONTINUE') + 14;
    const menu = new MenuList(this, this.app, {
      id: TITLE_MENU_ID,
      items,
      // Centred, under the tagline.
      place: (l) => ({ x: Math.floor((l.logical.width - menuWidth) / 2), y: this.logoY(l) + 44, width: menuWidth }),
      rowHeight: 16,
      onConfirm: (i) => {
        const pick = titlePick(items[i], hasSave);
        if (pick === 'continue' && save.status === 'ok') this.send({ type: 'continue', progress: save.save.progress });
        else if (pick === 'newGame') this.send({ type: 'newGame' });
        else this.confirmNewGame(menu);
      },
    });
    this.ready();
  }

  /** The logo's top: a third of the way down the safe area in landscape, a little higher in portrait. */
  private logoY(l: Layout): number {
    return l.safe.y + Math.floor(l.safe.height * (l.mode === 'portrait' ? 0.22 : 0.16));
  }

  private drawStatics(l: Layout): void {
    for (const o of this.statics) o.destroy();
    this.statics = [];
    // Under the menu, whatever order they are drawn in.
    const keep = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth>(o: T): T => {
      this.statics.push(o.setDepth(-1));
      return o;
    };
    const { width } = l.logical;
    keep(this.drawBackdrop(l));
    const logoX = Math.floor((width - textWidth(LOGO, LOGO_SCALE)) / 2);
    const y = this.logoY(l);
    keep(addPixelText(this, logoX + 1, y + 1, LOGO, { scale: LOGO_SCALE, color: COLOR.navy }));
    keep(addPixelText(this, logoX, y, LOGO, { scale: LOGO_SCALE, color: COLOR.cyan }));
    keep(addPixelText(this, Math.floor((width - textWidth(TAGLINE)) / 2), y + 30, TAGLINE, { color: COLOR.amber }));
    // The footers sit at the bottom of the safe area, clear of the touch controls.
    const footY = l.safe.y + l.safe.height - 12;
    const hint = this.sys.game.device.input.touch ? 'A: SELECT' : 'Z/ENTER: SELECT';
    keep(addPixelText(this, l.safe.x + 4, footY, `v0.1  engine ${ENGINE_VERSION}`, { color: COLOR.steel }));
    keep(addPixelText(this, l.safe.x + l.safe.width - 4 - textWidth(hint), footY, hint, { color: COLOR.steel }));
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
      align: 'centre',
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

  private drawBackdrop(l: Layout): Phaser.GameObjects.Graphics {
    // A dark sky over a skyline of server racks; the glow behind the racks is dithered in, not banded.
    const { width: W, height: H } = l.logical;
    const g = this.add.graphics();
    g.fillStyle(COLOR.ink).fillRect(0, 0, W, H);
    for (const m of motes(W, H)) g.fillStyle(m.bright ? COLOR.cloud : COLOR.steel).fillRect(m.x, m.y, 1, 1);
    const glowTop = H - 62;
    g.fillStyle(COLOR.night).fillRect(0, glowTop + 6, W, H - glowTop - 6);
    for (let y = glowTop; y < glowTop + 6; y++) {
      // Sparse checker rows thickening toward the solid glow.
      const step = y < glowTop + 2 ? 4 : y < glowTop + 4 ? 3 : 2;
      for (let x = (y * 2) % step; x < W; x += step) g.fillRect(x, y, 1, 1);
    }
    for (let x = 0; x < W; x += 20) {
      const h = 14 + ((x * 7) % 18);
      g.fillStyle(COLOR.ink).fillRect(x, H - 20 - h, 18, h + 20);
      for (let y = H - 16 - h; y < H - 20; y += 4) {
        g.fillStyle(((x + y) & 4) === 0 ? COLOR.green : COLOR.blue).fillRect(x + 3, y, 1, 1);
      }
    }
    g.fillStyle(COLOR.ink).fillRect(0, H - 20, W, 20);
    return g;
  }
}
