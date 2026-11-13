// The battlefield (plan v0.1 Q2): the foe up and to the right with its panel and telegraph box top left, your side down
// and to the left (your subagent just behind your starter) with the panels beside or under them, and the temperature
// dial only when the fight's disclosure allows it (V12). Where each goes comes from stage-layout.ts; `relayout` moves
// everything in place, so a rotation mid-round keeps every bar and tween. `apply` plays one UI step.

import Phaser from 'phaser';
import type { Temperature } from '@latentia/engine';
import type { Disclosure } from '../battle/disclosure.js';
import type { UiStep } from '../battle/event-steps.js';
import type { FoePlan, Plan } from '../battle/plans.js';
import type { BattleSession, CreatureView } from '../battle/session.js';
import type { Layout } from '../layout/viewport.js';
import { COLOR } from '../ui/palette.js';
import { CreaturePanel } from './creature-panel.js';
import { CreatureSprite } from './creature-sprite.js';
import { PlanBox } from './plan-box.js';
import { artReach, battleGeometry, type BattleGeometry, type GeometryOptions, type SlotName } from './stage-layout.js';
import { TemperatureDial } from './temperature-dial.js';

interface Slot {
  readonly name: SlotName;
  index: number;
  readonly sprite: CreatureSprite;
  readonly panel: CreaturePanel;
  readonly plan: PlanBox | null;
}

const slotFor = (v: CreatureView): SlotName => (v.side === 1 ? (v.isOrchestrator ? 'foe' : 'foeSub') : v.isOrchestrator ? 'player' : 'playerSub');

const wait = (scene: Phaser.Scene, ms: number): Promise<void> =>
  new Promise((resolve) => {
    if (ms <= 0) resolve();
    else scene.time.delayedCall(ms, () => resolve());
  });

