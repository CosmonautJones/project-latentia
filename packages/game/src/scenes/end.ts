// End card (stub): thanks, the choices made, and the way back to the title. P4 adds the stats summary.

import type { App } from '../app.js';
import { GAME_WIDTH } from '../layout/compute.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const THANKS = 'Thanks for playing v0';

export class EndScene extends BaseScene {
  constructor(app: App) {
    super('End', app);
  }

  create(): void {
    const { starter, distill } = this.app.flow.state;
    this.stubFrame('END');
    addPixelText(this, Math.floor((GAME_WIDTH - textWidth(THANKS, 2)) / 2), 36, THANKS, { scale: 2, color: COLOR.cyan });
    addPixelText(this, 60, 70, `Starter: ${starter ?? '-'}`, { color: COLOR.cloud });
    addPixelText(this, 60, 82, `Distill: ${distill === 'spinUp' ? 'spin up' : (distill ?? '-')}`, { color: COLOR.cloud });
    new MenuList(this, this.app, {
      id: 'end',
      items: ['BACK TO TITLE'],
      x: 60,
      y: 110,
      width: 120,
      rowHeight: 16,
      onConfirm: () => this.send({ type: 'backToTitle' }),
    });
    this.ready();
  }
}
