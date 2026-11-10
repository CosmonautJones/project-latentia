// Overworld (stub): the walk to the trailhead, and the card tutorial menu over it. P3 builds the real map and
// P4 the real tutorial; the menu already offers the real Tokenibble presets.

import { moveDef } from '@latentia/engine';
import type { App } from '../app.js';
import { cardText } from '../battle/card-text.js';
import { TOKENIBBLE_PRESETS } from '../content/trainers.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { MenuList } from '../ui/menu-list.js';
import { BaseScene } from './base-scene.js';

const STUB_CARDS = TOKENIBBLE_PRESETS.map((p) => ({ id: p.id, label: cardText(p.card, (m) => moveDef(m)?.name ?? m) }));

export class OverworldScene extends BaseScene {
  constructor(app: App) {
    super('Overworld', app);
  }

  create(): void {
    const { step } = this.app.flow.state;
    if (step === 'cardTutorial') {
      this.stubFrame('CARD TUTORIAL');
      new MenuList(this, this.app, {
        id: 'tutorial-card',
        items: STUB_CARDS.map((c) => c.label),
        x: 24,
        y: 40,
        width: 272,
        rowHeight: 16,
        onConfirm: (i) => {
          const card = STUB_CARDS[i];
          if (card) this.send({ type: 'cardChosen', cardId: card.id });
        },
      });
    } else {
      this.stubFrame('OVERWORLD');
      const box = new DialogueBox(this, this.app);
      void box.say('You walk from the lab, down the path, to the Deprecated Forest trailhead.').then(() =>
        this.send({ type: 'reachedTrailhead' }),
      );
    }
    this.ready();
  }
}
