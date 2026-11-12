// The 24×24 temperature dial on the player panel (bible): five notches, 0.0–2.0, labelled "T2·1.0" style under the
// dial; a needle that sweeps from cool blue to hot red, and a 1 px jitter with sparks when hot (T3+).

import Phaser from 'phaser';
import type { Temperature } from '@latentia/engine';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';

const SIZE = 24;
const NEEDLE = [0x0099db, 0x2ce8f5, 0xfee761, 0xf77622, 0xe43b44] as const;
/** "Tn·x.x", the dial's name everywhere (tooltips say "Tn · x.x"). */
const LABELS = ['T0·0.0', 'T1·0.5', 'T2·1.0', 'T3·1.5', 'T4·2.0'] as const;
/** Needle angles from straight left (T0) over the top to straight right (T4). */
const angle = (t: number): number => Math.PI + (t * Math.PI) / 4;

export class TemperatureDial {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private t: Temperature = 2;
  private jitterMs = 0;

  constructor(
    scene: Phaser.Scene,
    private x: number,
    private y: number,
  ) {
    this.g = scene.add.graphics();
    this.label = addPixelText(scene, x, y + 16, '', { color: COLOR.cloud });
    const onUpdate = (_t: number, delta: number) => {
      if (this.t < 3) return;
      this.jitterMs += delta;
      if (this.jitterMs >= 90) {
        this.jitterMs = 0;
        this.draw();
      }
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
    this.draw();
  }

  /** Move the dial (a relayout). */
  moveTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.draw();
  }

  set(t: Temperature): void {
    this.t = t;
    this.draw();
  }

  private draw(): void {
    const g = this.g.clear();
    const cx = this.x + SIZE / 2;
    const cy = this.y + 14;
    g.fillStyle(COLOR.night).fillCircle(cx, cy, 11);
    g.fillStyle(COLOR.ink).fillRect(this.x, cy + 1, SIZE, 10);
    // The five notches.
    for (let n = 0; n <= 4; n++) {
      const a = angle(n);
      const nx = Math.round(cx + Math.cos(a) * 10);
      const ny = Math.round(cy + Math.sin(a) * 10);
      g.fillStyle(n === this.t ? NEEDLE[n] : COLOR.steel).fillRect(nx - (n === this.t ? 1 : 0), ny - (n === this.t ? 1 : 0), n === this.t ? 2 : 1, n === this.t ? 2 : 1);
    }
    // A hot dial shakes a pixel and throws sparks.
    const hot = this.t >= 3;
    const jx = hot ? Math.round(Math.random() * 2 - 1) : 0;
    const a = angle(this.t);
    g.lineStyle(1, NEEDLE[this.t]);
    g.lineBetween(cx, cy, Math.round(cx + Math.cos(a) * 7) + jx, Math.round(cy + Math.sin(a) * 7));
    g.fillStyle(COLOR.cloud).fillRect(cx - 1, cy - 1, 2, 2);
    if (hot) {
      for (let i = 0; i < this.t - 1; i++) {
        g.fillStyle(i % 2 === 0 ? COLOR.lemon : COLOR.red).fillRect(cx + Math.round(Math.random() * 16 - 8), cy - 4 - Math.round(Math.random() * 7), 1, 1);
      }
    }
    const text = LABELS[this.t];
    this.label.setText(text).setPosition(this.x + Math.floor((SIZE - textWidth(text)) / 2), this.y + 16);
  }
}
