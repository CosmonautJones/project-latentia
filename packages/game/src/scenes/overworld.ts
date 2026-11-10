// Overworld: the walk from Prof. Epoch's lab through Localhost to the Deprecated Forest trailhead (plan task P3).
// Grid movement with the walker, collision, A to read and talk, the lab door warps, and the two triggers: the wild
// patch (first walk only) and Bootcamp Grad's sight (after the distill). Everything that ends the scene goes through
// the flow, which saves the step; each step starts at its map spawn, so Continue and a won battle land there.
// P4 hook: the `cardTutorial` step shows the P1 stub card menu over the trailhead (openCardTutorial below).

import { moveDef } from '@latentia/engine';
import Phaser from 'phaser';
import type { App } from '../app.js';
import { cardText } from '../battle/card-text.js';
import { LOCALHOST } from '../content/maps/localhost.js';
import { TOKENIBBLE_PRESETS } from '../content/trainers.js';
import { isOverworldStep, type FlowEvent, type OverworldStep } from '../flow/flow.js';
import type { InputAction } from '../input/hub.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { cameraFollow, cameraSnap, type CameraBox } from '../overworld/camera.js';
import { DIRS, HeldDirections, isDir, OPPOSITE } from '../overworld/direction.js';
import { regionName, type LookId, type Place, type Pos, type Spot } from '../overworld/map.js';
import type { OverworldMode } from '../overworld/probe.js';
import { afterStep, canEnter, encounterLive, interact, trainerLive } from '../overworld/rules.js';
import { TILE } from '../overworld/tile-art.js';
import { createWalker, pixelPos, placeWalker, updateWalker, walkFrame, type WalkerState } from '../overworld/walker.js';
import { Actor } from '../overworld-ui/actor.js';
import { BandCaption } from '../overworld-ui/band-caption.js';
import { MapView } from '../overworld-ui/map-view.js';
import { ensureOverworldTextures } from '../overworld-ui/textures.js';
import { addPixelText } from '../text/phaser-font.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { MenuList } from '../ui/menu-list.js';
import { COLOR } from '../ui/palette.js';
import { BaseScene } from './base-scene.js';

const PROBE = import.meta.env.DEV || import.meta.env.MODE === 'test';
const LOOKS: readonly LookId[] = ['player', 'professor', 'farmer', 'grad'];
/** The bible's 2x1-tile camera deadzone. */
const DEADZONE = { width: 2 * TILE, height: TILE };
const FADE_MS = 140;
/** A long frame (a background tab) is clamped so the walker never skips a tile. */
const MAX_FRAME_MS = 50;

const STUB_CARDS = TOKENIBBLE_PRESETS.map((p) => ({ id: p.id, label: cardText(p.card, (m) => moveDef(m)?.name ?? m) }));

export class OverworldScene extends BaseScene {
  private readonly world = LOCALHOST;
  private step: OverworldStep = 'walk';
  private view!: MapView;
  private player: Actor | null = null;
  private box!: DialogueBox;
  private caption: BandCaption | null = null;
  private walker!: WalkerState;
  private held = new HeldDirections();
  private mode: OverworldMode = 'walk';
  private dialogue: string | null = null;
  private scroll: Pos = { x: 0, y: 0 };
  /** Bumped on every create and shutdown, so a scripted beat from an old run of the scene never acts. */
  private generation = 0;

  constructor(app: App) {
    super('Overworld', app);
  }

  create(): void {
    const step = this.app.flow.state.step;
    if (!isOverworldStep(step)) throw new Error(`Overworld started at step ${step}`);
    const gen = ++this.generation;
    this.caption = new BandCaption(this.app.screen.bandPanel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.app.probe.overworld = null;
      this.caption?.destroy();
      this.caption = null;
    });
    this.step = step;
    this.mode = 'walk';
    this.dialogue = null;
    this.held = new HeldDirections();
    // A direction still held from before the scene started keeps steering.
    for (const d of DIRS) if (this.app.input.isHeld(d)) this.held.press(d);

