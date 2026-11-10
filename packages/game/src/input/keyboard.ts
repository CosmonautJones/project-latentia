// Keyboard → action stream. Listens on the window so no element needs focus.

import { keyToButton } from './actions.js';
import type { InputHub } from './hub.js';

export function bindKeyboard(target: Window, hub: InputHub): () => void {
  const down = (e: KeyboardEvent) => {
    const button = keyToButton(e);
    if (!button) return;
    e.preventDefault(); // arrows would scroll the page
    hub.press(button, 'keyboard');
  };
  const up = (e: KeyboardEvent) => {
    const button = keyToButton(e);
    if (button) hub.release(button, 'keyboard');
  };
  const releaseAll = () => hub.releaseAll();
  const onVisibility = () => {
    if (target.document.visibilityState === 'hidden') hub.releaseAll();
  };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', releaseAll);
  target.document.addEventListener('visibilitychange', onVisibility);
  return () => {
    target.removeEventListener('keydown', down);
    target.removeEventListener('keyup', up);
    target.removeEventListener('blur', releaseAll);
    target.document.removeEventListener('visibilitychange', onVisibility);
  };
}
