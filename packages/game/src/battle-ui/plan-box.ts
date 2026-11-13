// The foe's telegraph under its panel (ruling V11): a framed box with the category's icon and the line, "NEXT:
// ATTACK ~6 → SAGELET" in one line in landscape, or the label over two lines in portrait. A reveal upgrades it to the
// exact move; the details toggle shows the numbers (the damage range). It empties once the foe's action starts.

import Phaser from 'phaser';
import type { FoePlan } from '../battle/plans.js';
import type { Rect } from '../layout/viewport.js';
import { addPixelText, textWidth } from '../text/phaser-font.js';
import { COLOR } from '../ui/palette.js';
import { CATEGORY_COLOR, drawIntentIcon } from './intent-icons.js';

/** `text` cut to `room` characters, ending in "…" when cut. */
export const clip = (text: string, room: number): string => ([...text].length > room ? `${[...text].slice(0, Math.max(0, room - 1)).join('')}…` : text);

export class PlanBox {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.BitmapText;
  private readonly line1: Phaser.GameObjects.BitmapText;
  private readonly line2: Phaser.GameObjects.BitmapText;
  private plan: FoePlan | null = null;
  private exact = false;
  private numbers = false;

  constructor(
    scene: Phaser.Scene,
    private rect: Rect,
  ) {
    this.g = scene.add.graphics().setDepth(20);
    this.label = addPixelText(scene, 0, 0, 'NEXT:', { color: COLOR.mist }).setDepth(21);
    this.line1 = addPixelText(scene, 0, 0, '').setDepth(21);
    this.line2 = addPixelText(scene, 0, 0, '').setDepth(21);
    this.draw();
  }

  place(rect: Rect): void {
    this.rect = rect;
    this.draw();
  }

  /** Show `plan` (null hides the box); `exact` when a reveal has landed on this foe; `numbers` for the details. */
  show(plan: FoePlan | null, exact = false, numbers = this.numbers): void {
    this.plan = plan;
    this.exact = exact;
    this.numbers = numbers;
    this.draw();
  }

  /** The text on screen, for the dev probe ("" when hidden). */
  text(): string {
    return this.plan === null ? '' : [this.line1.text, this.line2.text].filter((t) => t !== '').join(' ');
  }

  private draw(): void {
    const r = this.rect;
    const g = this.g.clear();
    const p = this.plan;
    const visible = p !== null;
    for (const t of [this.label, this.line1, this.line2]) t.setVisible(visible);
    if (p === null) return;
    const line = this.numbers ? p.detail : this.exact ? p.exactLine : p.line;
    const color = CATEGORY_COLOR[p.telegraph.category];
    g.fillStyle(color).fillRect(r.x, r.y, r.width, r.height);
    g.fillStyle(COLOR.ink).fillRect(r.x + 1, r.y + 1, r.width - 2, r.height - 2);
    const twoLines = r.height >= 22;
    this.label.setPosition(r.x + 3, r.y + 3);
    const iconX = r.x + 3 + textWidth('NEXT:') + 3;
    drawIntentIcon(g, p.telegraph.category, iconX, r.y + 3);
    const room = Math.floor((r.width - (iconX + 10 - r.x) - 2) / 6);
    const arrow = line.indexOf(' → ');
    if (twoLines && arrow > 0) {
      this.line1.setText(clip(line.slice(0, arrow), room)).setPosition(iconX + 10, r.y + 3).setTint(color);
      this.line2.setText(clip(line.slice(arrow + 1), Math.floor((r.width - 6) / 6))).setPosition(r.x + 3, r.y + 13).setTint(COLOR.cream);
      return;
    }
    // One line: when it does not fit, the "~N" goes before the target does.
    const short = [...line].length > room ? line.replace(/ ~\d+(?= →)/, '') : line;
    this.line1.setText(clip(short, room)).setPosition(iconX + 10, r.y + 3).setTint(color);
    this.line2.setText('');
  }
}