    this.player = null;
    ensureOverworldTextures(this, LOOKS);
    this.cameras.main.setRoundPixels(true);
    this.view = new MapView(this, this.world, step);
    this.box = new DialogueBox(this, this.app);
    const spawn = this.world.spawns[step];
    this.enterArea(spawn);
    this.listen((a) => this.onInput(a, gen));
    if (step === 'cardTutorial') this.openCardTutorial();
    this.publish();
    this.ready();
  }

  override update(_time: number, delta: number): void {
    const dt = Math.min(delta, MAX_FRAME_MS);
    this.view.tick(dt);
    if (this.mode === 'walk') {
      const area = this.view.area.id;
      const r = updateWalker(this.walker, dt, this.held.current, (x, y) => canEnter(this.world, { area, x, y }));
      this.walker = r.state;
      if (r.arrived) this.arrive(this.generation);
    }
    this.drawPlayer();
    this.publish();
  }

  private onInput(a: InputAction, gen: number): void {
    if (a.kind === 'pick') return;
    if (isDir(a.button)) {
      if (a.kind === 'press') this.held.press(a.button);
      else this.held.release(a.button);
      return;
    }
    if (a.kind === 'press' && a.button === 'a' && this.mode === 'walk' && !this.walker.move) void this.useA(gen);
  }

  private get spot(): Spot {
    return { area: this.view.area.id, x: this.walker.x, y: this.walker.y, facing: this.walker.facing };
  }

  /** Show an area with the player at `at`, the camera snapped onto them. */
  private enterArea(at: Spot): void {
    this.view.show(at.area);
    this.walker = createWalker(at);
    this.player?.destroy();
    this.player = new Actor(this, 'player', at);
    this.scroll = cameraSnap(this.playerCentre(), this.cameraBox());
    this.drawPlayer();
  }

  private cameraBox(): CameraBox {
    return { view: { width: GAME_WIDTH, height: GAME_HEIGHT }, map: this.view.size, deadzone: DEADZONE };
  }

  private playerCentre(): Pos {
    const p = pixelPos(this.walker, TILE);
    return { x: p.x + TILE / 2, y: p.y + TILE / 2 };
  }

  private drawPlayer(): void {
    this.player?.place(pixelPos(this.walker, TILE), this.walker.facing, walkFrame(this.walker));
    this.caption?.show(regionName(this.world, this.spot));
    this.scroll = cameraFollow(this.scroll, this.playerCentre(), this.cameraBox());
    this.cameras.main.setScroll(this.scroll.x, this.scroll.y);
  }

  /** A step completed: warps, the wild patch and the trainer's sight are checked here (and only here). */
  private arrive(gen: number): void {
    const here: Place = this.spot;
    const o = afterStep(this.world, this.step, here);
    if (o.kind === 'warp') void this.warp(gen, o.to);
    else if (o.kind === 'encounter') void this.encounter(gen);
    else if (o.kind === 'spotted') void this.spotted(gen, o.path);
  }

  private async useA(gen: number): Promise<void> {
    const it = interact(this.world, this.step, this.spot);
    if (!it) return;
    if (it.kind === 'engage') {
      this.mode = 'spotted';
      await this.say(gen, it.text);
      if (this.live(gen)) this.leave({ type: 'trainerEngaged' });
      return;
    }
    // NPCs turn to face whoever talks to them.
    if (it.kind === 'talk') this.view.actor(it.npc.id)?.place({ x: it.npc.at.x * TILE, y: it.npc.at.y * TILE }, OPPOSITE[this.walker.facing], 0);
    this.mode = 'talk';
    await this.say(gen, it.text);
    if (this.live(gen)) this.mode = 'walk';
  }

  private async warp(gen: number, to: Spot): Promise<void> {
    this.mode = 'warp';
    await this.fade(gen, 'out');
    if (!this.live(gen)) return;
    this.enterArea(to);
    await this.fade(gen, 'in');
    if (this.live(gen)) this.mode = 'walk';
  }

  /** The scripted wild Tokenibble: the eyes vanish, a "!" over the player, a shake, then the battle (via the flow). */
  private async encounter(gen: number): Promise<void> {
    this.mode = 'encounter';
    this.view.hideLurk();
    this.cameras.main.shake(240, 0.01);
    await this.player?.alert();
    if (this.live(gen)) this.leave({ type: 'reachedTrailhead' });
  }

  /** Bootcamp Grad saw you: "!", it walks over, says its line, and the trainer battle starts (via the flow). */
  private async spotted(gen: number, path: readonly Pos[]): Promise<void> {
    this.mode = 'spotted';
    const grad = this.view.actor(this.world.trainer.id);
    this.walker = placeWalker(this.walker, { ...this.spot, facing: OPPOSITE[this.world.trainer.at.facing] });
    if (grad) {
      await grad.alert();
      if (!this.live(gen)) return;
      await grad.walk(path);
      if (!this.live(gen)) return;
    }
    await this.say(gen, this.world.trainer.engage);
    if (this.live(gen)) this.leave({ type: 'trainerEngaged' });
  }

  /** P4 replaces this stub: the card tutorial as a menu over the trailhead (the real presets, as cards). */
  private openCardTutorial(): void {
    this.mode = 'menu';
    this.add.rectangle(8, 8, GAME_WIDTH - 16, 84, COLOR.ink).setOrigin(0).setStrokeStyle(1, COLOR.cloud).setScrollFactor(0).setDepth(90);
    addPixelText(this, 16, 14, 'TEACH TOKENIBBLE ONE CARD (STUB)', { color: COLOR.amber }).setScrollFactor(0).setDepth(91);
    new MenuList(this, this.app, {
      id: 'tutorial-card',
      items: STUB_CARDS.map((c) => c.label),
      x: 16,
      y: 32,
      width: 280,
      rowHeight: 16,
      depth: 91,
      onConfirm: (i) => {
        const card = STUB_CARDS[i];
        if (card) this.leave({ type: 'cardChosen', cardId: card.id });
      },
    });
  }

  private async say(gen: number, text: string): Promise<void> {
    this.dialogue = text;
    await this.box.say(text);
    if (this.live(gen)) this.dialogue = null;
  }

  /** Hand over to the flow; if it refuses, the player walks on rather than being stuck. */
  private leave(event: FlowEvent): void {
    this.mode = 'leaving';
    if (!this.send(event)) this.mode = 'walk';
  }

  private fade(gen: number, dir: 'in' | 'out'): Promise<void> {
    const cam = this.cameras.main;
    return new Promise((resolve) => {
      const done = dir === 'out' ? Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE : Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE;
      cam.once(done, () => resolve());
      // If the scene shuts down mid-fade the camera never completes it; the generation check drops the beat.
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => resolve());
      if (dir === 'out') cam.fadeOut(FADE_MS, 0x18, 0x14, 0x25);
      else cam.fadeIn(FADE_MS, 0x18, 0x14, 0x25);
      if (!this.live(gen)) resolve();
    });
  }

  private live(gen: number): boolean {
    return gen === this.generation;
  }

  /** Mirror the overworld for the dev hook (dev and test builds only). */
  private publish(): void {
    if (!PROBE) return;
    const grad = this.view.actor(this.world.trainer.id);
    this.app.probe.overworld = {
      step: this.step,
      ...this.spot,
      moving: this.walker.move !== null,
      mode: this.mode,
      dialogue: this.dialogue,
      encounterLive: encounterLive(this.step),
      trainerLive: trainerLive(this.step),
      trainer: grad ? grad.tile : null,
      fps: Math.round(this.game.loop.actualFps),
    };
  }
}
