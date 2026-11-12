// Where the battle's pieces go (plan v0.1 Q2, rulings V11-V14), from the layout, for every logical size V16 allows
// (240-270 short side, 426-540 long side). Pure, so it is unit-tested.
// - Landscape: the foe top right with its panel and telegraph top left, your side bottom left with its panel to the
//   right of it, and the text and menu in a band along the bottom. The band's buttons sit below the touch controls
//   (which are vertically centred at the sides) and span the whole width; its text lines stay inside the safe strip.
// - Portrait: the foe at the top, your side in the middle with the panels under the sprites, the band at the bottom;
//   the band takes as many button rows as the height allows, so there is no empty stretch.
// The menu never covers your creature's HP or pips: the panels are always above the band.

import type { Layout, Rect } from '../layout/viewport.js';

export type SlotName = 'foe' | 'foeSub' | 'player' | 'playerSub';
export type PanelVariant = 'foe' | 'player' | 'sub';

export interface SlotGeometry {
  /** Where the creature's feet stand. */
  readonly sprite: { readonly x: number; readonly y: number };
  readonly panel: Rect;
  readonly variant: PanelVariant;
}

export interface BattleGeometry {
  /** The framed band along the bottom: text lines, then the button rows. */
  readonly band: Rect;
  /** Where the text lines go (inside the safe area), and how many there are. */
  readonly text: Rect;
  readonly lines: number;
  /** The button grid: `rows` rows of the tap size. */
  readonly buttons: Rect;
  readonly rows: number;
  /** Columns of the move list (three where the band is wide enough for full names, else two). */
  readonly columns: number;
  readonly pitch: number;
  /** The field is everything above the band; the floor starts at floorY. */
  readonly height: number;
  readonly floorY: number;
  readonly slots: Readonly<Record<SlotName, SlotGeometry>>;
  /** The foe's telegraph box (and its subagent's), under its panel. */
  readonly foePlan: Rect;
  readonly foeSubPlan: Rect;
}

export interface GeometryOptions {
  /** A subagent fights on the player's side: the band carries its plan (two more lines). */
  readonly mate: boolean;
  /** How many moves the list holds (portrait uses no more rows than it needs). */
  readonly moves: number;
  /** How far the foe's drawing reaches above its feet (ART_REACH), so a short foe can stand higher. */
  readonly foeReach?: number;
}

/**
 * How far each battle drawing reaches above its feet, measured from the art pass's sheets (the highest opaque row of
 * any idle frame to the baseline): a short creature can stand higher on a short screen. Unknown species use the most.
 */
export const ART_REACH: Readonly<Record<string, number>> = { sagelet: 82, blitzr: 83, forkling: 77, tokenibble: 57, vibrat: 67 };
export const artReach = (species: string): number => ART_REACH[species] ?? SPRITE_REACH.up;

export const PANEL_HEIGHT: Readonly<Record<PanelVariant, number>> = { foe: 24, player: 34, sub: 14 };
/** How far a 96 px creature's art reaches from its feet: half the frame either side, and up to the tallest drawing. */
export const SPRITE_REACH = { side: 48, up: 83 } as const;
export const LINE = 10;
/** The foe telegraph box: one line in landscape, a label line and the line in portrait. */
const PLAN_LINE = 12;

/** The touch controls' vertical span in logical px (landscape: vertically centred at the sides), or null. */
export function controlSpan(l: Layout): { top: number; bottom: number } | null {
  const rects = Object.values(l.buttons).filter((r): r is Rect => r !== undefined);
  if (rects.length === 0) return null;
  const k = l.game.height / l.logical.height;
  const top = Math.min(...rects.map((r) => (r.y - l.game.y) / k));
  const bottom = Math.max(...rects.map((r) => (r.y + r.height - l.game.y) / k));
  return { top: Math.floor(top), bottom: Math.ceil(bottom) };
}

function band(l: Layout, x: number, width: number, bottom: number, lines: number, rows: number, pitch: number) {
  const buttons: Rect = { x: x + 3, y: bottom - 3 - rows * pitch, width: width - 6, height: rows * pitch };
  const textY = buttons.y - 1 - lines * LINE;
  const text: Rect = { x: Math.max(l.safe.x, x) + 6, y: textY, width: Math.min(l.safe.x + l.safe.width, x + width) - Math.max(l.safe.x, x) - 12, height: lines * LINE };
  const frame: Rect = { x, y: textY - 4, width, height: bottom - (textY - 4) };
  return { band: frame, text, buttons };
}

