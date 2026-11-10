import { describe, expect, it } from 'vitest';
import { BUTTONS, keyToButton, touchControlButton, TOUCH_CONTROLS } from '../../src/input/actions.js';
import { InputHub, type InputAction } from '../../src/input/hub.js';

const key = (code: string, key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  code,
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

describe('keyToButton', () => {
  it('maps arrows and WASD to directions', () => {
    expect(keyToButton(key('ArrowUp', 'ArrowUp'))).toBe('up');
    expect(keyToButton(key('ArrowDown', 'ArrowDown'))).toBe('down');
    expect(keyToButton(key('ArrowLeft', 'ArrowLeft'))).toBe('left');
    expect(keyToButton(key('ArrowRight', 'ArrowRight'))).toBe('right');
    expect(keyToButton(key('KeyW', 'w'))).toBe('up');
    expect(keyToButton(key('KeyA', 'a'))).toBe('left');
    expect(keyToButton(key('KeyS', 's'))).toBe('down');
    expect(keyToButton(key('KeyD', 'd'))).toBe('right');
  });

  it('maps Z and Enter to A, X and Esc to B', () => {
    expect(keyToButton(key('KeyZ', 'z'))).toBe('a');
    expect(keyToButton(key('Enter', 'Enter'))).toBe('a');
    expect(keyToButton(key('NumpadEnter', 'Enter'))).toBe('a');
    expect(keyToButton(key('KeyX', 'x'))).toBe('b');
    expect(keyToButton(key('Escape', 'Escape'))).toBe('b');
  });

  it('uses physical key position for WASD/ZX (an AZERTY Z key still reads as KeyW position)', () => {
    // On AZERTY the key labelled "Z" sits at code KeyW: it is "up", by position.
    expect(keyToButton(key('KeyW', 'z'))).toBe('up');
  });

  it('ignores unmapped keys and anything with Ctrl/Meta/Alt held (browser shortcuts keep working)', () => {
    expect(keyToButton(key('KeyQ', 'q'))).toBeNull();
    expect(keyToButton(key('Space', ' '))).toBeNull();
    expect(keyToButton(key('KeyW', 'w', { ctrlKey: true }))).toBeNull();
    expect(keyToButton(key('KeyZ', 'z', { metaKey: true }))).toBeNull();
    expect(keyToButton(key('Enter', 'Enter', { altKey: true }))).toBeNull();
  });
});

describe('touchControlButton', () => {
  it('maps every touch control to a distinct button, covering all six', () => {
    const mapped = TOUCH_CONTROLS.map((id) => touchControlButton(id));
    expect(new Set(mapped)).toEqual(new Set(BUTTONS));
    expect(touchControlButton('dpad-up')).toBe('up');
    expect(touchControlButton('btn-a')).toBe('a');
    expect(touchControlButton('btn-b')).toBe('b');
  });

  it('returns null for unknown ids', () => {
    expect(touchControlButton('btn-start')).toBeNull();
  });
});

describe('InputHub', () => {
  const record = (hub: InputHub) => {
    const seen: InputAction[] = [];
    hub.subscribe((a) => seen.push(a));
    return seen;
  };

  it('keyboard, touch and pointer all land in one action stream', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.press('a', 'keyboard');
    hub.release('a', 'keyboard');
    hub.press('up', 'touch');
    hub.release('up', 'touch');
    hub.pick('title', 1);
    expect(seen).toEqual([
      { kind: 'press', button: 'a' },
      { kind: 'release', button: 'a' },
      { kind: 'press', button: 'up' },
      { kind: 'release', button: 'up' },
      { kind: 'pick', menuId: 'title', index: 1 },
    ]);
  });

  it('drops key auto-repeat: a second press while held emits nothing', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.press('down', 'keyboard');
    hub.press('down', 'keyboard');
    expect(seen).toHaveLength(1);
    expect(hub.isHeld('down')).toBe(true);
  });

  it('a button held from two sources stays held until both release, and emits one press/release pair', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.press('a', 'keyboard');
    hub.press('a', 'touch');
    hub.release('a', 'keyboard');
    expect(hub.isHeld('a')).toBe(true);
    hub.release('a', 'touch');
    expect(hub.isHeld('a')).toBe(false);
    expect(seen).toEqual([
      { kind: 'press', button: 'a' },
      { kind: 'release', button: 'a' },
    ]);
  });

  it('release without a press is ignored', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.release('b', 'keyboard');
    expect(seen).toHaveLength(0);
  });

  it('releaseAll clears stuck buttons (window blur, page hidden)', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.press('left', 'keyboard');
    hub.press('b', 'touch');
    hub.releaseAll();
    expect(hub.isHeld('left')).toBe(false);
    expect(hub.isHeld('b')).toBe(false);
    expect(seen.slice(2)).toEqual([
      { kind: 'release', button: 'left' },
      { kind: 'release', button: 'b' },
    ]);
  });

  it('tap emits a press then a release (the dev hook uses it)', () => {
    const hub = new InputHub();
    const seen = record(hub);
    hub.tap('a');
    expect(seen).toEqual([
      { kind: 'press', button: 'a' },
      { kind: 'release', button: 'a' },
    ]);
  });

  it('unsubscribe stops delivery', () => {
    const hub = new InputHub();
    const seen: InputAction[] = [];
    const off = hub.subscribe((a) => seen.push(a));
    off();
    hub.tap('a');
    expect(seen).toHaveLength(0);
  });

  it('a listener that unsubscribes during dispatch does not skip the next listener', () => {
    const hub = new InputHub();
    const order: string[] = [];
    const offFirst = hub.subscribe(() => {
      order.push('first');
      offFirst();
    });
    hub.subscribe(() => order.push('second'));
    hub.press('a', 'keyboard');
    expect(order).toEqual(['first', 'second']);
  });

  it('a scene switch mid-dispatch: removed listeners are skipped and new ones wait for the next action', () => {
    const hub = new InputHub();
    const order: string[] = [];
    let offOld: () => void = () => undefined;
    hub.subscribe(() => {
      order.push('switch');
      offOld();
      hub.subscribe(() => order.push('new scene'));
    });
    offOld = hub.subscribe(() => order.push('old scene'));
    hub.press('a', 'keyboard');
    expect(order).toEqual(['switch']);
  });
});
