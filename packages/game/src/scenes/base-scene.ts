// The common scene base: input subscriptions that end with the scene, a one-shot guard on leaving, and the
// probe the dev hook reads.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { FlowEvent } from '../flow/flow.js';
import type { InputListener } from '../input/hub.js';
import type { Layout } from '../layout/viewport.js';

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

  /** The current layout: the logical size, the safe area and the tap size every scene lays out from. */
  protected get layout(): Layout {
    return this.app.screen.layout();
  }

  /** On every relayout (a rotation, a resize) until this scene shuts down: lay the scene out again, keeping its state. */
  protected onRelayout(listener: (layout: Layout) => void): void {
    const off = this.app.screen.onLayout(listener);
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
    // The one scene marker production builds have too (no hook there): the single-file build's sandboxed-iframe e2e
    // reads it to follow the game, now that every menu is drawn in the image.
    document.body.dataset['scene'] = this.scene.key;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.app.probe.scene === this.scene.key) this.app.probe.scene = null;
      this.app.probe.menu = null;
    });
  }
}
