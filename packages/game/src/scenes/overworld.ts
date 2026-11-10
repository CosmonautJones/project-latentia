// Overworld (stub): the walk to the trailhead, and the card tutorial menu over it. P3 builds the real map and
// P4 the real card presets; the ids below are placeholders.

import type { App } from '../app.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { MenuList } from '../ui/menu-list.js';
import { BaseScene } from './base-scene.js';

const STUB_CARDS = [
  { id: 'tutorial.a', label: 'IF foe HP < 50% THEN attack' },
  { id: 'tutorial.b', label: 'IF my HP < 30% THEN guard' },
  { id: 'tutorial.c', label: 'IF context full THEN rest' },
] as const;

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
