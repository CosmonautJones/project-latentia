// Battle: runs the flow step's BattleDef through a BattleSession. Each round: preview intents (foes hidden unless
// revealed), take the player's command from the menu (drawn and tapped in the game image), submit it, and
// play the events back on the round plan: animation within the 1.5 s budget, each line on screen for its dwell.
// One-time hints introduce each element. The result goes to the flow with the fight's report: a rival or wild loss
// restarts the fight, a trainer result opens the debrief (scenes/debrief.ts).

import type { Temperature } from '@latentia/engine';
import type { App } from '../app.js';
import { initialMenu, menuStep, menuView, type BattleMenuState, type MenuData } from '../battle/battle-menu.js';
import { disclosureFor, type Disclosure } from '../battle/disclosure.js';
import { cardLine, plansFor, type MatePlan, type Plan } from '../battle/plans.js';
import { mapEvents, type UiStep } from '../battle/event-steps.js';
import { dueRoundHint, HINTS, type HintId } from '../battle/hints.js';
import { COMMAND_ERRORS, WHY_EMPTY } from '../battle/labels.js';
import type { BattlePhase, BattleResultProbe, RoundTiming } from '../battle/probe.js';
import { battleResult } from '../battle/result.js';
import { BattleSession, type PlayerChoice, type RoundResult } from '../battle/session.js';
import { planRound } from '../battle/timeline.js';
import { CommandBox, type BoxModel } from '../battle-ui/command-box.js';
import { BattleStage } from '../battle-ui/stage.js';
import { battleForStep, type BattleDef } from '../content/battles.js';
import type { InputAction } from '../input/hub.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { BaseScene } from './base-scene.js';

/**
 * The dev probe exists only where the dev hook does (dev/hook.ts shouldExposeHook). Written as the static env check,
 * so a production build folds it to false and drops the bookkeeping.
 */
const PROBE = import.meta.env.DEV || import.meta.env.MODE === 'test';
const LOG_LINES = 40;

export class BattleScene extends BaseScene {
  private def!: BattleDef;
  private session!: BattleSession;
  private stage!: BattleStage;
  private box!: CommandBox;
  private dialogue!: DialogueBox;
  private disclosure!: Disclosure;
  /** The plans shown for the coming round (the foe's telegraph, the subagent's plan). */
  private plans: Plan[] = [];
  /** Survives a lose → restart (the scene instance is reused): speed and temperature stay as the player left them. */
  private menu: BattleMenuState = initialMenu();
  private phase: BattlePhase = 'intro';
  /** Bumped on every create and shutdown; async work from an older run sees a different value and stops. */
  private generation = 0;
  private whyFresh = false;
  private log: string[] = [];
  private roundMs: RoundTiming[] = [];
  private result: BattleResultProbe | null = null;

  constructor(app: App) {
    super('Battle', app);
  }

  create(): void {
    const gen = ++this.generation;
    const state = this.app.flow.state;
    const def = battleForStep(state);
    if (def === null) throw new Error(`no battle for step ${state.step}`);
    this.def = def;
    this.session = BattleSession.start(def);
    this.menu = initialMenu(this.menu.temperature, this.menu.speed, this.menu.numbers);
    this.disclosure = disclosureFor(def.id, this.app.flow.unlocks);
    this.phase = 'intro';
    this.whyFresh = false;
    this.log = [];
    this.roundMs = [];
    this.result = null;

    this.stage = new BattleStage(this, this.session, this.layout, this.disclosure);
    this.stage.setNumbers(this.menu.numbers);
    this.box = new CommandBox(this, this.app, () => this.stage.geometry);
    this.dialogue = new DialogueBox(this, this.app);
    this.showPlans();
    this.box.render({ kind: 'message', text: '' });

    this.listen((a) => this.onInput(a));
    // A rotation lays the field and the box out again in place: the round, the menu and an armed move all stay.
    this.onRelayout((l) => {
      this.stage.relayout(l);
      this.box.relayout();
    });
    this.events.once('shutdown', () => {
      this.generation++;
      this.app.probe.battle = null;
    });
    this.ready();
    this.publish();
    void this.intro(gen);
  }

  private live(gen: number): boolean {
    return gen === this.generation;
  }

  private async intro(gen: number): Promise<void> {
    const attempt = this.app.flow.state.attempt;
    await this.dialogue.say(attempt > 0 ? `Attempt ${attempt + 1}. ${this.def.intro}` : this.def.intro);
    if (this.live(gen)) await this.nextRound(gen);
  }

