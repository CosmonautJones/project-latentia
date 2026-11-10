import { describe, expect, it } from 'vitest';
import { armedHere, initialMenu, MENU_IDS, menuStep, menuView, moveHint, TEMPERATURE_TIPS, type BattleMenuState, type MenuData, type MenuEffect } from '../../src/battle/battle-menu.js';
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

const data = (moves: MoveOption[], targets: Record<string, number[]> = {}, log: string[] = []): MenuData => ({
  moves,
  targets: (id) => targets[id] ?? [1],
  targetName: (i) => ['ME', 'FOE', 'PAL', 'FOE2'][i] ?? '?',
  log,
});

const press = (button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b'): InputAction => ({ kind: 'press', button });
const pick = (menuId: string, index: number): InputAction => ({ kind: 'pick', menuId, index });

function run(s: BattleMenuState, d: MenuData, ...actions: InputAction[]) {
  let state = s;
  const effects: MenuEffect[] = [];
  for (const a of actions) {
    const r = menuStep(state, a, d);
    state = r.state;
    if (r.effect) effects.push(r.effect);
  }
  return { state, effects };
}

const D = data([mv('ship-it', 1), mv('token-burst', 1), mv('compact', 0, 12, null)], { compact: [0] }, ['R1 Kip used Token Burst!', 'R1 Sagelet used Happy to Help!', 'R2 Kip used Compact!']);
const ROOT = { prompt: 0, temp: 1, why: 2, log: 3, speed: 4 } as const;

describe('battle menu', () => {
  it('opens on the root: PROMPT, TEMP, WHY?, LOG, SPEED', () => {
    expect(menuView(initialMenu(), D)).toEqual({ id: MENU_IDS.root, items: ['PROMPT', 'TEMP T2', 'WHY?', 'LOG', 'SPEED 1×'], index: 0 });
  });

  it('the root is a two-column grid: left/right change column, up/down change row and wrap', () => {
    const at = (...a: InputAction[]) => run(initialMenu(), D, ...a).state.rootIndex;
    expect(at(press('right'))).toBe(1);
    expect(at(press('down'))).toBe(2);
    expect(at(press('down'), press('down'))).toBe(4);
    expect(at(press('down'), press('down'), press('down'))).toBe(0);
    expect(at(press('up'))).toBe(4);
    expect(at(press('right'), press('up'))).toBe(3);
    // SPEED sits alone on its row: right stays put.
    expect(at(press('up'), press('right'))).toBe(4);
  });

  it('PROMPT → a move with one target submits it with the current temperature (keyboard: one press)', () => {
    const { state, effects } = run(initialMenu(), D, press('a'), press('down'), press('a'));
    expect(effects).toEqual([{ kind: 'submit', choice: { moveId: 'token-burst', target: 1, temperature: 2 } }]);
    expect(state.screen).toBe('root');
  });

  it('a tap first selects a move (showing its hint), and a second tap on it commits', () => {
    let r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.prompt), pick(MENU_IDS.moves, 2));
    expect(r.effects).toEqual([]);
    expect(r.state.moveIndex).toBe(2);
    expect(armedHere(r.state)).toBe(true);
    // A tap on another move moves the selection instead of committing.
    r = run(r.state, D, pick(MENU_IDS.moves, 0));
    expect(r.effects).toEqual([]);
    expect(r.state.moveIndex).toBe(0);
    r = run(r.state, D, pick(MENU_IDS.moves, 0));
    expect(r.effects).toEqual([{ kind: 'submit', choice: { moveId: 'ship-it', target: 1, temperature: 2 } }]);
    // A self move aims at the user.
    r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.prompt), pick(MENU_IDS.moves, 2), pick(MENU_IDS.moves, 2));
    expect(r.effects).toEqual([{ kind: 'submit', choice: { moveId: 'compact', target: 0, temperature: 2 } }]);
  });

  it('a key press disarms a selected tap, so the next tap selects again', () => {
    const r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.prompt), pick(MENU_IDS.moves, 1), press('down'), press('up'), pick(MENU_IDS.moves, 1));
    expect(r.effects).toEqual([]);
    expect(armedHere(r.state)).toBe(true);
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
    // By taps: select, then commit.
    r = run(initialMenu(), d, press('a'), press('a'), pick(MENU_IDS.targets, 1));
    expect(r.effects).toEqual([]);
    expect(run(r.state, d, pick(MENU_IDS.targets, 1)).effects).toEqual([{ kind: 'submit', choice: { moveId: 'ship-it', target: 3, temperature: 2 } }]);
  });

  it('B backs out of every submenu to the root, and does nothing on the root', () => {
    expect(run(initialMenu(), D, press('a'), press('b')).state.screen).toBe('root');
    expect(run(initialMenu(), D, press('right'), press('a'), press('b')).state.screen).toBe('root');
    expect(run(initialMenu(), D, pick(MENU_IDS.root, ROOT.log), press('b')).state.screen).toBe('root');
    const r = run(initialMenu(), D, press('b'));
    expect(r.state).toEqual(initialMenu());
    expect(r.effects).toEqual([]);
  });

  it('TEMP: left/right turn the dial T0–T4 (clamped), A sets it, B cancels; taps select then set', () => {
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
    r = run(initialMenu(), D, ...toTemp, pick(MENU_IDS.temp, 3));
    expect(r.state).toMatchObject({ screen: 'temp', tempIndex: 3, temperature: 2 });
    expect(run(r.state, D, pick(MENU_IDS.temp, 3)).state.temperature).toBe(3);
  });

  it('the chosen temperature goes into the command', () => {
    const r = run(initialMenu(), D, press('right'), press('a'), press('left'), press('a'), press('left'), press('a'), press('a'));
    expect(r.effects.at(-1)).toEqual({ kind: 'submit', choice: { moveId: 'ship-it', target: 1, temperature: 1 } });
  });

  it('WHY? asks for the trace popup; SPEED toggles 1× and 2× in place', () => {
    expect(run(initialMenu(), D, pick(MENU_IDS.root, ROOT.why)).effects).toEqual([{ kind: 'why' }]);
    const r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.speed));
    expect(r.effects).toEqual([{ kind: 'speed', speed: 2 }]);
    expect(menuView(r.state, D).items[ROOT.speed]).toBe('SPEED 2×');
    expect(run(r.state, D, pick(MENU_IDS.root, ROOT.speed)).state.speed).toBe(1);
  });

  it('LOG shows the round log from the newest line; up/down scroll, A or B close it', () => {
    let r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.log));
    expect(menuView(r.state, D)).toEqual({ id: MENU_IDS.log, items: D.log, index: 2 });
    r = run(r.state, D, press('up'), press('up'), press('up'));
    expect(r.state.logIndex).toBe(0);
    r = run(r.state, D, press('down'));
    expect(r.state.logIndex).toBe(1);
    expect(run(r.state, D, press('a')).state.screen).toBe('root');
    // An empty log still opens and closes.
    const empty = data([mv('x', 1)]);
    expect(menuView(run(initialMenu(), empty, pick(MENU_IDS.root, ROOT.log)).state, empty)).toEqual({ id: MENU_IDS.log, items: ['(nothing yet)'], index: 0 });
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

  it('temperature tips name each notch as "Tn · x.x"', () => {
    expect(TEMPERATURE_TIPS[2].startsWith('T2 · 1.0')).toBe(true);
    expect(TEMPERATURE_TIPS[4].startsWith('T4 · 2.0')).toBe(true);
  });
});
