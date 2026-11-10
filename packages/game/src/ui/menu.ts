// The pure model of a vertical menu: up/down move the cursor (wrapping), A confirms, B cancels, and a pointer
// tap on an item of this menu moves there and confirms.

import type { InputAction } from '../input/hub.js';

export interface MenuState {
  readonly id: string;
  readonly items: readonly string[];
  readonly index: number;
}

export interface MenuOutcome {
  readonly menu: MenuState;
  readonly confirm?: number;
  readonly cancel?: true;
}

export function createMenu(id: string, items: readonly string[], index = 0): MenuState {
  if (items.length === 0) throw new Error(`menu ${id} has no items`);
  return { id, items, index: Math.min(Math.max(0, index), items.length - 1) };
}

const move = (m: MenuState, delta: number): MenuState => ({ ...m, index: (m.index + delta + m.items.length) % m.items.length });

export function menuInput(menu: MenuState, action: InputAction): MenuOutcome {
  if (action.kind === 'pick') {
    if (action.menuId !== menu.id || action.index < 0 || action.index >= menu.items.length) return { menu };
    const picked = { ...menu, index: action.index };
    return { menu: picked, confirm: action.index };
  }
  if (action.kind !== 'press') return { menu };
  switch (action.button) {
    case 'up':
      return { menu: move(menu, -1) };
    case 'down':
      return { menu: move(menu, 1) };
    case 'a':
      return { menu, confirm: menu.index };
    case 'b':
      return { menu, cancel: true };
    default:
      return { menu };
  }
}
