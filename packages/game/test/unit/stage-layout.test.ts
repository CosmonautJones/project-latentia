import { describe, expect, it } from 'vitest';
import { ART_REACH, battleGeometry, DIRECT_MIN_HEIGHT, LINE, PANEL_HEIGHT, spriteBox, SPRITE_REACH, type BattleGeometry } from '../../src/battle-ui/stage-layout.js';
import { computeViewport, type Insets, type Layout, type Rect, type Viewport } from '../../src/layout/viewport.js';

// The battle layout (plan v0.1 Q2) at every size the plan reviews, both 240 px short sides (V16) and the largest
// logical sizes, with and without a subagent on the player's side.

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: Rect, b: Rect) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const art = (s: { x: number; y: number }): Rect => ({ x: s.x - 40, y: s.y - SPRITE_REACH.up, width: 80, height: SPRITE_REACH.up });

/** The touch controls' rects in logical px. */
function controls(l: Layout): Rect[] {
  const k = l.game.width / l.logical.width;
  return Object.values(l.buttons)
    .filter((r): r is Rect => r !== undefined)
    .map((r) => ({ x: (r.x - l.game.x) / k, y: (r.y - l.game.y) / k, width: r.width / k, height: r.height / k }));
}

const SIZES = [
  { width: 1366, height: 768, dpr: 1, touch: false },
  { width: 1920, height: 1080, dpr: 1, touch: false },
  { width: 844, height: 390, dpr: 3, touch: true },
  { width: 390, height: 844, dpr: 3, touch: true },
  { width: 360, height: 640, dpr: 3, touch: true },
  { width: 640, height: 360, dpr: 3, touch: true },
  { width: 360, height: 640, dpr: 2, touch: true },
  { width: 640, height: 360, dpr: 2, touch: true },
  { width: 412, height: 915, dpr: 2.625, touch: true },
  { width: 915, height: 412, dpr: 2.625, touch: true },
];

