import { describe, expect, it } from 'vitest';
import { FlowController } from '../../src/flow/controller.js';
import { browserStorage } from '../../src/save/browser-storage.js';
import { loadSave, SAVE_KEY } from '../../src/save/save.js';

/** A Storage-like map; `fail` makes the named operations throw like a full or disabled localStorage. */
function fakeStorage(fail: { get?: boolean; set?: boolean } = {}) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => {
      if (fail.get) throw new DOMException('denied', 'SecurityError');
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (fail.set) throw new DOMException('full', 'QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
}

const windowWith = (storage: () => unknown) => {
  const win = {};
  Object.defineProperty(win, 'localStorage', { get: storage });
  return win as Window;
};

describe('browserStorage: saves degrade to memory, and say so once', () => {
  it('uses localStorage when it works, and never reports a problem', () => {
    const real = fakeStorage();
    let notices = 0;
    const s = browserStorage(windowWith(() => real), () => notices++);
    s.setItem(SAVE_KEY, '{}');
    expect(real.map.get(SAVE_KEY)).toBe('{}');
    expect(s.getItem(SAVE_KEY)).toBe('{}');
    expect(notices).toBe(0);
  });

  it('a localStorage getter that throws (sandboxed frame) falls back to memory and reports once', () => {
    let notices = 0;
    const s = browserStorage(
      windowWith(() => {
        throw new DOMException('denied', 'SecurityError');
      }),
      () => notices++,
    );
    expect(notices).toBe(1);
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    s.removeItem('k');
    expect(s.getItem('k')).toBeNull();
    expect(notices).toBe(1);
  });

  it('a missing localStorage (null) falls back to memory and reports once', () => {
    let notices = 0;
    const s = browserStorage(windowWith(() => null), () => notices++);
    s.setItem('k', 'v');
    expect(s.getItem('k')).toBe('v');
    expect(notices).toBe(1);
  });

  it('writes that start throwing later (quota, Safari private mode) switch to memory, keep the data, and report once', () => {
    const flaky = fakeStorage();
    let notices = 0;
    const s = browserStorage(windowWith(() => flaky), () => notices++);
    s.setItem('a', '1');
    flaky.map.clear();
    Object.assign(flaky, fakeStorage({ get: true, set: true }));
    expect(() => s.setItem('b', '2')).not.toThrow();
    expect(() => s.setItem('c', '3')).not.toThrow();
    expect(s.getItem('b')).toBe('2');
    expect(notices).toBe(1);
  });

  it('the whole journey plays on with storage that always throws: no crash, every step still advances', () => {
    let notices = 0;
    const s = browserStorage(windowWith(() => fakeStorage({ get: true, set: true })), () => notices++);
    const scenes: string[] = [];
    const flow = new FlowController(s, (scene) => scenes.push(scene));
    flow.start();
    expect(flow.send({ type: 'newGame' })).toBe(true);
    expect(flow.send({ type: 'starterPicked', starter: 'sagelet' })).toBe(true);
    expect(flow.state.step).toBe('rival');
    expect(scenes).toEqual(['Title', 'Overworld', 'Battle']);
    // The save lives in memory for this tab, so Continue still works within it.
    expect(loadSave(s).status).toBe('ok');
    expect(notices).toBe(1);
  });
});
