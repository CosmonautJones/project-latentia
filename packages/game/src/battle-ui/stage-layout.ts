// Where the battle's pieces go (plan v0.1 Q2, rulings V11-V14), from the layout, for every logical size V16 allows
// (240-270 short side, 426-540 long side). Pure, so it is unit-tested.
// - Nothing the player reads or taps sits under a touch control (the layout's occluders): the foe sprite, every panel
//   and telegraph, the band's text lines and buttons. Only decoration (the band's frame, the floor, the platforms) may.
// - Landscape: the foe top right with its panel and telegraph top left, your side bottom left with its panel to the
//   right of it, and the text and menu in a band along the bottom. The band's buttons sit below the touch controls
//   (which are vertically centred at the sides) and span the whole width; its text lines stay between the controls,
//   and its frame is notched around them. The foe stands as far right as it can while clear of A and B.
// - Portrait: the foe at the top, your side in the middle with the panels under the sprites, the band at the bottom,
//   sized to what it holds. On a tall portrait screen (logical height 500 or more, ruling on I-4) the moves are shown
//   directly, with WHY?, LOG, NUMBERS and SPEED in one compact row under them (no PROMPT step). Spare height goes to
//   extra text lines and is spread through the field (above the foe and between the two sides), never left in one gap.
// The menu never covers your creature's HP or pips: the panels are always above the band.

import { isClear, overlaps, type Layout, type Rect } from '../layout/viewport.js';

export type SlotName = 'foe' | 'foeSub' | 'player' | 'playerSub';
export type PanelVariant = 'foe' | 'player' | 'sub';

export interface SlotGeometry {
  /** Where the creature's feet stand. */
  readonly sprite: { readonly x: number; readonly y: number };
  readonly panel: Rect;
  readonly variant: PanelVariant;
}

