// Boot/Preload: loads the art pass's sheets (tiles, people, creatures) and their animations, builds the pixel font,
// then hands over to the flow, which opens the title.

import { createArtAnims, preloadArt } from '../art/load.js';
import { registerPixelFont } from '../text/phaser-font.js';
import { BaseScene } from './base-scene.js';
import type { App } from '../app.js';

export class BootScene extends BaseScene {
  constructor(app: App) {
    super('Boot', app);
  }

  preload(): void {
    preloadArt(this);
  }

  create(): void {
    registerPixelFont(this);
    createArtAnims(this);
    this.app.flow.start();
  }
}
