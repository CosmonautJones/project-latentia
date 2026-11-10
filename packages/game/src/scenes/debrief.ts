// The debrief after every Bootcamp Grad fight (plan step 8, the core loop: lose → teach → rematch). It reads the last
// fight from the flow, so Continue reopens it. A loss on the spin-up path shows what Tokenibble kept doing and offers
// a card swap then a rematch, or a rematch as is; a win offers the end card, or "try a different card?"; the graft path
// gets the grafted-move hint and a rematch. The card picker's B goes back to the options.

import type { App } from '../app.js';
import { CreatureSprite } from '../battle-ui/creature-sprite.js';
import { TOKENIBBLE_PRESETS } from '../content/trainers.js';
import { debriefFor, type Debrief } from '../journey/debrief.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { ChoicePanel } from '../ui/choice-panel.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

export class DebriefScene extends BaseScene {
  private panel: ChoicePanel | null = null;

  constructor(app: App) {
    super('Debrief', app);
  }

  create(): void {
    const state = this.app.flow.state;
    const g = this.add.graphics();
    g.fillStyle(COLOR.ink).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(COLOR.night).fillRect(0, GAME_HEIGHT - 30, GAME_WIDTH, 30);
    new CreatureSprite(this, GAME_WIDTH - 48, GAME_HEIGHT - 8, 'vibrat', false);
    if (state.distill === 'spinUp') new CreatureSprite(this, 48, GAME_HEIGHT - 8, 'tokenibble', true);
    this.panel = null;
    this.showOptions(debriefFor(state, TOKENIBBLE_PRESETS));
    this.ready();
  }

  private open(panel: ChoicePanel): void {
    this.panel?.destroy();
    this.panel = panel;
  }

  private showOptions(d: Debrief): void {
    this.open(
      new ChoicePanel(this, this.app, {
        id: 'debrief',
        title: d.title,
        body: d.lines,
        items: d.options.map((o) => ({ label: o.label })),
        onConfirm: (i) => {
          const o = d.options[i];
          if (o?.kind === 'event') this.send(o.event);
          else if (o?.kind === 'pickCard') this.showCards(d);
        },
      }),
    );
  }

  private showCards(d: Debrief): void {
    this.open(
      new ChoicePanel(this, this.app, {
        id: 'swap-card',
        title: 'TEACH TOKENIBBLE A CARD, THEN REMATCH',
        body: ['B: back.'],
        items: d.cards.map((c) => ({ label: c.label, detail: c.detail })),
        onConfirm: (i) => {
          const card = d.cards[i];
          if (card) this.send({ type: 'rematch', cardId: card.id });
        },
        onCancel: () => this.showOptions(d),
      }),
    );
  }
}