  /** Ask for the next command, or play a round the player has no say in, or finish. */
  private async nextRound(gen: number): Promise<void> {
    if (!this.live(gen)) return;
    if (this.session.ended) {
      await this.finish(gen);
      return;
    }
    this.showPlans();
    const pass = this.session.passReason();
    if (pass !== null) {
      const me = this.session.name(this.session.playerIndex);
      await this.play(gen, this.session.pass(this.menu.temperature), pass === 'charging' ? `${me} is still thinking...` : `${me} is offline. The subagents fight on!`);
      return;
    }
    this.menu = { ...this.menu, screen: 'root', rootIndex: 0, armed: null };
    // At most one first-time hint per round, before the menu comes up.
    const ownIntent = this.mate() !== null;
    const foeIntent = this.plans.some((p) => p.kind === 'foe');
    const due = dueRoundHint((id) => this.app.flow.hasSeenHint(id), { whyFresh: this.whyFresh, ownIntent, foeIntent });
    if (due !== undefined) await this.hint(gen, due);
    if (!this.live(gen)) return;
    this.setPhase('command');
  }

  private async hint(gen: number, id: HintId): Promise<void> {
    this.setPhase('hint');
    await this.dialogue.say(HINTS[id], { closeOnB: true });
    this.app.flow.markHintSeen(id);
    if (this.live(gen)) this.setPhase('command');
  }

  /** The coming round's plans, read before the round (the telegraphs follow this fight's disclosure, V14). */
  private showPlans(): void {
    this.plans = plansFor(this.session).filter((p) => (p.kind === 'foe' ? this.disclosure.foeTelegraph : this.disclosure.teammateTelegraph));
    this.stage.setPlans(this.plans, this.session.revealedFoes());
  }

  private mate(): MatePlan | null {
    return this.plans.find((p): p is MatePlan => p.kind === 'mate') ?? null;
  }

  private menuData(): MenuData {
    const moves = this.session.moveOptions();
    const g = this.stage.geometry;
    const slots = g.rows * g.columns;
    return {
      moves,
      targets: (id) => this.session.targetsFor(id),
      targetName: (i) => this.session.shortName(i),
      log: this.log,
      tempUnlocked: this.disclosure.temperature,
      ...(moves.length > slots ? { pageSize: slots - 1 } : {}),
    };
  }

  private onInput(a: InputAction): void {
    if (this.phase !== 'command') return;
    const before = this.menu.screen;
    const r = menuStep(this.menu, a, this.menuData());
    this.menu = r.state;
    const e = r.effect;
    if (e?.kind === 'submit') {
      void this.submit(this.generation, e.choice);
      return;
    }
    if (e?.kind === 'why') {
      void this.showWhy(this.generation);
      return;
    }
    if (e?.kind === 'numbers') this.stage.setNumbers(e.numbers);
    this.renderMenu();
    // The first visit to the moves or the dial explains it.
    const opened = this.menu.screen !== before ? this.menu.screen : null;
    if (opened === 'moves' && !this.app.flow.hasSeenHint('battle.context')) void this.hint(this.generation, 'battle.context');
    if (opened === 'temp' && !this.app.flow.hasSeenHint('battle.temperature')) void this.hint(this.generation, 'battle.temperature');
  }

  private renderMenu(): void {
    const showing = this.phase === 'command' || this.phase === 'hint';
    this.stage.setTemperature((this.menu.screen === 'temp' && showing ? this.menu.tempIndex : this.menu.temperature) as Temperature);
    if (!showing) {
      this.app.probe.menu = null;
      this.publish();
      return;
    }
    const data = this.menuData();
    const model: BoxModel = {
      kind: 'menu',
      menu: this.menu,
      data,
      prompt: `What will ${this.session.shortName(this.session.playerIndex)} do?`,
      whyFresh: this.whyFresh,
      mate: this.mate(),
    };
    this.box.render(model);
    this.app.probe.menu = this.phase === 'command' ? menuView(this.menu, data) : null;
    this.publish();
  }

  private setPhase(phase: BattlePhase): void {
    this.phase = phase;
    this.renderMenu();
  }

  /** Post-hoc only: each deck-driven creature's last trace is from an action it has already taken. */
  private async showWhy(gen: number): Promise<void> {
    this.setPhase('why');
    this.whyFresh = false;
    const lines = this.session.explainLatestTraces();
    await this.dialogue.say(lines.length === 0 ? WHY_EMPTY : lines.join(' '), { closeOnB: true });
    if (this.live(gen)) this.setPhase('command');
  }

