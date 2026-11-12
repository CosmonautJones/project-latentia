// A creature's info panel: name and level, an HP bar that drains with a lagging white "ghost chunk" (with the numbers
// on the player's own), the context window as pips (ruling V13: one per cell, the free ones dim) on the player's
// orchestrator, and status chips (three letters on the status colour, so colour is never the only cue). Sized by the
// stage layout's rect; `place` moves it in place on a relayout.

import Phaser from 'phaser';
import type { CreatureView } from '../battle/session.js';
import { statusLabel } from '../battle/labels.js';
import { contextPips } from '../battle/pips.js';
import type { Rect } from '../layout/viewport.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';
import { tween } from './creature-sprite.js';
import type { PanelVariant } from './stage-layout.js';

export type { PanelVariant } from './stage-layout.js';

const hpColor = (hp: number, max: number): number => (hp * 2 > max ? COLOR.green : hp * 4 > max ? COLOR.amber : COLOR.red);
const barWidth = (value: number, max: number, w: number): number => (max <= 0 ? 0 : Math.max(0, Math.min(w, Math.ceil((value * w) / max))));
/** A pip is 3 px wide with a 1 px gap. */
export const PIP_PITCH = 4;

interface Inner {
  readonly hp: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly pipsY: number | null;
  readonly numbers: boolean;
}

function inner(variant: PanelVariant, width: number): Inner {
  if (variant === 'sub') return { hp: { x: width - 4 - Math.max(28, width - 84), y: 5, w: Math.max(28, width - 84), h: 3 }, pipsY: null, numbers: false };
  if (variant === 'foe') return { hp: { x: 18, y: 14, w: width - 22, h: 4 }, pipsY: null, numbers: false };
  return { hp: { x: 18, y: 13, w: width - 60, h: 4 }, pipsY: 23, numbers: true };
}

