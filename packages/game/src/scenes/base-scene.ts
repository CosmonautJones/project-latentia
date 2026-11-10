// The common scene base: input subscriptions that end with the scene, a one-shot guard on leaving, and the
// probe the dev hook reads.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { FlowEvent } from '../flow/flow.js';
import type { InputListener } from '../input/hub.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../layout/compute.js';
import { addPixelText } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';

export abstract class BaseScene extends Phaser.Scene {
  private leaving = false;

  constructor(
    key: string,
    protected readonly app: App,
  ) {
    super(key);
  }

  /** Subscribe to the action stream until this scene shuts down; input stops once the scene is leaving. */
  protected listen(listener: InputListener): void {
    const off = this.app.input.subscribe((a) => {
      if (!this.leaving) listener(a);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  /** Send a flow event; once one is accepted this scene ignores further input while the next one starts. */
  protected send(event: FlowEvent): boolean {
    if (this.leaving) return false;
    const ok = this.app.flow.send(event);
    if (ok) this.leaving = true;
    return ok;
  }

  /** Call at the end of `create`: resets the leaving guard and tells the probe this scene is up. */
  protected ready(): void {
    this.leaving = false;
    this.app.probe.scene = this.scene.key;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.app.probe.scene === this.scene.key) this.app.probe.scene = null;
      this.app.probe.menu = null;
    });
  }

  /** The placeholder frame every P1 stub shares: a flat background and a "STUB" tag with the scene's name. */
  protected stubFrame(title: string): void {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLOR.night).setOrigin(0);
    this.add.rectangle(0, 0, GAME_WIDTH, 14, COLOR.ink).setOrigin(0);
    addPixelText(this, 4, 3, 'STUB', { color: COLOR.amber });
    addPixelText(this, 34, 3, title, { color: COLOR.cloud });
  }
}
