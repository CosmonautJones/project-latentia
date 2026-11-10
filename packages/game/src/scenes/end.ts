// End card (plan step 9): thanks, the run in numbers (turns, cards fired, the distill choice, the core loop's losses →
// swaps → rematches) and the virtual water receipt. BACK TO TITLE keeps the save at the end card, so Continue shows
// this card again and NEW GAME starts a fresh run (the choice documented in the README).

import type { App } from '../app.js';
import { endCardStats } from '../journey/end-stats.js';
import { RECEIPT_CREDIT } from '../journey/receipt.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { CELL_HEIGHT } from '../text/font-sheet.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const THANKS = 'Thanks for playing v0';
const LEFT = 12;
const CHARS = Math.floor((GAME_WIDTH - 2 * LEFT) / 6);

export class EndScene extends BaseScene {
  constructor(app: App) {
    super('End', app);
  }

  create(): void {
    const stats = endCardStats(this.app.flow.state);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.ink).setOrigin(0);
    addPixelText(this, Math.floor((GAME_WIDTH - textWidth(THANKS, 2)) / 2), 8, THANKS, { scale: 2, color: COLOR.cyan });
    let y = 34;
    for (const line of stats.lines) {
      addPixelText(this, LEFT, y, line, { color: COLOR.cloud });
      y += CELL_HEIGHT;
    }
    y += 6;
    const receipt = this.add.graphics();
    const receiptLines = wrapText(stats.receipt, CHARS - 2);
    const creditLines = wrapText(RECEIPT_CREDIT, CHARS - 2);
    const height = (receiptLines.length + creditLines.length) * CELL_HEIGHT + 6;
    receipt.fillStyle(COLOR.cream).fillRect(LEFT - 4, y - 4, GAME_WIDTH - 2 * LEFT + 8, height);
    for (const line of receiptLines) {
      addPixelText(this, LEFT + 2, y, line, { color: COLOR.ink });
      y += CELL_HEIGHT;
    }
    for (const line of creditLines) {
      addPixelText(this, LEFT + 2, y, line, { color: COLOR.steel });
      y += CELL_HEIGHT;
    }
    new MenuList(this, this.app, {
      id: 'end',
      items: ['BACK TO TITLE'],
      x: LEFT,
      y: GAME_HEIGHT - 20,
      width: 120,
      rowHeight: 16,
      onConfirm: () => this.send({ type: 'backToTitle' }),
    });
    this.ready();
  }
}