describe('battleGeometry', () => {
  for (const v of SIZES) {
    for (const mate of [false, true]) {
      const l = computeViewport(v);
      // The subagent fights beside you only against the Bootcamp Grad, whose Vibrat is shorter than the starters.
      const foeReach = mate ? (ART_REACH['vibrat'] ?? SPRITE_REACH.up) : SPRITE_REACH.up;
      const g = battleGeometry(l, { mate, moves: 7, foeReach });
      const at = `${v.width}x${v.height}@${v.dpr}${mate ? ' with a subagent' : ''}`;
      const screen: Rect = { x: 0, y: 0, width: l.logical.width, height: l.logical.height };
      const panels = Object.entries(g.slots)
        .filter(([name]) => mate || name !== 'playerSub')
        .filter(([name]) => name !== 'foeSub')
        .map(([name, s]) => ({ name, r: s.panel }));

      it(`${at}: the band is at the bottom, its buttons are at least the tap size and clear of the touch controls`, () => {
        expect(g.band.y + g.band.height).toBe(l.mode === 'portrait' ? l.safe.y + l.safe.height : l.logical.height);
        expect(g.pitch).toBeGreaterThanOrEqual(l.tap);
        expect(g.rows).toBeGreaterThanOrEqual(2);
        expect(inside(g.buttons, g.band)).toBe(true);
        for (const c of controls(l)) expect(overlaps(g.buttons, c), `buttons vs a control at ${c.x},${c.y}`).toBe(false);
        // The text lines stay inside the safe area (they sit beside the side controls in landscape).
        expect(g.text.x).toBeGreaterThanOrEqual(l.safe.x);
        expect(g.text.x + g.text.width).toBeLessThanOrEqual(l.safe.x + l.safe.width);
        expect(g.text.y).toBeGreaterThan(g.band.y);
        expect(g.text.y + g.text.height).toBeLessThanOrEqual(g.buttons.y);
        if (l.mode === 'landscape') expect(g.lines).toBe(mate ? 4 : 2);
        else expect(g.lines).toBeGreaterThanOrEqual(mate ? 5 : 3);
      });

      it(`${at}: the menu never covers a panel; panels are in the safe area, on screen and clear of each other and the telegraph`, () => {
        for (const { name, r } of panels) {
          expect(r.y + r.height, `${name} panel bottom`).toBeLessThanOrEqual(g.band.y);
          expect(r.x, `${name} panel`).toBeGreaterThanOrEqual(name === 'foe' ? 0 : l.safe.x);
          expect(r.x + r.width, `${name} panel`).toBeLessThanOrEqual(l.safe.x + l.safe.width);
          expect(inside(r, screen)).toBe(true);
          for (const o of panels) if (o.name !== name) expect(overlaps(r, o.r), `${name} and ${o.name} panels`).toBe(false);
          expect(overlaps(r, g.foePlan), `${name} panel and the foe telegraph`).toBe(false);
        }
        expect(g.slots.player.panel.height).toBe(PANEL_HEIGHT.player);
        for (const c of controls(l)) for (const { name, r } of panels) expect(overlaps(r, c), `${name} panel vs a control`).toBe(false);
        for (const c of controls(l)) expect(overlaps(g.foePlan, c), 'the telegraph vs a control').toBe(false);
      });

      it(`${at}: every sprite is on screen, above the band, and clear of the HUD it does not belong to`, () => {
        const names = mate ? (['foe', 'player', 'playerSub'] as const) : (['foe', 'player'] as const);
        for (const n of names) {
          const s = g.slots[n].sprite;
          expect(s.x - SPRITE_REACH.side, `${n} x`).toBeGreaterThanOrEqual(0);
          expect(s.x + SPRITE_REACH.side, `${n} x`).toBeLessThanOrEqual(l.logical.width);
          expect(s.y - (n === 'foe' ? foeReach : SPRITE_REACH.up), `${n} top`).toBeGreaterThanOrEqual(l.mode === 'portrait' ? l.safe.y : 0);
          expect(s.y, `${n} feet`).toBeLessThanOrEqual(g.band.y);
        }
        const foe = { ...art(g.slots.foe.sprite), y: g.slots.foe.sprite.y - foeReach, height: foeReach };
        for (const { name, r } of panels) expect(overlaps(foe, r), `the foe sprite vs the ${name} panel`).toBe(false);
        expect(overlaps(foe, g.foePlan), 'the foe sprite vs its telegraph').toBe(false);
        expect(overlaps(art(g.slots.player.sprite), g.slots.player.panel), 'your sprite vs your panel').toBe(false);
      });
    }
  }

  it('tall portrait shows the moves directly: every move row and one system row, and the field has no big gap', () => {
    for (const v of [{ width: 390, height: 844, dpr: 3 }, { width: 412, height: 915, dpr: 2.625 }]) {
      const l = computeViewport({ ...v, touch: true });
      expect(l.logical.height).toBeGreaterThanOrEqual(DIRECT_MIN_HEIGHT);
      for (const mate of [false, true]) {
        const g = battleGeometry(l, { mate, moves: 7 });
        expect(g.direct).toBe(true);
        expect(g.rows).toBe(4);
        expect(g.system).not.toBeNull();
        const sys = g.system as Rect;
        expect(sys.height).toBeGreaterThanOrEqual(l.tap);
        expect(sys.y).toBeGreaterThanOrEqual(g.buttons.y + g.buttons.height);
        expect(sys.y + sys.height).toBeLessThanOrEqual(g.band.y + g.band.height);
        // The spare height went to the text and the field: no stretch of more than 48 px between the foe and your side.
        const playerTop = g.slots.player.sprite.y - SPRITE_REACH.up;
        expect(playerTop - g.slots.foe.sprite.y, `${v.width}x${v.height}${mate ? ' mate' : ''}`).toBeLessThanOrEqual(48);
        expect(g.slots.foe.sprite.y - SPRITE_REACH.up - l.safe.y).toBeLessThanOrEqual(48);
        expect(g.band.y - (g.slots.player.panel.y + g.slots.player.panel.height)).toBeLessThanOrEqual(4);
        expect(g.lines).toBeGreaterThan(mate ? 5 : 3);
        expect(g.text.height).toBe(g.lines * LINE);
      }
    }
  });

  it('shorter portrait screens and every landscape keep the PROMPT step', () => {
    for (const v of [{ width: 360, height: 640, dpr: 3 }, { width: 360, height: 640, dpr: 2 }, { width: 844, height: 390, dpr: 3 }, { width: 1366, height: 768, dpr: 1 }]) {
      const l = computeViewport({ ...v, touch: v.dpr > 1 });
      const g = battleGeometry(l, { mate: false, moves: 7 });
      expect(g.direct, `${v.width}x${v.height}`).toBe(false);
      expect(g.system).toBeNull();
    }
  });
});

