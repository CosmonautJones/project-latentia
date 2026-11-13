// One action stream for every input source. Keyboard, the touch controls and pointer taps on menu items all call
// into the hub; scenes and UI components subscribe to it and never read devices directly.

import { BUTTONS, type Button } from './actions.js';

export type InputSource = 'keyboard' | 'touch' | 'hook';

export type InputAction =
  | { readonly kind: 'press'; readonly button: Button }
  | { readonly kind: 'release'; readonly button: Button }
  /** A pointer tap on item `index` of menu `menuId`. */
  | { readonly kind: 'pick'; readonly menuId: string; readonly index: number };

export type InputListener = (action: InputAction) => void;

export class InputHub {
  private readonly holders = new Map<Button, Set<InputSource>>();
  private listeners: InputListener[] = [];

  subscribe(listener: InputListener): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** A button goes down. Repeats while already held (key auto-repeat, a second source) emit nothing. */
  press(button: Button, source: InputSource): void {
    const set = this.holders.get(button) ?? new Set<InputSource>();
    const wasHeld = set.size > 0;
    set.add(source);
    this.holders.set(button, set);
    if (!wasHeld) this.emit({ kind: 'press', button });
  }

  /** A button comes up. It is released only when the last source holding it lets go. */
  release(button: Button, source: InputSource): void {
    const set = this.holders.get(button);
    if (!set?.delete(source)) return;
    if (set.size === 0) this.emit({ kind: 'release', button });
  }

  /** Release everything: the window lost focus or the page was hidden, so key-ups may never arrive. */
  releaseAll(): void {
    for (const button of BUTTONS) {
      const set = this.holders.get(button);
      if (set && set.size > 0) {
        set.clear();
        this.emit({ kind: 'release', button });
      }
    }
  }

  tap(button: Button, source: InputSource = 'hook'): void {
    this.press(button, source);
    this.release(button, source);
  }

  pick(menuId: string, index: number): void {
    this.emit({ kind: 'pick', menuId, index });
  }

  isHeld(button: Button): boolean {
    return (this.holders.get(button)?.size ?? 0) > 0;
  }

  private emit(action: InputAction): void {
    // Iterate a snapshot so a listener added mid-dispatch (the next scene) does not see this action, and skip any
    // listener removed mid-dispatch (a scene shutting down) so it never acts after it has gone.
    const snapshot = this.listeners;
    for (const l of snapshot) if (this.listeners.includes(l)) l(action);
  }
}
