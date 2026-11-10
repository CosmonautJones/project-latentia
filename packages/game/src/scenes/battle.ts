// Battle: runs the flow step's BattleDef through a BattleSession. Each round: preview intents, take the player's
// command from the menu (canvas in landscape, the band in portrait), submit it, and play the events back in order
// within the round budget. The result goes to the flow: a win moves on, a loss restarts the fight. The distill
// choice after the wild win is still the P1 stub (P4 builds it).

import type { Temperature } from '@latentia/engine';
import type { App } from '../app.js';
import { initialMenu, menuStep, menuView, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { mapEvents, type UiStep } from '../battle/event-steps.js';
import { formatIntent } from '../battle/intent-text.js';
import type { BattlePhase, BattleResultProbe } from '../battle/probe.js';
import { battleResult } from '../battle/result.js';
import { BattleSession, type PlayerChoice } from '../battle/session.js';
import { timeline } from '../battle/timeline.js';
import { BandMenu } from '../battle-ui/band-menu.js';
import { CommandBox, type BoxModel } from '../battle-ui/command-box.js';
import { BattleStage } from '../battle-ui/stage.js';
import { battleForStep, type BattleDef } from '../content/battles.js';
import type { InputAction } from '../input/hub.js';
import { addPixelText } from '../text/phaser-font.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const COMMAND_ERRORS: Readonly<Record<string, string>> = {
  moveDisabled: "A status won't allow that move right now.",
  illegalTarget: "That target isn't valid right now.",
  actorSkipped: 'Busy releasing a charged move this round.',
};

export class BattleScene extends BaseScene {
  private def!: BattleDef;
  private session!: BattleSession;
  private stage!: BattleStage;
  private box!: CommandBox;
  private band!: BandMenu;
  private dialogue!: DialogueBox;
  private menu: BattleMenuState = initialMenu();
  private phase: BattlePhase = 'intro';
  private alive = false;
  private whyFresh = false;
  private roundMs: number[] = [];
  private result: BattleResultProbe | null = null;

  constructor(app: App) {
    super('Battle', app);
  }

  create(): void {
    const state = this.app.flow.state;
    if (state.step === 'distill') {
      this.distillStub();
      this.ready();
      return;
    }
    const def = battleForStep(state);
    if (def === null) throw new Error(`no battle for step ${state.step}`);
    this.def = def;
    this.session = BattleSession.start(def);
    this.menu = initialMenu();
    this.phase = 'intro';
    this.whyFresh = false;
    this.roundMs = [];
    this.result = null;
    this.alive = true;

    this.stage = new BattleStage(this, this.session);
    this.box = new CommandBox(this, this.app);
    this.band = new BandMenu(this.app.screen.bandPanel, this.app);
    this.dialogue = new DialogueBox(this, this.app);
    this.stage.setIntents(this.session.intents());
    this.box.render({ kind: 'message', text: '' });

    this.listen((a) => this.onInput(a));
    const offLayout = this.app.screen.onLayout(() => this.renderMenu());
    this.events.once('shutdown', () => {
      this.alive = false;
      offLayout();
      this.band.destroy();
      this.app.probe.battle = null;
    });
    this.ready();
    this.publish();
    void this.intro();
  }

  private async intro(): Promise<void> {
    if (this.app.flow.state.attempt > 0) await this.dialogue.say(`Attempt ${this.app.flow.state.attempt + 1}. ${this.def.intro}`);
    else await this.dialogue.say(this.def.intro);
    if (this.alive) this.nextRound();
  }

  /** Ask for the next command, or play a round the player has no say in, or finish. */
  private nextRound(): void {
    if (!this.alive) return;
    if (this.session.ended) {
      void this.finish();
      return;
    }
    this.stage.setIntents(this.session.intents());
    const pass = this.session.passReason();
    if (pass !== null) {
      const me = this.session.name(this.session.playerIndex);
      void this.play(this.session.pass(this.menu.temperature), pass === 'charging' ? `${me} is still thinking...` : `${me} is offline. The subagents fight on!`);
      return;
    }
    this.phase = 'command';
    this.menu = { ...this.menu, screen: 'root', rootIndex: 0 };
    this.renderMenu();
  }

  private menuData(): MenuData {
    return {
      moves: this.session.moveOptions(),
      targets: (id) => this.session.targetsFor(id),
      targetName: (i) => this.session.shortName(i),
    };
  }

  private onInput(a: InputAction): void {
    if (this.phase !== 'command') return;
    const r = menuStep(this.menu, a, this.menuData());
    this.menu = r.state;
    const e = r.effect;
    if (e?.kind === 'submit') {
      void this.submit(e.choice);
      return;
    }
    if (e?.kind === 'why') {
      void this.showWhy();
      return;
    }
    this.renderMenu();
  }