export interface BattleGeometry {
  /** The band along the bottom (its bounding box): text lines, then the button rows. */
  readonly band: Rect;
  /** The band's frame as drawn: one rect, or two where it is notched around the side controls (landscape). */
  readonly frame: readonly Rect[];
  /** Tall portrait: the moves are the first screen, with the system row under them (no PROMPT step). */
  readonly direct: boolean;
  /** Where the compact system row (WHY? LOG NUMBERS SPEED) goes in direct mode; null otherwise. */
  readonly system: Rect | null;
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

/** Portrait screens at least this tall (logical px) show the moves directly (ruling on I-4). */
export const DIRECT_MIN_HEIGHT = 500;
/** The most extra text lines spare portrait height buys. */
const MAX_EXTRA_LINES = 3;
/** Between the move rows and the system row. */
const SYSTEM_GAP = 2;

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

/** The 96 px drawing of a creature standing at (x, y) reaching `reach` up: what must stay clear of the controls. */
export const spriteBox = (x: number, y: number, reach: number): Rect => ({ x: x - SPRITE_REACH.side, y: y - reach, width: 2 * SPRITE_REACH.side, height: reach + 2 });

function landscape(l: Layout, o: GeometryOptions): BattleGeometry {
  const W = l.logical.width;
  const H = l.logical.height;
  const L = l.safe.x;
  const R = l.safe.x + l.safe.width;
  const reach = o.foeReach ?? SPRITE_REACH.up;
  // At least two text lines tall, so a long move name wraps instead of being cut (desktop's tap is only 15 px).
  const pitch = Math.max(l.tap, 24);
  const lines = o.mate ? 4 : 2;
  const rows = 2;
  const buttons: Rect = { x: 3, y: H - 3 - rows * pitch, width: W - 6, height: rows * pitch };
  const textY = buttons.y - 1 - lines * LINE;
  const text: Rect = { x: L + 6, y: textY, width: R - L - 12, height: lines * LINE };
  const band: Rect = { x: 0, y: textY - 4, width: W, height: H - (textY - 4) };
  // The frame: full width where that is clear of the controls, else a strip between them over the text, widening to
  // the full width just above the buttons.
  const lower: Rect = { x: 0, y: buttons.y - 3, width: W, height: H - (buttons.y - 3) };
  const frame = isClear(band, l) ? [band] : [{ x: L, y: band.y, width: R - L, height: lower.y - band.y + 1 }, lower];
  const F = band.y;
  // Your panel 6 px or more from the button beside it (the safe edge is already GAP from it).
  const player: Rect = { x: R - 4 - 128, y: F - 2 - PANEL_HEIGHT.player, width: 128, height: PANEL_HEIGHT.player };
  const sub: Rect = { x: player.x, y: player.y - 1 - PANEL_HEIGHT.sub, width: 128, height: PANEL_HEIGHT.sub };
  const highest = o.mate ? sub.y : player.y;
  // The foe's panel and telegraph in the top-left corner when that is clear of the controls, else beside them.
  const cornerClear = isClear({ x: 4, y: 4, width: 122, height: 2 + PANEL_HEIGHT.foe + PLAN_LINE + 2 }, l);
  const topL = cornerClear ? 4 : L + 4;
  const foePanel: Rect = { x: topL, y: 4, width: 122, height: PANEL_HEIGHT.foe };
  const foeY = Math.max(reach, Math.min(92, highest - 4));
  // The right-most spot (up to the top-right corner) where the foe's drawing is clear of the controls, the HUD and
  // your side; failing that, the right-most clear of the controls alone.
  const mine = [player, spriteBox(L + 50, F - 3, SPRITE_REACH.up), ...(o.mate ? [sub] : [])];
  const clearAt = (x: number) => isClear(spriteBox(x, foeY, reach), l);
  const fits = (x: number) => {
    const box = spriteBox(x, foeY, reach);
    return clearAt(x) && box.x >= topL + foePanel.width + 4 && mine.every((r) => !overlaps(box, r));
  };
  const xs = Array.from({ length: Math.max(0, W - 52 - (L + 52)) + 1 }, (_, i) => W - 52 - i);
  const foeX = xs.find(fits) ?? xs.find(clearAt) ?? R - 52;
  const planW = Math.min(196, foeX - SPRITE_REACH.side - 4 - topL);
  const foePlan: Rect = { x: topL, y: foePanel.y + foePanel.height + 2, width: planW, height: PLAN_LINE + 2 };
  // A foe subagent (none in v0.1): its panel under the foe's telegraph and its own under that; where the controls
  // are in the way, a compact panel with the telegraph beside it.
  const stackedPanel: Rect = { ...foePanel, y: foePanel.y + foePanel.height + 18 };
  const below: Rect = { x: topL, y: stackedPanel.y + stackedPanel.height + 2, width: planW, height: PLAN_LINE + 2 };
  const stacked = isClear(stackedPanel, l) && isClear(below, l);
  const compactPanel: Rect = { ...stackedPanel, height: PANEL_HEIGHT.sub };
  const besideX = topL + compactPanel.width + 2;
  const beside: Rect = { x: besideX, y: compactPanel.y, width: Math.max(0, foeX - SPRITE_REACH.side - 4 - besideX), height: PLAN_LINE + 2 };
  return {
    band,
    frame,
    direct: false,
    system: null,
    text,
    buttons,
    lines,
    rows,
    columns: buttons.width / 3 >= 130 ? 3 : 2,
    pitch,
    height: F,
    floorY: Math.min(48, F - 40),
    foePlan,
    foeSubPlan: stacked ? below : beside,
    slots: {
      foe: { sprite: { x: foeX, y: foeY }, panel: foePanel, variant: 'foe' },
      foeSub: { sprite: { x: foeX - 70, y: foeY - 6 }, panel: stacked ? stackedPanel : compactPanel, variant: stacked ? 'foe' : 'sub' },
      player: { sprite: { x: L + 50, y: F - 3 }, panel: player, variant: 'player' },
      playerSub: { sprite: { x: Math.max(L + SPRITE_REACH.side, Math.min(L + 114, player.x - 40)), y: F - 12 }, panel: sub, variant: 'sub' },
    },
  };
}

/** The least field a portrait battle needs: the foe's HUD and sprite, then your side's sprites and panels. */
const PORTRAIT_FIELD = 220;

function portrait(l: Layout, o: GeometryOptions): BattleGeometry {
  const W = l.logical.width;
  const top = l.safe.y;
  const bottom = l.safe.y + l.safe.height;
  const pitch = l.tap;
  const reach = o.foeReach ?? SPRITE_REACH.up;
  const baseLines = o.mate ? 5 : 3;
  const moveRows = Math.ceil(o.moves / 2);
  const fit = Math.floor((bottom - top - PORTRAIT_FIELD - 8 - baseLines * LINE) / pitch);
  const direct = l.logical.height >= DIRECT_MIN_HEIGHT && fit >= moveRows + 1;
  const rows = direct ? moveRows : Math.max(2, Math.min(moveRows, fit));
  const systemH = direct ? pitch + SYSTEM_GAP : 0;
  // The band is what it holds; half the height left over buys text lines, the rest spreads through the field.
  const bandMin = 4 + baseLines * LINE + 1 + rows * pitch + systemH + 3;
  const spare = Math.max(0, bottom - top - PORTRAIT_FIELD - bandMin);
  const lines = baseLines + Math.min(MAX_EXTRA_LINES, Math.floor(spare / 2 / LINE));
  const system: Rect | null = direct ? { x: 3, y: bottom - 3 - pitch, width: W - 6, height: pitch } : null;
  const buttons: Rect = { x: 3, y: bottom - 3 - systemH - rows * pitch, width: W - 6, height: rows * pitch };
  const textY = buttons.y - 1 - lines * LINE;
  const band: Rect = { x: 0, y: textY - 4, width: W, height: bottom - (textY - 4) };
  const F = band.y;
  const half = Math.floor((W - 12) / 2);
  const panelY = F - 2 - PANEL_HEIGHT.player;
  const feet = panelY - 3;
  // The field's slack, split evenly above the foe and between the foe and your side.
  const free = Math.max(0, feet - SPRITE_REACH.up - 4 - (top + 4 + reach));
  const foeFeet = top + 4 + reach + Math.floor(free / 2);
  const foePanel: Rect = { x: 4, y: top + 4, width: 122, height: PANEL_HEIGHT.foe };
  const planW = Math.min(140, W - 2 * SPRITE_REACH.side - 8 - 8 - 4);
  return {
    band,
    frame: [band],
    direct,
    system,
    text: { x: 6, y: textY, width: W - 12, height: lines * LINE },
    buttons,
    lines,
    rows,
    columns: 2,
    pitch,
    height: F,
    floorY: top + 56,
    foePlan: { x: 4, y: foePanel.y + foePanel.height + 2, width: planW, height: 2 * PLAN_LINE },
    foeSubPlan: { x: 4, y: foePanel.y + 2 * foePanel.height + 32, width: planW, height: 2 * PLAN_LINE },
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