  private async submit(gen: number, choice: PlayerChoice): Promise<void> {
    const revealed = this.session.revealedFoes();
    const r = this.session.submit(choice);
    if (!r.ok) {
      this.setPhase('playback');
      this.box.render({ kind: 'message', text: COMMAND_ERRORS[r.error.code] ?? "That command didn't go through." });
      await this.wait(900);
      if (this.live(gen)) this.setPhase('command');
      return;
    }
    await this.playEvents(gen, r.events, revealed);
  }

  private async play(gen: number, r: RoundResult, opening: string): Promise<void> {
    const revealed = this.session.revealedFoes();
    this.setPhase('playback');
    this.box.render({ kind: 'message', text: opening });
    await this.wait(Math.round(600 / this.menu.speed));
    if (!this.live(gen)) return;
    if (!r.ok) throw new Error(`pass round rejected: ${r.error.message}`);
    await this.playEvents(gen, r.events, revealed);
  }

  /**
   * The round on its plan: each step starts at its planned time (measured from the round's start, so frame
   * rounding never adds up), and the round ends once the last line has had its dwell.
   */
  private async playEvents(gen: number, events: Parameters<typeof mapEvents>[0], revealed: ReadonlySet<number>): Promise<void> {
    this.setPhase('playback');
    void revealed;
    const round = this.session.round;
    const steps = mapEvents(events, { name: (i) => this.session.name(i), moveName: (m) => this.session.moveName(m), side: (i) => this.session.sideOf(i) });
    const plan = planRound(steps, this.menu.speed);
    const start = this.time.now;
    for (const { step, at, ms } of plan.steps) {
      await this.wait(start + at - this.time.now);
      if (!this.live(gen)) return;
      await this.applyStep(step, Math.max(0, start + at + ms - this.time.now), round);
      if (!this.live(gen)) return;
    }
    await this.wait(start + plan.totalMs - this.time.now);
    if (!this.live(gen)) return;
    if (PROBE) this.roundMs.push({ actualMs: Math.round(this.time.now - start), plannedMs: plan.totalMs, animMs: plan.animMs });
    this.stage.sync(this.session.creatures());
    await this.nextRound(gen);
  }

  private async applyStep(step: UiStep, ms: number, round: number): Promise<void> {
    if (step.kind === 'text') {
      this.box.render({ kind: 'message', text: step.text });
      this.log = [...this.log, `R${round} ${step.text}`].slice(-LOG_LINES);
      return;
    }
    if (step.kind === 'trace') {
      this.whyFresh = true;
      // The teammate's card was re-planned mid-round (its condition changed before it acted): say so.
      const planned = this.plans.find((p): p is MatePlan => p.kind === 'mate' && p.actor === step.trace.actor);
      if (planned !== undefined && planned.cardId !== step.trace.firedCardId) {
        const text = `${this.session.shortName(step.trace.actor)} RE-PLANNED: ${cardLine(this.session.deckOf(step.trace.actor), step.trace.firedCardId, (m) => this.session.moveName(m))}`;
        this.box.render({ kind: 'message', text });
        this.log = [...this.log, `R${round} ${text}`].slice(-LOG_LINES);
      }
    }
    await this.stage.apply(step, ms);
  }

  private async finish(gen: number): Promise<void> {
    this.setPhase('result');
    const outcome = this.session.outcome ?? 'draw';
    // The card taught for this fight: only Tokenibble on the spin-up path has one.
    const cardId = this.def.setup.a.active.length > 0 ? this.app.flow.state.tutorialCardId : null;
    const report = this.session.report(outcome, cardId);
    this.result = { outcome, rounds: this.session.round, report };
    this.publish();
    const r = battleResult(this.def, outcome, report);
    this.box.render({ kind: 'message', text: '' });
    await this.dialogue.say(r.text);
    if (this.live(gen)) this.send(r.event);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => (ms <= 0 ? resolve() : this.time.delayedCall(ms, () => resolve())));
  }

  /** Mirror the battle for the dev hook (dev and test builds only). */
  private publish(): void {
    if (!PROBE) return;
    this.app.probe.battle = {
      id: this.def.id,
      phase: this.phase,
      round: this.session.round,
      temperature: this.menu.temperature,
      speed: this.menu.speed,
      armed: this.menu.armed,
      moves: this.session.moveOptions().map((m) => ({ moveId: m.moveId, cost: m.cost, affordable: m.affordable, damaging: m.power !== null, power: m.power })),
      intents: this.stage.planLines().map((i) => `${this.session.name(i.actor)}: ${i.line}`),
      numbers: this.menu.numbers,
      band: this.box.lines(),
      disclosure: this.disclosure,
      why: this.session.explainLatestTraces().join(' ') || null,
      log: [...this.log],
      roundMs: [...this.roundMs],
      result: this.result,
    };
  }
}