  private renderMenu(): void {
    if (!this.alive) return;
    const showing = this.phase === 'command';
    this.stage.setTemperature((this.menu.screen === 'temp' && showing ? this.menu.tempIndex : this.menu.temperature) as Temperature);
    if (!showing) {
      this.app.probe.menu = null;
      this.band.render({ kind: 'message', text: '' });
      this.publish();
      return;
    }
    const data = this.menuData();
    const model: BoxModel = {
      kind: 'menu',
      menu: this.menu,
      data,
      prompt: `What will ${this.session.shortName(this.session.playerIndex)} do?`,
      buttons: this.app.screen.layout().mode === 'landscape',
      whyFresh: this.whyFresh,
    };
    this.box.render(model);
    this.band.render(model);
    this.app.probe.menu = menuView(this.menu, data);
    this.publish();
  }

  private setPhase(phase: BattlePhase): void {
    this.phase = phase;
    this.renderMenu();
  }

  private async showWhy(): Promise<void> {
    this.setPhase('why');
    this.whyFresh = false;
    const lines = this.session.explainLatestTraces();
    const text = lines.length === 0 ? 'Nothing has run from a deck yet. Every intent above comes from a deck: watch it play out.' : lines.join(' ');
    await this.dialogue.say(text, { closeOnB: true });
    if (!this.alive) return;
    this.setPhase('command');
  }

  private async submit(choice: PlayerChoice): Promise<void> {
    const r = this.session.submit(choice);
    if (!r.ok) {
      this.setPhase('playback');
      this.box.render({ kind: 'message', text: COMMAND_ERRORS[r.error.code] ?? "That command didn't go through." });
      await this.wait(900);
      if (this.alive) this.setPhase('command');
      return;
    }
    await this.playEvents(r.events);
  }

  private async play(r: ReturnType<BattleSession['pass']>, opening: string): Promise<void> {
    this.setPhase('playback');
    this.box.render({ kind: 'message', text: opening });
    await this.wait(400);
    if (!this.alive) return;
    if (!r.ok) throw new Error(`pass round rejected: ${r.error.message}`);
    await this.playEvents(r.events);
  }

  /** Every step in order, each finishing on a running deadline so frame rounding never adds up. */
  private async playEvents(events: Parameters<typeof mapEvents>[0]): Promise<void> {
    this.setPhase('playback');
    const steps = mapEvents(events, { name: (i) => this.session.name(i), moveName: (m) => this.session.moveName(m) });
    const start = this.time.now;
    let deadline = start;
    for (const { step, ms } of timeline(steps, this.menu.speed)) {
      if (!this.alive) return;
      deadline += ms;
      await this.applyStep(step, Math.max(0, deadline - this.time.now));
    }
    if (!this.alive) return;
    this.roundMs.push(Math.round(this.time.now - start));
    this.stage.sync(this.session.creatures());
    this.nextRound();
  }

  private async applyStep(step: UiStep, ms: number): Promise<void> {
    if (step.kind === 'text') {
      this.box.render({ kind: 'message', text: step.text });
      await this.wait(ms);
      return;
    }
    if (step.kind === 'trace') this.whyFresh = true;
    await this.stage.apply(step, ms);
  }

  private async finish(): Promise<void> {
    this.setPhase('result');
    const outcome = this.session.outcome ?? 'draw';
    const team = this.session.traceSummary(0);
    this.result = { outcome, rounds: this.session.round, traceSummary: this.session.traceSummary() };
    this.publish();
    const r = battleResult(this.def, outcome, team);
    this.box.render({ kind: 'message', text: '' });
    await this.dialogue.say(r.text);
    if (this.alive) this.send(r.event);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => (ms <= 0 ? resolve() : this.time.delayedCall(ms, () => resolve())));
  }

  /** Mirror the battle for the dev hook. */
  private publish(): void {
    if (!this.alive) return;
    const ictx = { shortName: (i: number) => this.session.shortName(i), moveName: (m: string) => this.session.moveName(m) };
    this.app.probe.battle = {
      id: this.def.id,
      phase: this.phase,
      round: this.session.round,
      temperature: this.menu.temperature,
      speed: this.menu.speed,
      moves: this.session.moveOptions().map((m) => ({ moveId: m.moveId, cost: m.cost, affordable: m.affordable, damaging: m.power !== null })),
      intents: this.session.intents().map((i) => `${this.session.name(i.actor)}: ${formatIntent(i, ictx, 40)}`),
      why: this.session.explainLatestTraces().join(' ') || null,
      roundMs: [...this.roundMs],
      result: this.result,
    };
  }

  /** P1's distill stub, until P4's distill screen. */
  private distillStub(): void {
    this.stubFrame('DISTILL TOKENIBBLE');
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
  }
}
