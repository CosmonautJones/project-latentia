// A tap target over a menu option drawn in the game image: a tap (or click) picks the option through the action
// stream, the same as keys or the D-pad. Every option's hit area is at least the layout's `tap` (44 CSS px) tall;
// callers size their rows from it. The dev hook lists the live targets (`taps()`), so e2e taps the real pixels.

import Phaser from 'phaser';
import type { App } from '../app.js';
import type { Rect } from '../layout/viewport.js';

/** What the dev hook reads off a tap zone. */
export interface TapData {
  readonly menu: string;
  readonly index: number;
}

export const TAP_DATA = 'tap';

export function addTapZone(scene: Phaser.Scene, app: App, r: Rect, menu: string, index: number, opts: { readonly depth?: number; readonly pinned?: boolean } = {}): Phaser.GameObjects.Zone {
  const z = scene.add.zone(r.x, r.y, r.width, r.height).setOrigin(0);
  if (opts.pinned !== false) z.setScrollFactor(0);
  if (opts.depth !== undefined) z.setDepth(opts.depth);
  z.setInteractive({ useHandCursor: true });
  z.setData(TAP_DATA, { menu, index } satisfies TapData);
  z.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => app.input.pick(menu, index));
  return z;
}

/** Every enabled tap zone in the running scenes, in logical px (screen space). For the dev hook. */
export function liveTapZones(game: Phaser.Game): (TapData & Rect)[] {
  const out: (TapData & Rect)[] = [];
  const visit = (o: Phaser.GameObjects.GameObject) => {
    if (o instanceof Phaser.GameObjects.Container) {
      if (o.visible) for (const c of o.list) visit(c);
      return;
    }
    const data = o.getData(TAP_DATA) as TapData | undefined;
    if (!(o instanceof Phaser.GameObjects.Zone) || data === undefined || !o.input?.enabled || !o.active) return;
    const b = o.getBounds();
    out.push({ ...data, x: b.x, y: b.y, width: b.width, height: b.height });
  };
  for (const s of game.scene.getScenes(true)) for (const o of s.children.list) visit(o);
  return out;
}
