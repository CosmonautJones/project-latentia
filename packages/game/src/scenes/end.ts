// End card (plan step 9): thanks, the run in numbers (turns, cards fired, the distill choice, the core loop's losses →
// swaps → rematches) and the virtual water receipt. BACK TO TITLE keeps the save at the end card, so Continue shows
// this card again and NEW GAME starts a fresh run (the choice documented in the README). Laid out from the safe area,
// again on every relayout.

import type Phaser from 'phaser';
import type { App } from '../app.js';
import { endCardStats } from '../journey/end-stats.js';
import { RECEIPT_CREDIT } from '../journey/receipt.js';
import type { Layout } from '../layout/viewport.js';
import { CELL_HEIGHT, CELL_WIDTH } from '../text/font-sheet.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { wrapText } from '../text/wrap.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const THANKS = 'Thanks for playing v0.1';
const INSET = 12;

export class EndScene extends BaseScene {
  private statics: Phaser.GameObjects.GameObject[] = [];

  constructor(app: App) {
    super('End', app);
  }

  create(): void {
    this.statics = [];
    this.draw(this.layout);
    this.onRelayout((l) => this.draw(l));
    new MenuList(this, this.app, {
      id: 'end',
      items: ['BACK TO TITLE'],
      place: (l) => ({ x: l.safe.x + INSET, y: l.safe.y + l.safe.height - 4, bottom: true, width: textWidth('BACK TO TITLE') + 16 }),
      rowHeight: 16,
      onConfirm: () => this.send({ type: 'backToTitle' }),
    });
    this.ready();
  }

  private draw(l: Layout): void {
    for (const o of this.statics) o.destroy();
    const stats = endCardStats(this.app.flow.state);
    const left = l.safe.x + INSET;
    const width = l.safe.width - 2 * INSET;
    const chars = Math.floor(width / CELL_WIDTH);
    const objs: Phaser.GameObjects.GameObject[] = [this.add.rectangle(0, 0, l.logical.width, l.logical.height, COLOR.ink).setOrigin(0)];
    const text = (x: number, y: number, s: string, color: number, scale = 1) => objs.push(addPixelText(this, x, y, s, { color, scale }));
    const big = textWidth(THANKS, 2) <= l.safe.width - 8 ? 2 : 1;
    text(l.safe.x + Math.floor((l.safe.width - textWidth(THANKS, big)) / 2), l.safe.y + 8 + (2 - big) * 4, THANKS, COLOR.cyan, big);
    let y = l.safe.y + 34;
    for (const line of stats.lines.flatMap((s) => wrapText(s, chars))) {
      text(left, y, line, COLOR.cloud);
      y += CELL_HEIGHT;
    }
    y += 6;
    const receiptLines = wrapText(stats.receipt, chars - 2);
    const creditLines = wrapText(RECEIPT_CREDIT, chars - 2);
    const receipt = this.add.graphics();
    objs.push(receipt);
    receipt.fillStyle(COLOR.cream).fillRect(left - 4, y - 4, width + 8, (receiptLines.length + creditLines.length) * CELL_HEIGHT + 6);
    for (const line of receiptLines) {
      text(left + 2, y, line, COLOR.ink);
      y += CELL_HEIGHT;
    }
    for (const line of creditLines) {
      text(left + 2, y, line, COLOR.steel);
      y += CELL_HEIGHT;
    }
    for (const o of objs) (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(-1);
    this.statics = objs;
  }
}
