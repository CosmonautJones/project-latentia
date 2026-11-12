// Where the battlefield's pieces go, per orientation (plan v0.1 Q1 had the battle render at both sizes; Q2b redesigns
// it). Q2a sizes it for the 96 px creatures and for every logical size V16 allows (240-270 short, 426-540 long), from
// the layout rather than constants. Landscape: a field up to 360 wide, centred in the safe area, with the foe up and to
// the right, the player's side down and to the left, panels on the far sides. Portrait stacks it: the foe and its
// panel at the top, the player's side under them, the panels in a row under the player's sprites (or stacked, when
// two do not fit across). Pure, so it is unit-tested.

import type { Layout } from '../layout/viewport.js';
import type { PanelVariant } from './creature-panel.js';

export type SlotName = 'foe' | 'foeSub' | 'player' | 'playerSub';

export interface SlotGeometry {
  /** Where the creature's feet stand. */
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

/** CreaturePanel's sizes per variant. */
export const PANEL_WIDTH: Readonly<Record<PanelVariant, number>> = { foe: 120, player: 126, sub: 126 };
export const PANEL_HEIGHT: Readonly<Record<PanelVariant, number>> = { foe: 32, player: 44, sub: 16 };
/** How far a 96 px creature's art reaches from its feet: half the frame either side, and up to its tallest frame. */
export const SPRITE_REACH = { side: 48, up: 86 } as const;
/** The landscape field's widest. */
const FIELD_MAX = 360;

function landscape(l: Layout): StageGeometry {
  const fw = Math.min(FIELD_MAX, l.safe.width);
  const ox = l.safe.x + Math.floor((l.safe.width - fw) / 2);
  // The player's feet at the field's bottom; a shorter screen (240) keeps v0's 136 px field, under the root menu.
  const height = l.logical.height >= 256 ? 152 : 136;
  const right = ox + fw - 6 - PANEL_WIDTH.player;
  const panelY = height - PANEL_HEIGHT.player - (height >= 152 ? 4 : 0);
  // The foe stands as low as its platform clears the player's panel under it, and no lower than its art allows.
  const foeY = Math.max(SPRITE_REACH.up, Math.min(92, panelY - 6));
  return {
    height,
    floorY: 40,
    slots: {
      foe: { sprite: { x: ox + fw - 76, y: foeY }, panel: { x: ox + 6, y: 6 }, variant: 'foe', intent: { x: ox + 6, y: 40, align: 'left', chars: 32 } },
      foeSub: { sprite: { x: ox + fw - 140, y: Math.max(SPRITE_REACH.up, foeY - 4) }, panel: { x: ox + 6, y: 52 }, variant: 'foe', intent: { x: ox + 6, y: 86, align: 'left', chars: 28 } },
      player: { sprite: { x: ox + 64, y: height - 4 }, panel: { x: right, y: panelY }, variant: 'player', intent: null },
      playerSub: { sprite: { x: ox + 140, y: height - 2 }, panel: { x: right, y: panelY - PANEL_HEIGHT.sub - 2 }, variant: 'sub', intent: { x: ox + 140, y: height - 100, align: 'center', chars: 24 } },
    },
  };
}

function portrait(l: Layout): StageGeometry {
  const W = l.logical.width;
  const panelsY = 206;
  // Two panels across need 6 + 126 + 6 + 126 + 6 px; a 240 px screen stacks the subagent's under the player's.
  const across = W >= 2 * PANEL_WIDTH.player + 18;
  const sub = across ? { x: W - 6 - PANEL_WIDTH.sub, y: panelsY } : { x: 6, y: panelsY + PANEL_HEIGHT.player + 2 };
  const height = across ? panelsY + PANEL_HEIGHT.player + 2 : sub.y + PANEL_HEIGHT.sub + 4;
  return {
    height,
    floorY: 52,
    slots: {
      foe: { sprite: { x: W - 62, y: 100 }, panel: { x: 6, y: 6 }, variant: 'foe', intent: { x: 6, y: 42, align: 'left', chars: 22 } },
      foeSub: { sprite: { x: W - 118, y: 92 }, panel: { x: 6, y: 56 }, variant: 'foe', intent: { x: 6, y: 90, align: 'left', chars: 22 } },
      player: { sprite: { x: 68, y: 200 }, panel: { x: 6, y: panelsY }, variant: 'player', intent: null },
      playerSub: { sprite: { x: W - 74, y: 200 }, panel: sub, variant: 'sub', intent: { x: W - 74, y: 104, align: 'center', chars: 22 } },
    },
  };
}

export function stageGeometry(l: Layout): StageGeometry {
  return l.mode === 'portrait' ? portrait(l) : landscape(l);
}
