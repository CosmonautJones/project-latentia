// Boot/Preload: loads the Fable starter sheets and builds the generated assets (the pixel font; placeholder creatures
// are generated on first use), then hands over to the flow, which opens the title.

import { preloadCreatureSheets } from '../battle-ui/creature-sprite.js';
import { registerPixelFont } from '../text/phaser-font.js';
import { BaseScene } from './base-scene.js';
import type { App } from '../app.js';

export class BootScene extends BaseScene {
  constructor(app: App) {
    super('Boot', app);
  }

  preload(): void {
    preloadCreatureSheets(this);
  }

  create(): void {
    registerPixelFont(this);
    this.app.flow.start();
  }
}
