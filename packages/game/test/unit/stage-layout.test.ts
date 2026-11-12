import { describe, expect, it } from 'vitest';
import { FIELD_WIDTH, PANEL_WIDTH, stageGeometry } from '../../src/battle-ui/stage-layout.js';
import { computeViewport } from '../../src/layout/viewport.js';

describe('stageGeometry', () => {
  const sizes = [
    { width: 1366, height: 768, dpr: 1, touch: false },
    { width: 844, height: 390, dpr: 3, touch: true },
    { width: 390, height: 844, dpr: 3, touch: true },
    { width: 360, height: 640, dpr: 3, touch: true },
  ];

  it('every panel and sprite is on screen, and the field ends above the command box', () => {
    for (const v of sizes) {
      const l = computeViewport(v);
      const g = stageGeometry(l);
      for (const [name, s] of Object.entries(g.slots)) {
        expect(s.panel.x, `${name} panel`).toBeGreaterThanOrEqual(0);
        expect(s.panel.x + PANEL_WIDTH, `${name} panel`).toBeLessThanOrEqual(l.logical.width);
        expect(s.sprite.x - 32 >= 0 && s.sprite.x + 32 <= l.logical.width, `${name} sprite`).toBe(true);
      }
      // The bottom box (42 px) fits under the field.
      expect(g.height + 42, `${v.width}x${v.height}`).toBeLessThanOrEqual(l.safe.y + l.safe.height);
    }
  });

  it('landscape centres v0 field in the safe area', () => {
    const l = computeViewport({ width: 1366, height: 768, dpr: 1, touch: false });
    expect(stageGeometry(l).slots.foe.panel.x).toBe(6 + Math.floor((l.logical.width - FIELD_WIDTH) / 2));
  });
});
