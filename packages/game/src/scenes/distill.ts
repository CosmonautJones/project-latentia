// Distill (plan step 6; Rulings 145 and 147): after beating the wild Tokenibble, a two-option choice. Spin up
// (recommended) adds it as a subagent at its wild level, L3, with one card slot; Graft puts its signature, Token
// Nibble, on the starter's grid. Each option has one plain line on what it means. There is no going back from here
// (B does nothing), but the choice is made in one press and saved by the flow.

import type { App } from '../app.js';
import { CreatureSprite } from '../battle-ui/creature-sprite.js';
import { DISTILL_CHOICES as DISTILL_TEXT, DISTILL_INTRO, DISTILL_TITLE } from '../content/journey-text.js';
import { DISTILL_CHOICES } from '../flow/flow.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { ChoicePanel } from '../ui/choice-panel.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

export class DistillScene extends BaseScene {
  constructor(app: App) {
    super('Distill', app);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(COLOR.ink).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // The trailhead's floor, and the powered-down Tokenibble sitting on it.
    g.fillStyle(COLOR.night).fillRect(0, GAME_HEIGHT - 30, GAME_WIDTH, 30);
    g.fillStyle(COLOR.slate).fillEllipse(GAME_WIDTH / 2, GAME_HEIGHT - 8, 64, 10);
    new CreatureSprite(this, GAME_WIDTH / 2, GAME_HEIGHT - 6, 'tokenibble', false).sprite.setAlpha(0.85);
    new ChoicePanel(this, this.app, {
      id: 'distill',
      title: DISTILL_TITLE,
      body: [DISTILL_INTRO],
      items: DISTILL_CHOICES.map((c) => DISTILL_TEXT[c]),
      onConfirm: (i) => {
        const choice = DISTILL_CHOICES[i];
        if (choice) this.send({ type: 'distillChosen', choice });
      },
    });
    this.ready();
  }
}
