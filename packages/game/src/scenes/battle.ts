// Battle (stub): stands in for the rival, wild and trainer fights and the distill choice after the wild win.
// P2 replaces it with the engine-driven battle UI; the WIN/LOSE items exist so the flow can be walked now.

import type { App } from '../app.js';
import type { Step } from '../flow/flow.js';
import { addPixelText } from '../text/phaser-font.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const TITLES: Partial<Readonly<Record<Step, string>>> = {
  rival: 'BATTLE  RIVAL KIP',
  wild: 'BATTLE  WILD TOKENIBBLE',
  trainer: 'BATTLE  BOOTCAMP GRAD',
  distill: 'DISTILL TOKENIBBLE',
};

export class BattleScene extends BaseScene {
  constructor(app: App) {
    super('Battle', app);
  }

  create(): void {
    const { step, attempt } = this.app.flow.state;
    this.stubFrame(TITLES[step] ?? 'BATTLE');
    if (step === 'distill') {
      addPixelText(this, 20, 30, 'You won. What becomes of Tokenibble?', { color: COLOR.cloud });
      new MenuList(this, this.app, {
        id: 'distill',
        items: ['SPIN UP  (recommended)', 'GRAFT'],
        x: 40,
        y: 60,
        width: 200,
        rowHeight: 16,
        onConfirm: (i) => this.send({ type: 'distillChosen', choice: i === 0 ? 'spinUp' : 'graft' }),
      });
    } else {
      if (attempt > 0) addPixelText(this, 20, 30, `Attempt ${attempt + 1}. Losing just restarts the fight.`, { color: COLOR.cloud });
      new MenuList(this, this.app, {
        id: 'battle-result',
        items: ['WIN', 'LOSE'],
        x: 40,
        y: 60,
        width: 120,
        rowHeight: 16,
        onConfirm: (i) => this.send({ type: i === 0 ? 'battleWon' : 'battleLost' }),
      });
    }
    this.ready();
  }
}
