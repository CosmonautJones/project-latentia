// localStorage when the page may use it; otherwise (sandboxed frame, storage disabled) an in-memory stand-in,
// so the game still plays, just without a save that outlives the tab.

import type { KeyValueStorage } from './save.js';

export function browserStorage(win: Window): KeyValueStorage {
  try {
    const s = win.localStorage;
    s.getItem('latentia.probe');
    return s;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
}
