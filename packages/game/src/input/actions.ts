// The six virtual buttons every input source maps to, and the pure source-to-button mappings.

export const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b'] as const;
export type Button = (typeof BUTTONS)[number];

export interface KeyLike {
  readonly code: string;
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

// By KeyboardEvent.code (physical position), so WASD/ZX sit in the same place on every keyboard layout.
const KEY_CODES: Readonly<Record<string, Button>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  KeyZ: 'a',
  Enter: 'a',
  NumpadEnter: 'a',
  KeyX: 'b',
  Escape: 'b',
};

/** The button a key press means, or null. Chords with Ctrl/Meta/Alt are left to the browser. */
export function keyToButton(e: KeyLike): Button | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return Object.hasOwn(KEY_CODES, e.code) ? (KEY_CODES[e.code] ?? null) : null;
}

export const TOUCH_CONTROLS = ['dpad-up', 'dpad-down', 'dpad-left', 'dpad-right', 'btn-a', 'btn-b'] as const;
export type TouchControlId = (typeof TOUCH_CONTROLS)[number];

const TOUCH_BUTTONS: Readonly<Record<TouchControlId, Button>> = {
  'dpad-up': 'up',
  'dpad-down': 'down',
  'dpad-left': 'left',
  'dpad-right': 'right',
  'btn-a': 'a',
  'btn-b': 'b',
};

export function touchControlButton(id: string): Button | null {
  return (TOUCH_CONTROLS as readonly string[]).includes(id) ? TOUCH_BUTTONS[id as TouchControlId] : null;
}