function landscape(l: Layout, o: GeometryOptions): BattleGeometry {
  const W = l.logical.width;
  const H = l.logical.height;
  const L = l.safe.x;
  const R = l.safe.x + l.safe.width;
  const span = controlSpan(l);
  const pitch = Math.max(l.tap, 16);
  const lines = o.mate ? 4 : 2;
  const b = band(l, 0, W, H, lines, 2, pitch);
  const F = b.band.y;
  // The top corners are clear of side controls that start well below them.
  const cornerClear = span === null || span.top >= 48;
  const topL = cornerClear ? 4 : L + 4;
  const player: Rect = { x: R - 2 - 128, y: F - 2 - PANEL_HEIGHT.player, width: 128, height: PANEL_HEIGHT.player };
  const sub: Rect = { x: player.x, y: player.y - 1 - PANEL_HEIGHT.sub, width: 128, height: PANEL_HEIGHT.sub };
  const highest = o.mate ? sub.y : player.y;
  const foeX = cornerClear ? W - 52 : R - 52;
  const foeY = Math.max(o.foeReach ?? SPRITE_REACH.up, Math.min(92, highest - 4));
  const foePanel: Rect = { x: topL, y: 4, width: 122, height: PANEL_HEIGHT.foe };
  const planW = Math.min(196, foeX - 44 - topL);
  return {
    ...b,
    lines,
    rows: 2,
    columns: b.buttons.width / 3 >= 130 ? 3 : 2,
    pitch,
    height: F,
    floorY: Math.min(48, F - 40),
    foePlan: { x: topL, y: foePanel.y + foePanel.height + 2, width: planW, height: PLAN_LINE + 2 },
    foeSubPlan: { x: topL, y: foePanel.y + 2 * foePanel.height + 20, width: planW, height: PLAN_LINE + 2 },
    slots: {
      foe: { sprite: { x: foeX, y: foeY }, panel: foePanel, variant: 'foe' },
      foeSub: { sprite: { x: foeX - 70, y: foeY - 6 }, panel: { ...foePanel, y: foePanel.y + foePanel.height + 18 }, variant: 'foe' },
      player: { sprite: { x: L + 50, y: F - 3 }, panel: player, variant: 'player' },
      playerSub: { sprite: { x: Math.min(L + 114, player.x - 40), y: F - 12 }, panel: sub, variant: 'sub' },
    },
  };
}

/** The least field a portrait battle needs: the foe's HUD and sprite, then your side's sprites and panels. */
const PORTRAIT_FIELD = 220;

function portrait(l: Layout, o: GeometryOptions): BattleGeometry {
  const W = l.logical.width;
  const bottom = l.safe.y + l.safe.height;
  const pitch = l.tap;
  const lines = o.mate ? 5 : 3;
  const fit = Math.floor((bottom - l.safe.y - PORTRAIT_FIELD - 8 - lines * LINE) / pitch);
  const rows = Math.max(2, Math.min(Math.ceil(o.moves / 2), fit));
  const columns = 2;
  const b = band(l, 0, W, bottom, lines, rows, pitch);
  const F = b.band.y;
  const top = l.safe.y;
  const half = Math.floor((W - 12) / 2);
  const panelY = F - 2 - PANEL_HEIGHT.player;
  const feet = panelY - 3;
  const foeFeet = Math.max(top + 96, Math.min(top + 150, Math.round(top + F * 0.36)));
  const foePanel: Rect = { x: 4, y: top + 4, width: 122, height: PANEL_HEIGHT.foe };
  return {
    ...b,
    lines,
    rows,
    columns,
    pitch,
    height: F,
    floorY: top + 56,
    foePlan: { x: 4, y: foePanel.y + foePanel.height + 2, width: Math.min(140, W - 104), height: 2 * PLAN_LINE },
    foeSubPlan: { x: 4, y: foePanel.y + 2 * foePanel.height + 32, width: Math.min(140, W - 104), height: 2 * PLAN_LINE },
    slots: {
      foe: { sprite: { x: W - 56, y: foeFeet }, panel: foePanel, variant: 'foe' },
      foeSub: { sprite: { x: W - 120, y: foeFeet - 8 }, panel: { ...foePanel, y: foePanel.y + foePanel.height + 30 }, variant: 'foe' },
      player: { sprite: { x: 4 + Math.floor(half / 2), y: feet }, panel: { x: 4, y: panelY, width: half, height: PANEL_HEIGHT.player }, variant: 'player' },
      playerSub: { sprite: { x: W - 4 - Math.floor(half / 2), y: feet }, panel: { x: W - 4 - half, y: panelY, width: half, height: PANEL_HEIGHT.sub }, variant: 'sub' },
    },
  };
}

export function battleGeometry(l: Layout, o: GeometryOptions): BattleGeometry {
  return l.mode === 'portrait' ? portrait(l, o) : landscape(l, o);
}
