// The debrief after every Bootcamp Grad fight (plan step 8, the core loop: lose → teach → rematch). It reads the last
// fight from the flow, so Continue reopens it. A loss on the spin-up path shows what Tokenibble kept doing and offers
// a card swap then a rematch, or a rematch as is; a win offers the end card, or "try a different card?"; the graft path
// gets the grafted-move hint and a rematch. The card picker's B goes back to the options.

import type Phaser from 'phaser';
import type { App } from '../app.js';
import { CreatureSprite } from '../battle-ui/creature-sprite.js';
import { TOKENIBBLE_PRESETS } from '../content/trainers.js';
import { debriefFor, type Debrief } from '../journey/debrief.js';
import type { Layout } from '../layout/viewport.js';
import { ChoicePanel } from '../ui/choice-panel.js';
import { BaseScene } from './base-scene.js';
import { drawFloor } from './distill.js';

export class DebriefScene extends BaseScene {
  private panel: ChoicePanel | null = null;
  private statics: Phaser.GameObjects.GameObject[] = [];

  constructor(app: App) {
    super('Debrief', app);
  }

  create(): void {
    this.statics = [];
    this.draw(this.layout);
    this.onRelayout((l) => this.draw(l));
    this.panel = null;
    this.showOptions(debriefFor(this.app.flow.state, TOKENIBBLE_PRESETS));
    this.ready();
  }

  private draw(l: Layout): void {
    for (const o of this.statics) o.destroy();
    const { objects, floor } = drawFloor(this, l);
    const grad = new CreatureSprite(this, l.safe.x + l.safe.width - 48, floor, 'vibrat', false);
    const sprites = [grad.sprite];
    if (this.app.flow.state.distill === 'spinUp') sprites.push(new CreatureSprite(this, l.safe.x + 48, floor, 'tokenibble', true).sprite);
    for (const s of sprites) s.setDepth(-1);
    this.statics = [...objects, ...sprites];
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