// I-1: nothing the player reads or taps is under a touch control, at every plan size and both 240 px short sides, with
// and without an iPhone's safe-area insets (landscape: 47 px each side for the notch and 21 px for the home bar;
// portrait: 47 px at the top and 34 px at the bottom). Decoration (the band's frame, the floor) may run under them.
const LANDSCAPE_INSET: Insets = { top: 0, right: 47, bottom: 21, left: 47 };
const PORTRAIT_INSET: Insets = { top: 47, right: 0, bottom: 34, left: 0 };
const TOUCH_SIZES: Viewport[] = [
  ...SIZES.filter((v) => v.touch),
  { width: 667, height: 375, dpr: 2, touch: true },
  { width: 375, height: 667, dpr: 2, touch: true },
  { width: 926, height: 428, dpr: 3, touch: true },
  { width: 428, height: 926, dpr: 3, touch: true },
];

/** Every rect of the battle the player reads or taps, by name. */
function hud(g: BattleGeometry, foeReach: number, mate: boolean): { name: string; r: Rect }[] {
  const s = g.slots;
  return [
    { name: 'foe panel', r: s.foe.panel },
    { name: 'foe telegraph', r: g.foePlan },
    { name: 'foe subagent panel', r: s.foeSub.panel },
    { name: 'foe subagent telegraph', r: g.foeSubPlan },
    { name: 'player panel', r: s.player.panel },
    ...(mate ? [{ name: 'subagent panel', r: s.playerSub.panel }] : []),
    { name: 'text lines', r: g.text },
    { name: 'buttons', r: g.buttons },
    ...(g.system === null ? [] : [{ name: 'system row', r: g.system }]),
    { name: 'foe sprite', r: spriteBox(s.foe.sprite.x, s.foe.sprite.y, foeReach) },
    { name: 'player sprite', r: spriteBox(s.player.sprite.x, s.player.sprite.y, SPRITE_REACH.up) },
    ...(mate ? [{ name: 'subagent sprite', r: spriteBox(s.playerSub.sprite.x, s.playerSub.sprite.y, SPRITE_REACH.up) }] : []),
  ];
}

describe('nothing to read or tap is under the touch controls', () => {
  for (const v0 of TOUCH_SIZES) {
    for (const notch of [false, true]) {
      const v: Viewport = notch ? { ...v0, inset: v0.width > v0.height ? LANDSCAPE_INSET : PORTRAIT_INSET } : v0;
      const l = computeViewport(v);
      const at = `${v.width}x${v.height}@${v.dpr} (${l.logical.width}x${l.logical.height})${notch ? ' with insets' : ''}`;

      it(`${at}: the occluders are the controls in logical px, and the safe area (where every other scene lays out its dialogue box, menus and panels) is clear of them`, () => {
        // Each control's part over the image is inside an occluder; controls entirely off the image have none.
        const onImage = controls(l)
          .map((c) => ({ x: Math.max(0, c.x), y: Math.max(0, c.y), right: Math.min(l.logical.width, c.x + c.width), bottom: Math.min(l.logical.height, c.y + c.height) }))
          .filter((c) => c.right > c.x && c.bottom > c.y);
        expect(l.occluders).toHaveLength(onImage.length);
        for (const c of onImage) expect(l.occluders.some((o) => o.x <= c.x && o.y <= c.y && o.x + o.width >= c.right && o.y + o.height >= c.bottom)).toBe(true);
        for (const o of l.occluders) expect(overlaps(o, l.safe), 'the safe area vs a control').toBe(false);
      });

      for (const mate of [false, true]) {
        for (const foeReach of [SPRITE_REACH.up, ART_REACH['tokenibble'] ?? 57]) {
          it(`${at}${mate ? ' with a subagent' : ''}, foe reach ${foeReach}: no HUD, sprite, text or button rect meets a control`, () => {
            const g = battleGeometry(l, { mate, moves: 7, foeReach });
            for (const { name, r } of hud(g, foeReach, mate)) {
              for (const o of l.occluders) expect(overlaps(r, o), `${name} ${JSON.stringify(r)} vs control ${JSON.stringify(o)}`).toBe(false);
              expect(r.width, `${name} width`).toBeGreaterThan(0);
            }
            // The player's panel keeps 6 px from the button beside it (the occluder is already padded by 2).
            for (const o of l.occluders) {
              const p = g.slots.player.panel;
              if (p.y < o.y + o.height && o.y < p.y + p.height && o.x >= p.x + p.width) expect(o.x - (p.x + p.width)).toBeGreaterThanOrEqual(4);
            }
          });
        }
      }
    }
  }
});
