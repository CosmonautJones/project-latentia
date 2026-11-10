// Title: the logo, New Game, and Continue when a valid save exists.

import { ENGINE_VERSION } from '@latentia/engine';
import type { App } from '../app.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { loadSave } from '../save/save.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
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
    const items = save.status === 'ok' ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
    const menuWidth = textWidth('CONTINUE') + 10;
    new MenuList(this, this.app, {
      id: 'title',
      items,
      x: Math.floor((GAME_WIDTH - menuWidth) / 2),
      y: 92,
      width: menuWidth,
      rowHeight: 16,
      onConfirm: (i) => {
        if (items[i] === 'CONTINUE' && save.status === 'ok') this.send({ type: 'continue', progress: save.save.progress });
        else this.send({ type: 'newGame' });
      },
    });

    addPixelText(this, 4, GAME_HEIGHT - 12, `v0  engine ${ENGINE_VERSION}`, { color: COLOR.steel });
    const hint = this.sys.game.device.input.touch ? 'A: SELECT' : 'Z/ENTER: SELECT';
    addPixelText(this, GAME_WIDTH - 4 - textWidth(hint), GAME_HEIGHT - 12, hint, { color: COLOR.steel });
    this.ready();
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
