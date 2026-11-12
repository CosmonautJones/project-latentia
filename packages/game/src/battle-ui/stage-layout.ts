// Where the battlefield's pieces go, per orientation (plan v0.1 Q1: the battle only has to render at both sizes; Q2
// redesigns it). Landscape keeps v0's 320x136 field, centred in the safe area of the landscape screen, with the backdrop
// running the full width. Portrait (270 wide) stacks it: the foe and its panel at the top, the player's side under
// them, both panels in a row under the player's sprites. Pure, so it is unit-tested.

import type { Layout } from '../layout/viewport.js';
import type { PanelVariant } from './creature-panel.js';

export type SlotName = 'foe' | 'foeSub' | 'player' | 'playerSub';

export interface SlotGeometry {
  /** Bottom centre of the sprite (its feet sit 6 px above). */
  readonly sprite: { readonly x: number; readonly y: number };
  /** The panel's top-left corner. */
  readonly panel: { readonly x: number; readonly y: number };
  readonly variant: PanelVariant;
  readonly intent: { readonly x: number; readonly y: number; readonly align: 'left' | 'center'; readonly chars: number } | null;
}

export interface StageGeometry {
  /** The field's height from the top of the screen; the command box and menus sit under or over its bottom. */
  readonly height: number;
  /** Where the floor starts (the horizon dither is the 6 rows above it). */
  readonly floorY: number;
  readonly slots: Readonly<Record<SlotName, SlotGeometry>>;
}

/** v0's 320-wide landscape field. */
export const FIELD_WIDTH = 320;
/** The widest panel (CreaturePanel 'player' / 'sub'). */
export const PANEL_WIDTH = 126;

const LANDSCAPE: StageGeometry = {
  height: 136,
  floorY: 40,
  slots: {
    foe: { sprite: { x: 248, y: 74 }, panel: { x: 6, y: 6 }, variant: 'foe', intent: { x: 6, y: 40, align: 'left', chars: 32 } },
    foeSub: { sprite: { x: 188, y: 64 }, panel: { x: 6, y: 52 }, variant: 'foe', intent: { x: 6, y: 84, align: 'left', chars: 28 } },
    player: { sprite: { x: 64, y: 140 }, panel: { x: 188, y: 90 }, variant: 'player', intent: null },
    playerSub: { sprite: { x: 136, y: 142 }, panel: { x: 188, y: 72 }, variant: 'sub', intent: { x: 136, y: 62, align: 'center', chars: 24 } },
  },
};

const PORTRAIT: StageGeometry = {
  height: 252,
  floorY: 52,
  slots: {
    foe: { sprite: { x: 204, y: 104 }, panel: { x: 6, y: 6 }, variant: 'foe', intent: { x: 6, y: 42, align: 'left', chars: 22 } },
    foeSub: { sprite: { x: 150, y: 96 }, panel: { x: 6, y: 56 }, variant: 'foe', intent: { x: 6, y: 90, align: 'left', chars: 22 } },
    player: { sprite: { x: 68, y: 202 }, panel: { x: 6, y: 206 }, variant: 'player', intent: null },
    playerSub: { sprite: { x: 196, y: 202 }, panel: { x: 138, y: 206 }, variant: 'sub', intent: { x: 196, y: 120, align: 'center', chars: 22 } },
  },
};

const shift = (g: StageGeometry, dx: number): StageGeometry => ({
  ...g,
  slots: Object.fromEntries(
    Object.entries(g.slots).map(([k, s]) => [
      k,
      { ...s, sprite: { x: s.sprite.x + dx, y: s.sprite.y }, panel: { x: s.panel.x + dx, y: s.panel.y }, intent: s.intent && { ...s.intent, x: s.intent.x + dx } },
    ]),
  ) as Record<SlotName, SlotGeometry>,
});

export function stageGeometry(l: Layout): StageGeometry {
  if (l.mode === 'portrait') return PORTRAIT;
  // Centred in the safe area, so the side controls stay off it where they can.
  return shift(LANDSCAPE, l.safe.x + Math.floor((l.safe.width - FIELD_WIDTH) / 2));
}
