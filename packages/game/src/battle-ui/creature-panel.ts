// A creature's info panel: name and level, an HP bar that drains with a lagging white "ghost chunk", a context bar
// (headroom used), and status chips (three letters on the status colour, so colour is never the only cue).

import Phaser from 'phaser';
import type { CreatureView } from '../battle/session.js';
import { statusLabel } from '../battle/labels.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';
import { tween } from './creature-sprite.js';

export type PanelVariant = 'foe' | 'player' | 'sub';

interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly hpBar: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly ctxBar: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  /** Where the status chips start, and which way they run. */
  readonly chips: { readonly x: number; readonly y: number; readonly max: number };
  readonly numbers: boolean;
}

const GEOMETRY: Readonly<Record<PanelVariant, Geometry>> = {
  foe: { width: 120, height: 32, hpBar: { x: 18, y: 13, w: 64, h: 4 }, ctxBar: { x: 18, y: 23, w: 64, h: 3 }, chips: { x: 86, y: 12, max: 2 }, numbers: false },
  player: { width: 126, height: 44, hpBar: { x: 18, y: 14, w: 68, h: 4 }, ctxBar: { x: 18, y: 30, w: 68, h: 3 }, chips: { x: 4, y: 35, max: 4 }, numbers: true },
  sub: { width: 126, height: 16, hpBar: { x: 84, y: 4, w: 38, h: 3 }, ctxBar: { x: 84, y: 10, w: 38, h: 2 }, chips: { x: 126, y: 4, max: 0 }, numbers: false },
};

const hpColor = (hp: number, max: number): number => (hp * 2 > max ? COLOR.green : hp * 4 > max ? COLOR.amber : COLOR.red);
const barWidth = (value: number, max: number, w: number): number => (max <= 0 ? 0 : Math.max(0, Math.min(w, Math.ceil((value * w) / max))));

export class CreaturePanel {
  readonly container: Phaser.GameObjects.Container;
  private readonly geo: Geometry;
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly hpGhost: Phaser.GameObjects.Rectangle;
  private readonly ctxFill: Phaser.GameObjects.Rectangle;
  private readonly name: Phaser.GameObjects.BitmapText;
  private readonly level: Phaser.GameObjects.BitmapText;
  private readonly numbers: Phaser.GameObjects.BitmapText | null;
  private chips: Phaser.GameObjects.GameObject[] = [];
  private view: CreatureView;
  private hp: number;
  private statuses = new Map<string, true>();
  private drift = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly variant: PanelVariant,
    view: CreatureView,
  ) {
    this.geo = GEOMETRY[variant];
    this.view = view;
    this.hp = view.hp;
    const g = this.geo;
    const frame = scene.add.graphics();
    frame.fillStyle(COLOR.cloud).fillRect(0, 0, g.width, g.height);
    frame.fillStyle(COLOR.ink).fillRect(1, 1, g.width - 2, g.height - 2);
    frame.fillStyle(COLOR.slate).fillRect(2, g.height - 3, g.width - 4, 1);
    const label = (text: string, ly: number) => addPixelText(scene, 4, ly, text, { color: COLOR.mist });
    const parts: Phaser.GameObjects.GameObject[] = [frame];
    // Labels sit one full text row apart (8 px glyphs), level with their bars.
    if (variant !== 'sub') parts.push(label('HP', g.hpBar.y - 2), label('CX', g.ctxBar.y - 3));
    const track = (b: Geometry['hpBar']) => scene.add.rectangle(b.x, b.y, b.w, b.h, COLOR.night).setOrigin(0);
    this.hpGhost = scene.add.rectangle(g.hpBar.x, g.hpBar.y, 0, g.hpBar.h, COLOR.white).setOrigin(0);
    this.hpFill = scene.add.rectangle(g.hpBar.x, g.hpBar.y, 0, g.hpBar.h, COLOR.green).setOrigin(0);
    this.ctxFill = scene.add.rectangle(g.ctxBar.x, g.ctxBar.y, 0, g.ctxBar.h, COLOR.cyan).setOrigin(0);
    this.name = addPixelText(scene, 4, variant === 'sub' ? 3 : 2, '', { color: COLOR.white });
    this.level = addPixelText(scene, 0, variant === 'sub' ? 3 : 2, '', { color: COLOR.cream });
    this.numbers = g.numbers ? addPixelText(scene, g.hpBar.x, g.hpBar.y + 6, '', { color: COLOR.cloud }) : null;
    parts.push(track(g.hpBar), track(g.ctxBar), this.hpGhost, this.hpFill, this.ctxFill, this.name, this.level);
    if (this.numbers) parts.push(this.numbers);
    this.container = scene.add.container(x, y, parts);
    this.bind(view);
  }

  /** Show `view` (a fresh creature after a swap, or a full resync after a round). */
  bind(view: CreatureView): void {
    this.view = view;
    this.hp = view.hp;
    this.statuses = new Map(view.statuses.map((s) => [s.id, true]));
    this.drift = view.drift;
    const lv = `L${view.level}`;
    this.name.setText(view.shortName);
    const levelX = this.variant === 'sub' ? 4 + textWidth(view.shortName) + 6 : this.geo.hpBar.x + this.geo.hpBar.w - textWidth(lv);
    this.level.setText(lv).setX(levelX);
    this.drawHp(view.hp);
    this.hpGhost.width = this.hpFill.width;
    this.setContext(view.ctxUsed);
    this.drawChips();
    this.container.setAlpha(view.fainted ? 0.5 : 1);
  }

  private drawHp(hp: number): void {
    this.hpFill.width = barWidth(hp, this.view.maxHp, this.geo.hpBar.w);
    this.hpFill.fillColor = hpColor(hp, this.view.maxHp);
    this.numbers?.setText(`${hp}/${this.view.maxHp}`);
  }

  /** Drain (or fill) to `hp` over `ms`; on a drain the white ghost chunk lags, then catches up. */
  async setHp(hp: number, ms: number): Promise<void> {
    const from = this.hp;
    this.hp = hp;
    const target = barWidth(hp, this.view.maxHp, this.geo.hpBar.w);
    this.numbers?.setText(`${hp}/${this.view.maxHp}`);
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

  setContext(used: number): void {
    this.ctxFill.width = barWidth(used, this.view.ctxWindow, this.geo.ctxBar.w);
    this.ctxFill.fillColor = used >= this.view.ctxWindow ? COLOR.red : used * 4 >= this.view.ctxWindow * 3 ? COLOR.amber : COLOR.cyan;
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

  private drawChips(): void {
    for (const c of this.chips) c.destroy();
    this.chips = [];
    const ids = [...this.statuses.keys()];
    const labels = [...ids.map((id) => statusLabel(id)), ...(this.drift > 0 ? [{ ...statusLabel('drift'), chip: `DR${this.drift}` }] : [])];
    const { x, y, max } = this.geo.chips;
    const vertical = this.variant === 'foe';
    labels.slice(0, max).forEach((l, i) => {
      const cx = vertical ? x : x + i * 22;
      const cy = vertical ? y + i * 10 : y;
      const bg = this.scene.add.rectangle(cx, cy, 20, 9, l.color).setOrigin(0);
      const text = addPixelText(this.scene, cx + 2, cy + 1, l.chip, { color: COLOR.ink });
      this.chips.push(bg, text);
    });
    this.container.add(this.chips);
  }
}
