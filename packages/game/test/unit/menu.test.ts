import { describe, expect, it } from 'vitest';
import { createMenu, menuInput } from '../../src/ui/menu.js';

describe('menu', () => {
  const menu = createMenu('title', ['NEW GAME', 'CONTINUE', 'OPTIONS']);

  it('down and up move the cursor and wrap around', () => {
    let m = menuInput(menu, { kind: 'press', button: 'down' }).menu;
    expect(m.index).toBe(1);
    m = menuInput(m, { kind: 'press', button: 'down' }).menu;
    m = menuInput(m, { kind: 'press', button: 'down' }).menu;
    expect(m.index).toBe(0);
    m = menuInput(m, { kind: 'press', button: 'up' }).menu;
    expect(m.index).toBe(2);
  });

  it('A confirms the highlighted item, B cancels', () => {
    const m = menuInput(menu, { kind: 'press', button: 'down' }).menu;
    expect(menuInput(m, { kind: 'press', button: 'a' })).toEqual({ menu: m, confirm: 1 });
    expect(menuInput(m, { kind: 'press', button: 'b' })).toEqual({ menu: m, cancel: true });
  });

  it('a pointer pick on this menu moves the cursor there and confirms', () => {
    const r = menuInput(menu, { kind: 'pick', menuId: 'title', index: 2 });
    expect(r.menu.index).toBe(2);
    expect(r.confirm).toBe(2);
  });

  it('ignores picks for other menus or out of range, releases, and left/right', () => {
    for (const a of [
      { kind: 'pick', menuId: 'other', index: 0 },
      { kind: 'pick', menuId: 'title', index: 9 },
      { kind: 'release', button: 'a' },
      { kind: 'press', button: 'left' },
      { kind: 'press', button: 'right' },
    ] as const) {
      expect(menuInput(menu, a)).toEqual({ menu });
    }
  });

  it('rejects an empty menu', () => {
    expect(() => createMenu('x', [])).toThrow();
  });
});