export class CreaturePanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly track: Phaser.GameObjects.Graphics;
  private readonly pips: Phaser.GameObjects.Graphics;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpGhost: Phaser.GameObjects.Rectangle;
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly level: Phaser.GameObjects.BitmapText;
  private readonly numbers: Phaser.GameObjects.BitmapText;
  private readonly free: Phaser.GameObjects.BitmapText;
  private readonly labels: Phaser.GameObjects.BitmapText[] = [];
  private chips: Phaser.GameObjects.GameObject[] = [];
  private geo: Inner;
  private rect: Rect;
  private view: CreatureView;
  private hp: number;
  private used: number;
  private statuses = new Map<string, true>();
  private drift = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    rect: Rect,
    private readonly variant: PanelVariant,
    view: CreatureView,
  ) {
    this.rect = rect;
    this.geo = inner(variant, rect.width);
    this.view = view;
    this.hp = view.hp;
    this.used = view.ctxUsed;
    this.frame = scene.add.graphics();
    this.track = scene.add.graphics();
    this.pips = scene.add.graphics();
    this.hpGhost = scene.add.rectangle(0, 0, 0, 1, COLOR.white).setOrigin(0);
    this.hpFill = scene.add.rectangle(0, 0, 0, 1, COLOR.green).setOrigin(0);
    this.name = addPixelText(scene, 4, 3, '', { color: COLOR.white });
    this.level = addPixelText(scene, 0, 3, '', { color: COLOR.cream });
    this.numbers = addPixelText(scene, 0, 0, '', { color: COLOR.cloud });
    this.free = addPixelText(scene, 0, 0, '', { color: COLOR.mist });
    if (variant !== 'sub') this.labels.push(addPixelText(scene, 4, 0, 'HP', { color: COLOR.mist }));
    if (variant === 'player') this.labels.push(addPixelText(scene, 4, 0, 'CX', { color: COLOR.mist }));
    this.container = scene.add.container(rect.x, rect.y, [this.frame, this.track, this.hpGhost, this.hpFill, this.pips, this.name, this.level, this.numbers, this.free, ...this.labels]);
    this.drawStatic();
    this.bind(view);
  }

  /** Move and resize for a new layout, keeping what it shows. */
  place(rect: Rect): void {
    this.rect = rect;
    this.geo = inner(this.variant, rect.width);
    this.container.setPosition(rect.x, rect.y);
    this.drawStatic();
    this.drawHp(this.hp);
    this.hpGhost.width = this.hpFill.width;
    this.setContext(this.used);
    this.drawChips();
  }

  private drawStatic(): void {
    const { width, height } = this.rect;
    const g = this.geo;
    this.frame.clear().fillStyle(COLOR.cloud).fillRect(0, 0, width, height).fillStyle(COLOR.ink).fillRect(1, 1, width - 2, height - 2);
    if (this.variant !== 'sub') this.frame.fillStyle(COLOR.slate).fillRect(2, height - 3, width - 4, 1);
    this.track.clear().fillStyle(COLOR.night).fillRect(g.hp.x, g.hp.y, g.hp.w, g.hp.h);
    this.hpGhost.setPosition(g.hp.x, g.hp.y).setSize(this.hpGhost.width, g.hp.h);
    this.hpFill.setPosition(g.hp.x, g.hp.y).setSize(this.hpFill.width, g.hp.h);
    this.labels[0]?.setY(g.hp.y - 2);
    if (g.pipsY !== null) this.labels[1]?.setY(g.pipsY - 1);
    this.numbers.setPosition(g.hp.x + g.hp.w + 4, g.hp.y - 2);
  }

  /** Show `view` (a fresh creature after a swap, or a full resync after a round). */
  bind(view: CreatureView): void {
    this.view = view;
    this.hp = view.hp;
    this.statuses = new Map(view.statuses.map((s) => [s.id, true]));
    this.drift = view.drift;
    const lv = `L${view.level}`;
    this.name.setText(view.shortName);
    this.level.setText(lv).setX(4 + textWidth(view.shortName) + 4);
    this.drawHp(view.hp);
    this.hpGhost.width = this.hpFill.width;
    this.setContext(view.ctxUsed);
    this.drawChips();
    this.container.setAlpha(view.fainted ? 0.5 : 1);
  }

  private drawHp(hp: number): void {
    this.hpFill.width = barWidth(hp, this.view.maxHp, this.geo.hp.w);
    this.hpFill.fillColor = hpColor(hp, this.view.maxHp);
    this.numbers.setText(this.geo.numbers ? `${hp}/${this.view.maxHp}` : '');
  }

  /** Drain (or fill) to `hp` over `ms`; on a drain the white ghost chunk lags, then catches up. */
  async setHp(hp: number, ms: number): Promise<void> {
    const from = this.hp;
    this.hp = hp;
    const target = barWidth(hp, this.view.maxHp, this.geo.hp.w);
    if (this.geo.numbers) this.numbers.setText(`${hp}/${this.view.maxHp}`);
    if (hp >= from) {
      this.hpGhost.width = target;
      await tween(this.scene, { targets: this.hpFill, width: target, duration: ms });
      this.drawHp(hp);
      return;
    }
    this.hpGhost.width = Math.max(this.hpGhost.width, this.hpFill.width);
    const half = Math.floor(ms / 2);
    await tween(this.scene, { targets: this.hpFill, width: target, duration: half, ease: 'Quad.easeOut' });
    this.hpFill.fillColor = hpColor(hp, this.view.maxHp);
    await tween(this.scene, { targets: this.hpGhost, width: target, duration: ms - half });
    this.drawHp(hp);
    this.hpGhost.width = target;
  }

  /** The context pips: used cells filled (amber from three-quarters full, red when full), free cells hollow. */
  setContext(used: number): void {
    this.used = used;
    const y = this.geo.pipsY;
    const g = this.pips.clear();
    if (y === null) return;
    const w = this.view.ctxWindow;
    const fill = used >= w ? COLOR.red : used * 4 >= w * 3 ? COLOR.amber : COLOR.cyan;
    contextPips(used, w).forEach((p, i) => {
      const x = 18 + i * PIP_PITCH;
      // Used cells are lit; free ones are dim slots, so the row reads as a gauge (not as a row of zeros).
      g.fillStyle(p === 'used' ? fill : COLOR.slate).fillRect(x, y, 3, 6);
    });
    const free = Math.max(0, w - used);
    this.free.setText(`${free} FREE`).setPosition(18 + w * PIP_PITCH + 3, y - 1).setTint(free === 0 ? COLOR.red : COLOR.mist);
  }

  setStatus(status: string, on: boolean): void {
    if (status === 'drift') return;
    if (on) this.statuses.set(status, true);
    else this.statuses.delete(status);
    this.drawChips();
  }

  setDrift(drift: number): void {
    this.drift = drift;
    this.drawChips();
  }

  setFainted(): void {
    this.container.setAlpha(0.5);
  }

  /** Status chips on the name row, after the level, as many as fit. */
  private drawChips(): void {
    for (const c of this.chips) c.destroy();
    this.chips = [];
    const labels = [...[...this.statuses.keys()].map((id) => statusLabel(id)), ...(this.drift > 0 ? [{ ...statusLabel('drift'), chip: `DR${this.drift}` }] : [])];
    const x0 = 4 + textWidth(this.view.shortName) + 4 + textWidth(`L${this.view.level}`) + 4;
    const end = this.variant === 'sub' ? this.geo.hp.x - 2 : this.rect.width - 3;
    const max = Math.max(0, Math.floor((end - x0) / 22));
    labels.slice(0, max).forEach((l, i) => {
      const cx = x0 + i * 22;
      const bg = this.scene.add.rectangle(cx, 2, 20, 9, l.color).setOrigin(0);
      const text = addPixelText(this.scene, cx + 2, 3, l.chip, { color: COLOR.ink });
      this.chips.push(bg, text);
    });
    this.container.add(this.chips);
  }
}
