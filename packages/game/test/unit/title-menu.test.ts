import { describe, expect, it } from 'vitest';
import { FlowController } from '../../src/flow/controller.js';
import { CONFIRM_DEFAULT, CONFIRM_ITEMS, CONFIRM_MENU_ID, confirmPick, TITLE_MENU_ID, titleItems, titlePick } from '../../src/flow/title-menu.js';
import { loadSave, SAVE_KEY, type KeyValueStorage } from '../../src/save/save.js';
import { createMenu, menuInput, type MenuState } from '../../src/ui/menu.js';
import type { InputAction } from '../../src/input/hub.js';

class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  writes = 0;
  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.writes++;
    this.data.set(k, v);
  }
  removeItem(k: string): void {
    this.writes++;
    this.data.delete(k);
  }
}

/** A flow with a run saved at the walk (Forkling beat the rival), back at the title. */
const withSave = () => {
  const storage = new MemoryStorage();
  const flow = new FlowController(storage, () => {});
  flow.start();
  flow.send({ type: 'newGame' });
  flow.send({ type: 'starterPicked', starter: 'forkling' });
  flow.send({ type: 'battleWon' });
  flow.send({ type: 'backToTitle' });
  const before = storage.data.get(SAVE_KEY);
  storage.writes = 0;
  return { storage, flow, before };
};

/**
 * The title scene's wiring, minus Phaser: the title menu, and the confirm panel once NEW GAME asks. Returns what the
 * action stream did, so a test can feed it taps and presses the same way the scene does.
 */
const titleDriver = (flow: FlowController, hasSave: boolean) => {
  const items = titleItems(hasSave);
  let title: MenuState = createMenu(TITLE_MENU_ID, items);
  let confirm: MenuState | null = null;
  return {
    get confirm() {
      return confirm;
    },
    act(a: InputAction): void {
      if (confirm) {
        const r = menuInput(confirm, a);
        confirm = r.menu;
        if (r.confirm !== undefined) {
          if (confirmPick(r.confirm) === 'startOver') flow.send({ type: 'newGame' });
          else confirm = null;
        } else if (r.cancel) confirm = null;
        return;
      }
      const r = menuInput(title, a);
      title = r.menu;
      if (r.confirm === undefined) return;
      const p = titlePick(items[r.confirm], hasSave);
      if (p === 'newGame') flow.send({ type: 'newGame' });
      else if (p === 'confirmNewGame') confirm = createMenu(CONFIRM_MENU_ID, CONFIRM_ITEMS, CONFIRM_DEFAULT);
    },
  };
};

const press = (button: 'a' | 'b' | 'down' | 'up'): InputAction => ({ kind: 'press', button });
const pick = (menuId: string, index: number): InputAction => ({ kind: 'pick', menuId, index });

describe('title menu', () => {
  it('offers CONTINUE only with a save; NEW GAME with no save starts at once', () => {
    expect(titleItems(false)).toEqual(['NEW GAME']);
    expect(titleItems(true)).toEqual(['CONTINUE', 'NEW GAME']);
    expect(titlePick('NEW GAME', false)).toBe('newGame');
    expect(titlePick('CONTINUE', true)).toBe('continue');
    expect(titlePick('NEW GAME', true)).toBe('confirmNewGame');
  });

  it('the confirm panel opens on CANCEL, and only START OVER starts over', () => {
    expect(CONFIRM_ITEMS[CONFIRM_DEFAULT]).toBe('CANCEL');
    expect(confirmPick(CONFIRM_DEFAULT)).toBe('back');
    expect(confirmPick(CONFIRM_ITEMS.indexOf('START OVER'))).toBe('startOver');
    expect(confirmPick(99)).toBe('back');
  });

  it('one tap on NEW GAME with a save present never writes the save', () => {
    const { storage, flow, before } = withSave();
    const t = titleDriver(flow, true);
    t.act(pick(TITLE_MENU_ID, 1));
    expect(t.confirm).toMatchObject({ id: CONFIRM_MENU_ID, index: CONFIRM_DEFAULT });
    expect(storage.writes).toBe(0);
    expect(storage.data.get(SAVE_KEY)).toBe(before);
    expect(flow.state.step).toBe('title');
  });

  it('a second tap in the same place, a second A, or B goes back with the save untouched', () => {
    const { storage, flow, before } = withSave();
    const t = titleDriver(flow, true);
    // Tap NEW GAME (row 1) twice: the second tap lands on row 1 of the panel, CANCEL.
    t.act(pick(TITLE_MENU_ID, 1));
    t.act(pick(CONFIRM_MENU_ID, 1));
    expect(t.confirm).toBeNull();
    // Keyboard: down to NEW GAME, A, A (the panel opens on CANCEL).
    t.act(press('down'));
    t.act(press('a'));
    t.act(press('a'));
    expect(t.confirm).toBeNull();
    // NEW GAME, then B.
    t.act(press('a'));
    t.act(press('b'));
    expect(t.confirm).toBeNull();
    expect(storage.writes).toBe(0);
    expect(storage.data.get(SAVE_KEY)).toBe(before);
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'walk', starter: 'forkling' } } });
  });

  it('confirming START OVER resets the save to a fresh lab', () => {
    const { storage, flow } = withSave();
    const t = titleDriver(flow, true);
    t.act(pick(TITLE_MENU_ID, 1));
    t.act(press('up'));
    expect(t.confirm?.index).toBe(0);
    t.act(press('a'));
    expect(flow.state.step).toBe('lab');
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'lab', starter: null }, hintsSeen: [] } });
  });

  it('with no save, one press of NEW GAME starts the game', () => {
    const storage = new MemoryStorage();
    const flow = new FlowController(storage, () => {});
    flow.start();
    titleDriver(flow, false).act(press('a'));
    expect(flow.state.step).toBe('lab');
    expect(loadSave(storage)).toMatchObject({ status: 'ok', save: { progress: { step: 'lab' } } });
  });
});
