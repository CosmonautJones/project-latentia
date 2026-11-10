// The battlefield at 320×180 (bible "battle UI that works in landscape and portrait"): the foe up and to the right
// with its panel top-left and its intent under the panel, the player's side bottom-left with its panel (and the
// temperature dial) bottom-right, and a subagent's intent floating over its sprite. `apply` plays one UI step.

import Phaser from 'phaser';
import type { Intent, Temperature } from '@latentia/engine';
import type { UiStep } from '../battle/event-steps.js';
import { intentLine } from '../battle/intent-visibility.js';
import type { BattleSession, CreatureView } from '../battle/session.js';
import { GAME_WIDTH } from '../layout/compute.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';
import { CreaturePanel, type PanelVariant } from './creature-panel.js';
import { CreatureSprite } from './creature-sprite.js';
import { TemperatureDial } from './temperature-dial.js';

/** Bottom edges of sprites (feet sit 6 px above), panel corners, intent anchors. */
const SLOTS = {
  foe: { sprite: { x: 248, y: 74 }, panel: { x: 6, y: 6 }, variant: 'foe', intent: { x: 6, y: 40, align: 'left', chars: 32 } },
  foeSub: { sprite: { x: 188, y: 64 }, panel: { x: 6, y: 52 }, variant: 'foe', intent: { x: 6, y: 84, align: 'left', chars: 28 } },
  player: { sprite: { x: 64, y: 140 }, panel: { x: 188, y: 90 }, variant: 'player', intent: null },
  playerSub: { sprite: { x: 136, y: 142 }, panel: { x: 188, y: 72 }, variant: 'sub', intent: { x: 136, y: 62, align: 'center', chars: 24 } },
} as const satisfies Record<string, { sprite: { x: number; y: number }; panel: { x: number; y: number }; variant: PanelVariant; intent: unknown }>;

type SlotName = keyof typeof SLOTS;

interface Slot {
  readonly name: SlotName;
  index: number;
  readonly sprite: CreatureSprite;
  readonly panel: CreaturePanel;
  readonly intent: Phaser.GameObjects.BitmapText | null;
}

const slotFor = (v: CreatureView): SlotName => (v.side === 1 ? (v.isOrchestrator ? 'foe' : 'foeSub') : v.isOrchestrator ? 'player' : 'playerSub');

const wait = (scene: Phaser.Scene, ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) resolve();
    else scene.time.delayedCall(ms, () => resolve());
  });

