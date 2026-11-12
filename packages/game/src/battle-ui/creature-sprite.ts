// A creature on the battlefield, or standing in a scene: its idle animation (the art pass's 96 px battle sheet, or a
// generated placeholder for a species it has not drawn), and the juice the playback uses: windup lunge, white hit
// flash then the sheet's hit frames, faint drop. Its position is where its feet stand. The sheets face the viewer's left; the player's side
// mirrors them (ruling V15).

import Phaser from 'phaser';
import { animKey, battleSheet, sheetKey } from '../art/sheets.js';
import { placeholderArt, PLACEHOLDER_BASELINE, PLACEHOLDER_FRAME_MS, PLACEHOLDER_FRAMES } from '../battle/creature-art.js';

const placeholderKey = (species: string) => `creature.${species}`;
const placeholderAnim = (species: string) => `creature.${species}.idle`;

interface CreatureArt {
  readonly texture: string;
  readonly anim: string;
  /** The art pass's 2-frame hit reaction, when the sheet has one. */
  readonly hit: string | null;
  readonly frameSize: number;
  /** The row the feet stand on. */
  readonly baseline: number;
}

/** The texture and idle animation for a species: its sheet (loaded in Boot), or a placeholder generated once. */
function ensureCreature(scene: Phaser.Scene, species: string): CreatureArt {
  const sheet = battleSheet(species);
  if (sheet) {
    const hit = animKey(sheet.id, 'hit');
    return { texture: sheetKey(sheet.id), anim: animKey(sheet.id, 'idle'), hit: scene.anims.exists(hit) ? hit : null, frameSize: sheet.frameSize, baseline: sheet.baseline };
  }
  const key = placeholderKey(species);
  const art = placeholderArt(species);
  if (!scene.textures.exists(key)) {
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
  if (!scene.anims.exists(placeholderAnim(species))) {
    scene.anims.create({
      key: placeholderAnim(species),
      frames: scene.anims.generateFrameNumbers(key, { start: 0, end: PLACEHOLDER_FRAMES - 1 }),
      frameRate: 1000 / PLACEHOLDER_FRAME_MS,
      repeat: -1,
    });
  }
  return { texture: key, anim: placeholderAnim(species), hit: null, frameSize: art.size, baseline: PLACEHOLDER_BASELINE };
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
  private homeX: number;
  private homeY: number;
  private art: CreatureArt | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    species: string,
    private readonly back: boolean,
  ) {
    this.homeX = x;
    this.homeY = y;
    this.sprite = scene.add.sprite(x, y, ensureCreature(scene, species).texture);
    this.setSpecies(species);
  }

  /** Stand somewhere else (a relayout). A running tween ends at the old spot; the next one starts from here. */
  setHome(x: number, y: number): void {
    this.homeX = x;
    this.homeY = y;
    this.sprite.setPosition(x, y);
  }

  /** Show another species here (a swap). */
  setSpecies(species: string): void {
    const art = ensureCreature(this.scene, species);
    this.art = art;
    // Feet on the position: whole pixels of origin, so nothing lands between pixels.
    this.sprite.setTexture(art.texture).setOrigin(0.5, (art.baseline + 1) / art.frameSize).setFlipX(this.back);
    this.sprite.play(art.anim);
    this.restore();
  }

  /** Back in place, fully visible and untinted. */
  restore(): void {
    this.sprite.setPosition(this.homeX, this.homeY).setAlpha(1);
    this.baseTint();
  }

  private baseTint(): void {
    this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
    this.sprite.clearTint();
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

  /** After the flash: the sheet's hit reaction (2 frames), then back to idle; without one, idle resumes. */
  flashOff(): void {
    this.baseTint();
    const art = this.art;
    if (art?.hit == null) {
      this.sprite.anims.resume();
      return;
    }
    const hit = art.hit;
    this.sprite.play(hit);
    this.sprite.once(`${Phaser.Animations.Events.ANIMATION_COMPLETE_KEY}${hit}`, () => {
      if (this.art === art && this.sprite.alpha > 0) this.sprite.play(art.anim);
    });
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
