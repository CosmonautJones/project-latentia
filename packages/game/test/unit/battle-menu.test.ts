import { describe, expect, it } from 'vitest';
import { initialMenu, MENU_IDS, menuStep, menuView, moveHint, type BattleMenuState, type MenuData } from '../../src/battle/battle-menu.js';
import type { MoveOption } from '../../src/battle/session.js';
import type { InputAction } from '../../src/input/hub.js';

const mv = (moveId: string, cost: number, free = 12, power: number | null = 50): MoveOption => ({
  moveId,
  name: moveId.toUpperCase(),
  type: 'speed',
  power,
  accuracy: 100,
  cost,
  free,
  affordable: cost <= free,
});

const data = (moves: MoveOption[], targets: Record<string, number[]> = {}): MenuData => ({
  moves,
  targets: (id) => targets[id] ?? [1],
  targetName: (i) => ['ME', 'FOE', 'PAL', 'FOE2'][i] ?? '?',
});

const press = (button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b'): InputAction => ({ kind: 'press', button });
const pick = (menuId: string, index: number): InputAction => ({ kind: 'pick', menuId, index });

function run(s: BattleMenuState, d: MenuData, ...actions: InputAction[]) {
  let state = s;
  const effects = [];
  for (const a of actions) {
    const r = menuStep(state, a, d);
    state = r.state;
    if (r.effect) effects.push(r.effect);
  }
  return { state, effects };
}

const D = data([mv('ship-it', 1), mv('token-burst', 1), mv('compact', 0, 12, null)], { compact: [0] });

describe('battle menu', () => {
  it('opens on the 2×2 root: PROMPT, TEMP, WHY?, SPEED', () => {
    const s = initialMenu();
    expect(menuView(s, D)).toEqual({ id: MENU_IDS.root, items: ['PROMPT', 'TEMP T2', 'WHY?', 'SPEED 1×'], index: 0 });
  });

  it('the root is a grid: left/right change column, up/down change row', () => {
    const { state } = run(initialMenu(), D, press('right'));
    expect(state.rootIndex).toBe(1);
    expect(run(state, D, press('down')).state.rootIndex).toBe(3);
    expect(run(state, D, press('down'), press('left')).state.rootIndex).toBe(2);
    expect(run(state, D, press('down'), press('left'), press('up')).state.rootIndex).toBe(0);
  });

  it('PROMPT → a move with one target submits it with the current temperature', () => {
    const { state, effects } = run(initialMenu(), D, press('a'), press('down'), press('a'));
    expect(effects).toEqual([{ kind: 'submit', choice: { moveId: 'token-burst', target: 1, temperature: 2 } }]);
    // Back on the root for the next round.
    expect(state.screen).toBe('root');
  });

  it('a self move aims at the user', () => {
    const { effects } = run(initialMenu(), D, pick(MENU_IDS.root, 0), pick(MENU_IDS.moves, 2));
    expect(effects).toEqual([{ kind: 'submit', choice: { moveId: 'compact', target: 0, temperature: 2 } }]);
  });

  it('a move with several targets asks which, and B goes back to the moves', () => {
    const d = data([mv('ship-it', 1)], { 'ship-it': [1, 3] });
    let r = run(initialMenu(), d, press('a'), press('a'));
    expect(r.effects).toEqual([]);
    expect(menuView(r.state, d)).toEqual({ id: MENU_IDS.targets, items: ['FOE', 'FOE2'], index: 0 });
    r = run(r.state, d, press('b'));
    expect(r.state.screen).toBe('moves');
    r = run(r.state, d, press('a'), press('down'), press('a'));
    expect(r.effects).toEqual([{ kind: 'submit', choice: { moveId: 'ship-it', target: 3, temperature: 2 } }]);
  });

  it('B backs out of every submenu to the root, and does nothing on the root', () => {
    expect(run(initialMenu(), D, press('a'), press('b')).state.screen).toBe('root');
    expect(run(initialMenu(), D, press('right'), press('a'), press('b')).state.screen).toBe('root');
    const r = run(initialMenu(), D, press('b'));
    expect(r.state).toEqual(initialMenu());
    expect(r.effects).toEqual([]);
  });

  it('TEMP: left/right turn the dial T0–T4 (clamped), A sets it, B cancels', () => {
    const toTemp = [press('right'), press('a')];
    let r = run(initialMenu(), D, ...toTemp, press('right'), press('right'), press('right'));
    expect(menuView(r.state, D)).toEqual({ id: MENU_IDS.temp, items: ['T0', 'T1', 'T2', 'T3', 'T4'], index: 4 });
    r = run(r.state, D, press('a'));
    expect(r.state).toMatchObject({ screen: 'root', temperature: 4 });
    expect(r.effects).toEqual([{ kind: 'temperature', temperature: 4 }]);
    r = run(r.state, D, ...toTemp, press('left'), press('left'), press('b'));
    expect(r.state).toMatchObject({ screen: 'root', temperature: 4, tempIndex: 4 });
    r = run(initialMenu(), D, ...toTemp, press('left'), press('left'), press('left'), press('a'));
    expect(r.state.temperature).toBe(0);
    // A tap on a notch sets it directly.
    expect(run(initialMenu(), D, ...toTemp, pick(MENU_IDS.temp, 3)).state.temperature).toBe(3);
  });

  it('the chosen temperature goes into the command', () => {
    const r = run(initialMenu(), D, press('right'), press('a'), press('left'), press('a'), press('left'), press('a'), press('a'));
    expect(r.effects.at(-1)).toEqual({ kind: 'submit', choice: { moveId: 'ship-it', target: 1, temperature: 1 } });
  });

  it('WHY? asks for the trace popup; SPEED toggles 1× and 2× in place', () => {
    expect(run(initialMenu(), D, pick(MENU_IDS.root, 2)).effects).toEqual([{ kind: 'why' }]);
    const r = run(initialMenu(), D, pick(MENU_IDS.root, 3));
    expect(r.effects).toEqual([{ kind: 'speed', speed: 2 }]);
    expect(menuView(r.state, D).items[3]).toBe('SPEED 2×');
    expect(run(r.state, D, pick(MENU_IDS.root, 3)).state.speed).toBe(1);
  });

  it('ignores taps on a menu that is not showing', () => {
    const r = run(initialMenu(), D, pick(MENU_IDS.moves, 0), pick(MENU_IDS.temp, 4));
    expect(r.state).toEqual(initialMenu());
    expect(r.effects).toEqual([]);
  });

  it('an unaffordable move stays selectable (the engine turns overflow into Drift)', () => {
    const d = data([mv('happy', 3, 2)]);
    expect(run(initialMenu(), d, press('a'), press('a')).effects).toEqual([{ kind: 'submit', choice: { moveId: 'happy', target: 1, temperature: 2 } }]);
  });

  it('move hints show the cost against free context, and the overflow → Drift warning', () => {
    expect(moveHint(mv('a', 3, 12))).toBe('PWR 50  ACC 100  COST 3 / 12 FREE');
    expect(moveHint(mv('a', 3, 2))).toBe('COST 3, ONLY 2 FREE: OVERFLOW → DRIFT');
    expect(moveHint(mv('c', 0, 12, null))).toBe('COST 0 / 12 FREE');
  });
});
