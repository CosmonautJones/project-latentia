// localStorage while the page may use it; otherwise (a sandboxed frame, storage disabled, a full quota, Safari's
// private mode) an in-memory stand-in, so the game still plays, just without a save that outlives the tab. Every
// call is guarded: the first failure switches to memory for good and calls `onUnavailable` once (main.ts shows the
// small "saves unavailable" notice).

import type { KeyValueStorage } from './save.js';

function memoryStorage(): KeyValueStorage {
  const mem = new Map<string, string>();
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
    removeItem: (k) => void mem.delete(k),
  };
}

export function browserStorage(win: Window, onUnavailable: () => void = () => {}): KeyValueStorage {
  let real: KeyValueStorage | null = null;
  try {
    const s = win.localStorage as Storage | null;
    if (s) {
      s.getItem('latentia.probe');
      real = s;
    }
  } catch {
    real = null;
  }
  const mem = memoryStorage();
  let failed = false;
  const fail = () => {
    real = null;
    if (failed) return;
    failed = true;
    onUnavailable();
  };
  if (real === null) fail();

  /** Run `op` on localStorage; on any throw, fall back to memory from now on and run it there. */
  const guarded = <T>(op: (s: KeyValueStorage) => T): T => {
    if (real !== null) {
      try {
        return op(real);
      } catch {
        fail();
      }
    }
    return op(mem);
  };
  return {
    getItem: (k) => guarded((s) => s.getItem(k)),
    setItem: (k, v) => guarded((s) => s.setItem(k, v)),
    removeItem: (k) => guarded((s) => s.removeItem(k)),
  };
}
