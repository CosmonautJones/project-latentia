// Distill (plan step 6; Rulings 145 and 147): after beating the wild Tokenibble, a two-option choice. Spin up
// (recommended) adds it as a subagent at its wild level, L3, with one card slot; Graft puts its signature, Token
// Nibble, on the starter's grid. Each option has one plain line on what it means. There is no going back from here
// (B does nothing), but the choice is made in one press and saved by the flow.

import type Phaser from 'phaser';
import type { App } from '../app.js';
import { CreatureSprite } from '../battle-ui/creature-sprite.js';
import { DISTILL_CHOICES as DISTILL_TEXT, DISTILL_INTRO, DISTILL_TITLE } from '../content/journey-text.js';
import { DISTILL_CHOICES } from '../flow/flow.js';
import type { Layout } from '../layout/viewport.js';
import { ChoicePanel } from '../ui/choice-panel.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

/** The trailhead floor along the bottom of the safe area: where the scene's creatures stand. */
export function drawFloor(scene: Phaser.Scene, l: Layout): { objects: Phaser.GameObjects.GameObject[]; floor: number } {
  const g = scene.add.graphics().setDepth(-2);
  const floor = l.safe.y + l.safe.height - 6;
  g.fillStyle(COLOR.ink).fillRect(0, 0, l.logical.width, l.logical.height);
  g.fillStyle(COLOR.night).fillRect(0, floor - 24, l.logical.width, l.logical.height - floor + 24);
  return { objects: [g], floor };
}

export class DistillScene extends BaseScene {
  private statics: Phaser.GameObjects.GameObject[] = [];

  constructor(app: App) {
    super('Distill', app);
  }

  create(): void {
    this.statics = [];
    this.draw(this.layout);
    this.onRelayout((l) => this.draw(l));
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

  private draw(l: Layout): void {
    for (const o of this.statics) o.destroy();
    // The trailhead's floor, and the powered-down Tokenibble sitting on it.
    const { objects, floor } = drawFloor(this, l);
    const cx = l.safe.x + Math.floor(l.safe.width / 2);
    const shadow = this.add.graphics().setDepth(-1);
    shadow.fillStyle(COLOR.slate).fillEllipse(cx, floor - 2, 64, 10);
    const tok = new CreatureSprite(this, cx, floor, 'tokenibble', false);
    tok.sprite.setAlpha(0.85).setDepth(-1);
    this.statics = [...objects, shadow, tok.sprite];
  }
}