export class BattleStage {
  private readonly slots: Slot[] = [];
  private readonly dial: TemperatureDial | null;
  private plans: readonly Plan[] = [];
  private revealed: Set<number> = new Set();
  private numbers = false;
  private geo: BattleGeometry;
  private readonly backdrop: Phaser.GameObjects.Graphics;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly session: BattleSession,
    layout: Layout,
    private readonly disclosure: Disclosure,
  ) {
    this.geo = battleGeometry(layout, this.options());
    this.backdrop = scene.add.graphics();
    this.drawBackdrop(layout);
    const views = session.creatures();
    // The subagent stands behind the starter: add it first, so the starter is drawn over it.
    const order = [...views].sort((a, b) => Number(a.isOrchestrator) - Number(b.isOrchestrator));
    for (const v of order) {
      if (!v.onField || this.slots.some((s) => s.name === slotFor(v))) continue;
      const def = this.geo.slots[slotFor(v)];
      const sprite = new CreatureSprite(scene, def.sprite.x, def.sprite.y, v.speciesId, v.side === 0);
      const panel = new CreaturePanel(scene, def.panel, def.variant, v);
      const plan = v.side === 1 && disclosure.foeTelegraph ? new PlanBox(scene, v.isOrchestrator ? this.geo.foePlan : this.geo.foeSubPlan) : null;
      if (v.fainted) sprite.setFainted();
      this.slots.push({ name: slotFor(v), index: v.index, sprite, panel, plan });
    }
    const p = this.geo.slots.player.panel;
    this.dial = disclosure.temperature ? new TemperatureDial(scene, p.x + p.width - 28, p.y - 30) : null;
  }

  /** The layout's options: whether a subagent fights on the player's side, and how many moves the list holds. */
  options(): GeometryOptions {
    const views = this.session.creatures();
    const mate = this.disclosure.teammateTelegraph && views.some((c) => c.side === 0 && !c.isOrchestrator && c.onField);
    const foe = views.find((c) => c.side === 1 && c.isOrchestrator);
    return { mate, moves: this.session.moveOptions().length, foeReach: artReach(foe?.speciesId ?? '') };
  }

  get geometry(): BattleGeometry {
    return this.geo;
  }

  /** Lay the field out for a new layout, in place: sprites, panels, telegraphs, the dial and the backdrop. */
  relayout(layout: Layout): void {
    this.geo = battleGeometry(layout, this.options());
    this.drawBackdrop(layout);
    for (const s of this.slots) {
      const def = this.geo.slots[s.name];
      s.sprite.setHome(def.sprite.x, def.sprite.y);
      s.panel.place(def.panel);
      s.plan?.place(s.name === 'foe' ? this.geo.foePlan : this.geo.foeSubPlan);
    }
    const p = this.geo.slots.player.panel;
    this.dial?.moveTo(p.x + p.width - 28, p.y - 30);
  }

  private drawBackdrop(layout: Layout): void {
    const { slots, height, floorY } = this.geo;
    const W = layout.logical.width;
    const g = this.backdrop.clear();
    g.fillStyle(COLOR.ink).fillRect(0, 0, W, layout.logical.height);
    g.fillStyle(COLOR.night).fillRect(0, floorY, W, height - floorY);
    // A dithered horizon between sky and floor.
    for (let y = floorY - 6; y < floorY; y++) for (let x = (y * 3) % 4; x < W; x += y < floorY - 3 ? 4 : 2) g.fillRect(x, y, 1, 1);
    // The platforms the creatures stand on, centred under their feet.
    const platform = (x: number, y: number, w: number) => {
      g.fillStyle(COLOR.slate).fillEllipse(x, y + 1, w + 8, 14);
      g.fillStyle(COLOR.steel).fillEllipse(x, y, w, 10);
    };
    platform(slots.foe.sprite.x, slots.foe.sprite.y, 96);
    const sub = this.slots.some((s) => s.name === 'playerSub');
    if (sub) platform(slots.playerSub.sprite.x, slots.playerSub.sprite.y, 80);
    platform(slots.player.sprite.x, slots.player.sprite.y, 96);
  }

  private slotOf(index: number): Slot | undefined {
    return this.slots.find((s) => s.index === index);
  }

  /** The plans for the coming round: each foe's telegraph box shows its line (the teammate's plan is the band's). */
  setPlans(plans: readonly Plan[], revealed: ReadonlySet<number>): void {
    this.plans = plans;
    this.revealed = new Set(revealed);
    this.drawPlans();
  }

  /** NUMBERS: the telegraph shows the damage range instead of "~N". */
  setNumbers(on: boolean): void {
    this.numbers = on;
    this.drawPlans();
  }

  /** The telegraph lines as on screen, for the dev probe: "foe: ATTACK ~6 → SAGELET", "mate: EARLY EXIT → VIBRAT". */
  planLines(): { actor: number; line: string }[] {
    return this.plans.flatMap((p) => {
      if (p.kind === 'mate') return [{ actor: p.actor, line: `${p.line} (${p.card})` }];
      const box = this.slotOf(p.actor)?.plan;
      return box === undefined || box === null ? [] : [{ actor: p.actor, line: box.text() }];
    });
  }

  private drawPlans(): void {
    for (const s of this.slots) {
      if (s.plan === null) continue;
      const plan = this.plans.find((p): p is FoePlan => p.kind === 'foe' && p.actor === s.index);
      s.plan.show(plan ?? null, this.revealed.has(s.index), this.numbers);
    }
  }

  /** The actor's action starts: its telegraph has done its job. */
  private planDone(actor: number): void {
    this.plans = this.plans.filter((p) => p.actor !== actor);
    this.drawPlans();
  }

  setTemperature(t: Temperature): void {
    this.dial?.set(t);
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
      case 'actor':
        this.planDone(step.actor);
        await wait(this.scene, ms);
        return;
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
      case 'reveal':
        // Socratic Method and friends: the telegraph shows this foe's exact move for the rest of the round.
        if (step.bySide === 0 && step.what === 'nextIntent' && this.session.sideOf(step.target) === 1) {
          this.revealed.add(step.target);
          this.drawPlans();
        }
        return;
      // Text is the command box's; the round's IntentsPlanned keeps the telegraphs shown before it; the rest carry no
      // picture of their own.
      default:
        await wait(this.scene, ms);
    }
  }
}
