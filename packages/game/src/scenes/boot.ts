// Boot/Preload: builds the generated assets (the pixel font; later the placeholder creatures and tiles and the
// Fable starter sheets), then hands over to the flow, which opens the title.

import { registerPixelFont } from '../text/phaser-font.js';
import { BaseScene } from './base-scene.js';
import type { App } from '../app.js';

export class BootScene extends BaseScene {
  constructor(app: App) {
    super('Boot', app);
  }

  create(): void {
    registerPixelFont(this);
    this.app.flow.start();
  }
}
