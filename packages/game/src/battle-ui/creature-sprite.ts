// A creature on the battlefield: its idle animation (a Fable sheet for the starters, a generated placeholder for the
// rest), and the juice the playback uses: windup lunge, white hit flash, faint drop. The player's creatures face
// right and are darkened, standing in for back sprites in v0.

import Phaser from 'phaser';
import { assetUrl } from '../asset-url.js';
import { FABLE_SHEETS, hasSheet, placeholderArt, PLACEHOLDER_FRAME_MS, PLACEHOLDER_FRAMES } from '../battle/creature-art.js';

const sheetKey = (species: string) => `creature.${species}`;
const animKey = (species: string) => `creature.${species}.idle`;
/** Multiply tint for the stand-in back view. */
const BACK_TINT = 0xa8b0c8;

/** Boot's preload: the three Fable idle sheets. */
export function preloadCreatureSheets(scene: Phaser.Scene): void {
  for (const [species, s] of Object.entries(FABLE_SHEETS)) {
    scene.load.spritesheet(sheetKey(species), assetUrl(s.file), { frameWidth: s.frameSize, frameHeight: s.frameSize });
  }
}

/** The texture and idle animation for a species, generating a placeholder the first time one is needed. */
function ensureCreature(scene: Phaser.Scene, species: string): void {
  const key = sheetKey(species);
  if (!scene.textures.exists(key)) {
    const art = placeholderArt(species);
    const tex = scene.textures.createCanvas(key, art.size * PLACEHOLDER_FRAMES, art.size);
    if (!tex) throw new Error(`could not create ${key}`);
    const ctx = tex.getContext();
    art.frames.forEach((frame, f) => {
      frame.forEach((c, i) => {
        if (c === null) return;
        ctx.fillStyle = `#${c.toString(16).padStart(6, '0')}`;
        ctx.fillRect(f * art.size + (i % art.size), Math.floor(i / art.size), 1, 1);
      });
      tex.add(f, 0, f * art.size, 0, art.size, art.size);
    });
    tex.refresh();
  }
  if (!scene.anims.exists(animKey(species))) {
    const sheet = hasSheet(species) ? FABLE_SHEETS[species] : null;
    scene.anims.create({
      key: animKey(species),
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: (sheet?.frames ?? PLACEHOLDER_FRAMES) - 1 }),
      frameRate: 1000 / (sheet?.frameMs ?? PLACEHOLDER_FRAME_MS),
      repeat: -1,
    });
  }
}

export const tween = (scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> =>
  new Promise((resolve) => {
    if ((config.duration ?? 0) <= 0) {
      resolve();
      return;
    }
    scene.tweens.add({ ...config, onComplete: () => resolve() });
  });

export class CreatureSprite {
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly homeX: number;
  private readonly homeY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    species: string,
    private readonly back: boolean,
  ) {
    this.homeX = x;
    this.homeY = y;
    this.sprite = scene.add.sprite(x, y, sheetKey(species)).setOrigin(0.5, 1);
    this.setSpecies(species);
  }

  /** Show another species here (a swap). */
  setSpecies(species: string): void {
    ensureCreature(this.scene, species);
    this.sprite.setTexture(sheetKey(species)).setFlipX(this.back);
    this.sprite.play(animKey(species));
    this.restore();
  }

  /** Back in place, fully visible and untinted (apart from the back-view darkening). */
  restore(): void {
    this.sprite.setPosition(this.homeX, this.homeY).setAlpha(1);
    this.baseTint();
  }

  private baseTint(): void {
    this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    if (this.back) this.sprite.setTint(BACK_TINT);
    else this.sprite.clearTint();
  }

  /** Anticipation: lean back, then lunge toward the other side, then settle. */
  async windup(ms: number): Promise<void> {
    const dir = this.back ? 1 : -1;
    const third = Math.max(1, Math.floor(ms / 3));
    await tween(this.scene, { targets: this.sprite, x: this.homeX - 2 * dir, duration: third, ease: 'Sine.easeOut' });
    await tween(this.scene, { targets: this.sprite, x: this.homeX + 5 * dir, duration: third, ease: 'Quad.easeIn' });
    await tween(this.scene, { targets: this.sprite, x: this.homeX, duration: ms - 2 * third, ease: 'Quad.easeOut' });
    this.sprite.x = this.homeX;
  }

  /** The impact: a white fill for the whole hit-stop; the caller holds everything else still meanwhile. */
  flashOn(): void {
    this.sprite.anims.pause();
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  flashOff(): void {
    this.sprite.anims.resume();
    this.baseTint();
  }

  async faint(ms: number): Promise<void> {
    this.sprite.anims.pause();
    await tween(this.scene, { targets: this.sprite, y: this.homeY + 12, alpha: 0, duration: ms, ease: 'Quad.easeIn' });
    this.sprite.setAlpha(0);
  }

  setFainted(): void {
    this.sprite.anims.pause();
    this.sprite.setAlpha(0);
  }
}