export class BattleStage {
  private readonly slots: Slot[] = [];
  readonly dial: TemperatureDial;
  /** The intents last shown, and the foes the player can see this round (hidden "?" otherwise). */
  private intents: readonly Intent[] = [];
  private revealed: Set<number> = new Set();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: BattleSession,
  ) {
    this.drawBackdrop();
    for (const v of session.creatures()) {
      if (!v.onField || this.slots.some((s) => s.name === slotFor(v))) continue;
      const def = SLOTS[slotFor(v)];
      const sprite = new CreatureSprite(scene, def.sprite.x, def.sprite.y, v.speciesId, v.side === 0);
      const panel = new CreaturePanel(scene, def.panel.x, def.panel.y, def.variant, v);
      const intent = def.intent === null ? null : addPixelText(scene, def.intent.x, def.intent.y, '', { color: v.side === 1 ? COLOR.amber : COLOR.cyan });
      if (v.fainted) sprite.setFainted();
      this.slots.push({ name: slotFor(v), index: v.index, sprite, panel, intent });
    }
    const p = SLOTS.player.panel;
    this.dial = new TemperatureDial(scene, p.x + 93, p.y + 10);
  }

  private drawBackdrop(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(COLOR.ink).fillRect(0, 0, GAME_WIDTH, 136);
    g.fillStyle(COLOR.night).fillRect(0, 40, GAME_WIDTH, 96);
    // A dithered horizon between sky and floor.
    for (let y = 34; y < 40; y++) for (let x = (y * 3) % 4; x < GAME_WIDTH; x += y < 37 ? 4 : 2) g.fillRect(x, y, 1, 1);
    g.fillStyle(COLOR.slate).fillEllipse(SLOTS.foe.sprite.x, SLOTS.foe.sprite.y - 6, 92, 14);
    g.fillStyle(COLOR.steel).fillEllipse(SLOTS.foe.sprite.x, SLOTS.foe.sprite.y - 7, 84, 10);
    g.fillStyle(COLOR.slate).fillEllipse(SLOTS.player.sprite.x + 30, SLOTS.player.sprite.y - 4, 150, 18);
    g.fillStyle(COLOR.steel).fillEllipse(SLOTS.player.sprite.x + 30, SLOTS.player.sprite.y - 5, 140, 12);
  }

  private slotOf(index: number): Slot | undefined {
    return this.slots.find((s) => s.index === index);
  }

  /**
   * The preview of what every deck-driven creature on the field plans: the player's subagents in full, a foe as "?"
   * unless the player's side has revealed it (ruling V2).
   */
  setIntents(intents: readonly Intent[], revealed: ReadonlySet<number> = this.revealed): void {
    this.intents = intents;
    this.revealed = new Set(revealed);
    this.drawIntents();
  }

  /** The intent lines as on screen, for the dev probe. */
  intentLines(): { actor: number; line: string }[] {
    return this.intents.map((i) => ({ actor: i.actor, line: this.lineFor(i, 40) }));
  }

  private lineFor(intent: Intent, chars: number): string {
    const ctx = { shortName: (i: number) => this.session.shortName(i), moveName: (m: string) => this.session.moveName(m) };
    return intentLine(intent, ctx, (i) => this.session.sideOf(i), this.revealed, chars);
  }

  private drawIntents(): void {
    for (const s of this.slots) {
      if (s.intent === null) continue;
      const def = SLOTS[s.name].intent;
      const intent = this.intents.find((i) => i.actor === s.index);
      if (intent === undefined || def === null) {
        s.intent.setText('');
        continue;
      }
      const text = `▶${this.lineFor(intent, def.chars - 1)}`;
      s.intent.setText(text);
      if (def.align === 'center') s.intent.setX(def.x - Math.floor(textWidth(text) / 2));
    }
  }

  setTemperature(t: Temperature): void {
    this.dial.set(t);
  }

  /** Match every panel and sprite to the engine state (after each round, in case a step was squeezed to nothing). */
  sync(views: readonly CreatureView[]): void {
    for (const s of this.slots) {
      const v = views[s.index];
      if (v === undefined) continue;
      s.panel.bind(v);
      if (v.fainted) s.sprite.setFainted();
    }
  }

  async apply(step: UiStep, ms: number): Promise<void> {
    switch (step.kind) {
      case 'windup':
        await (this.slotOf(step.actor)?.sprite.windup(ms) ?? wait(this.scene, ms));
        return;
      case 'hit': {
        const slot = this.slotOf(step.target);
        slot?.sprite.flashOn();
        await wait(this.scene, ms);
        slot?.sprite.flashOff();
        return;
      }
      case 'hp':
        await (this.slotOf(step.target)?.panel.setHp(step.hp, ms) ?? wait(this.scene, ms));
        return;
      case 'status':
        this.slotOf(step.target)?.panel.setStatus(step.status, step.on);
        await wait(this.scene, ms);
        return;
      case 'drift':
        this.slotOf(step.target)?.panel.setDrift(step.drift);
        await wait(this.scene, ms);
        return;
      case 'context':
        this.slotOf(step.target)?.panel.setContext(step.used);
        await wait(this.scene, ms);
        return;
      case 'faint': {
        const slot = this.slotOf(step.target);
        slot?.panel.setFainted();
        await (slot?.sprite.faint(ms) ?? wait(this.scene, ms));
        return;
      }
      case 'swap': {
        const slot = this.slotOf(step.out);
        const incoming = this.session.creatures()[step.in];
        if (slot !== undefined && incoming !== undefined) {
          slot.index = step.in;
          slot.sprite.setSpecies(incoming.speciesId);
          slot.panel.bind(incoming);
        }
        await wait(this.scene, ms);
        return;
      }
      case 'intents':
        this.setIntents(step.intents);
        return;
      case 'reveal':
        // Socratic Method and friends: the player sees this foe's move for the rest of the round.
        if (step.bySide === 0 && step.what === 'nextIntent' && this.session.sideOf(step.target) === 1) {
          this.revealed.add(step.target);
          this.drawIntents();
        }
        return;
      // Text is the command box's; the rest carry no picture of their own.
      default:
        await wait(this.scene, ms);
    }
  }
}
