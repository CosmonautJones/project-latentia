// Loads the art pass's sheets (art/sheets.ts) into Phaser: every sheet as a spritesheet in Boot's preload, then every
// animation the manifest lists, once per game.

import type Phaser from 'phaser';
import { assetUrl } from '../asset-url.js';
import { ART, animKey, artFile, sheetKey } from './sheets.js';

export function preloadArt(scene: Phaser.Scene): void {
  for (const [id, s] of Object.entries(ART.sheets)) {
    scene.load.spritesheet(sheetKey(id), assetUrl(artFile(s.file)), { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
  }
}

export function createArtAnims(scene: Phaser.Scene): void {
  for (const [id, s] of Object.entries(ART.sheets)) {
    for (const [name, a] of Object.entries(s.animations)) {
      const key = animKey(id, name);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: a.frames.map((frame) => ({ key: sheetKey(id), frame })),
        frameRate: a.frameMs > 0 ? 1000 / a.frameMs : 1,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}
