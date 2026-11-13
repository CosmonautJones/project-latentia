import { describe, expect, it } from 'vitest';
import { armedHere, initialMenu, MENU_IDS, menuStep, menuView, moveHint, normalizeMenu, rootLabels, TEMPERATURE_TIPS, type BattleMenuState, type MenuData, type MenuEffect } from '../../src/battle/battle-menu.js';
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
const ROOT = { prompt: 0, why: 1, log: 2, numbers: 3, speed: 4 } as const;
/** The same data once the save has unlocked temperature (V12): TEMP comes back after PROMPT. */
const DT: MenuData = { ...D, tempUnlocked: true };

describe('battle menu', () => {
  it('opens on the root: PROMPT, WHY?, LOG, NUMBERS, SPEED; no TEMP while temperature is locked (V12)', () => {
    expect(menuView(initialMenu(), D)).toEqual({ id: MENU_IDS.root, items: ['PROMPT', 'WHY?', 'LOG', 'NUMBERS OFF', 'SPEED 1×'], index: 0 });
    expect(menuView(initialMenu(), DT).items).toEqual(['PROMPT', 'TEMP T2', 'WHY?', 'LOG', 'NUMBERS OFF', 'SPEED 1×']);
  });

  it('the root is a three-column grid: left/right move along the row, up/down along the column, both wrap', () => {
    const at = (...a: InputAction[]) => run(initialMenu(), D, ...a).state.rootIndex;
    expect(at(press('right'))).toBe(1);
    expect(at(press('left'))).toBe(2);
    expect(at(press('down'))).toBe(3);
    expect(at(press('down'), press('down'))).toBe(0);
    expect(at(press('up'))).toBe(3);
    expect(at(press('right'), press('down'))).toBe(4);
    // The second row has two items: right from SPEED wraps to NUMBERS; LOG's column has only LOG.
    expect(at(press('down'), press('right'), press('right'))).toBe(3);
    expect(at(press('left'), press('down'))).toBe(2);
  });

  it('NUMBERS toggles the move details between plain words and numbers', () => {
    const r = run(initialMenu(), D, pick(MENU_IDS.root, ROOT.numbers));
    expect(r.effects).toEqual([{ kind: 'numbers', numbers: true }]);
    expect(menuView(r.state, D).items[ROOT.numbers]).toBe('NUMBERS ON');
    expect(run(r.state, D, pick(MENU_IDS.root, ROOT.numbers)).state.numbers).toBe(false);
  });

  it('a locked dial cannot be opened, even by a stray TEMP state', () => {
    const s = { ...initialMenu(), screen: 'temp' as const };
    expect(run(s, D, press('right')).state).toMatchObject({ screen: 'root', temperature: 2 });
  });

  it('PROMPT → a move with one target submits it with the current temperature (keyboard: one press)', () => {
    const { state, effects } = run(initialMenu(), D, press('a'), press('right'), press('a'));
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
    r = run(r.state, d, press('a'), press('right'), press('a'));
    expect(r.effects).toEqual([{ kind: 'submit', choice: { moveId: 'ship-it', target: 3, temperature: 2 } }]);
    // By taps: select, then commit.
    r = run(initialMenu(), d, press('a'), press('a'), pick(MENU_IDS.targets, 1));
    expect(r.effects).toEqual([]);
    expect(run(r.state, d, pick(MENU_IDS.targets, 1)).effects).toEqual([{ kind: 'submit', choice: { moveId: 'ship-it', target: 3, temperature: 2 } }]);
  });

  it('B backs out of every submenu to the root, and does nothing on the root', () => {
    expect(run(initialMenu(), D, press('a'), press('b')).state.screen).toBe('root');
    expect(run(initialMenu(), DT, press('right'), press('a'), press('b')).state.screen).toBe('root');
    expect(run(initialMenu(), D, pick(MENU_IDS.root, ROOT.log), press('b')).state.screen).toBe('root');
    const r = run(initialMenu(), D, press('b'));
    expect(r.state).toEqual(initialMenu());
    expect(r.effects).toEqual([]);
  });

  it('TEMP: left/right turn the dial T0–T4 (clamped), A sets it, B cancels; taps select then set', () => {
    const toTemp = [press('right'), press('a')];
    let r = run(initialMenu(), DT, ...toTemp, press('right'), press('right'), press('right'));
    expect(menuView(r.state, DT)).toEqual({ id: MENU_IDS.temp, items: ['T0', 'T1', 'T2', 'T3', 'T4'], index: 4 });
    r = run(r.state, DT, press('a'));
    expect(r.state).toMatchObject({ screen: 'root', temperature: 4 });
    expect(r.effects).toEqual([{ kind: 'temperature', temperature: 4 }]);
    r = run(r.state, DT, ...toTemp, press('left'), press('left'), press('b'));
    expect(r.state).toMatchObject({ screen: 'root', temperature: 4, tempIndex: 4 });
    r = run(initialMenu(), DT, ...toTemp, press('left'), press('left'), press('left'), press('a'));
    expect(r.state.temperature).toBe(0);
    r = run(initialMenu(), DT, ...toTemp, pick(MENU_IDS.temp, 3));
    expect(r.state).toMatchObject({ screen: 'temp', tempIndex: 3, temperature: 2 });
    expect(run(r.state, DT, pick(MENU_IDS.temp, 3)).state.temperature).toBe(3);
  });

  it('the chosen temperature goes into the command', () => {
    const r = run(initialMenu(), DT, press('right'), press('a'), press('left'), press('a'), press('left'), press('a'), press('a'));
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

// I-3: the arrows move through the move and target grids the way they are drawn (wrapping), page by page.
describe('battle menu arrows on the drawn grids', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => mv(id, 1));
  const onMoves = (moveIndex = 0): BattleMenuState => ({ ...initialMenu(), screen: 'moves', moveIndex });
  const at = (d: MenuData, from: number, ...buttons: ('up' | 'down' | 'left' | 'right')[]) => run(onMoves(from), d, ...buttons.map(press)).state;

  it('7 moves in 2 columns (rows a b / c d / e f / g): left/right along the row, up/down along the column, both wrap', () => {
    const d: MenuData = { ...data(seven), columns: 2 };
    expect(at(d, 0, 'right').moveIndex).toBe(1);
    expect(at(d, 1, 'right').moveIndex).toBe(0);
    expect(at(d, 0, 'left').moveIndex).toBe(1);
    expect(at(d, 0, 'down').moveIndex).toBe(2);
    expect(at(d, 0, 'down', 'down', 'down').moveIndex).toBe(6);
    expect(at(d, 6, 'down').moveIndex).toBe(0);
    expect(at(d, 0, 'up').moveIndex).toBe(6);
    // The second column is a, c, e short: d's column wraps b → d → f → b.
    expect(at(d, 5, 'down').moveIndex).toBe(1);
    expect(at(d, 1, 'up').moveIndex).toBe(5);
    // The last row has one item: left/right stay on it.
    expect(at(d, 6, 'right').moveIndex).toBe(6);
    expect(at(d, 6, 'left').moveIndex).toBe(6);
  });

  it('7 moves in 3 columns (a b c / d e f / g)', () => {
    const d: MenuData = { ...data(seven), columns: 3 };
    expect(at(d, 0, 'right', 'right').moveIndex).toBe(2);
    expect(at(d, 2, 'right').moveIndex).toBe(0);
    expect(at(d, 1, 'down').moveIndex).toBe(4);
    expect(at(d, 4, 'down').moveIndex).toBe(1);
    expect(at(d, 0, 'down', 'down').moveIndex).toBe(6);
    expect(at(d, 6, 'down').moveIndex).toBe(0);
    expect(at(d, 2, 'up').moveIndex).toBe(5);
  });

  it('a paged list (3 columns, 5 a page + MORE): down past the last row turns the page, up past the first turns back', () => {
    const d: MenuData = { ...data(seven), columns: 3, pageSize: 5 };
    // Page 1: a b c / d e (MORE); page 2: f g.
    expect(at(d, 1, 'down').moveIndex).toBe(4);
    expect(at(d, 4, 'down').moveIndex).toBe(6);
    expect(at(d, 3, 'down').moveIndex).toBe(5);
    expect(at(d, 2, 'down').moveIndex).toBe(6);
    expect(at(d, 5, 'down').moveIndex).toBe(0);
    expect(at(d, 5, 'up').moveIndex).toBe(3);
    expect(at(d, 0, 'up').moveIndex).toBe(5);
    expect(at(d, 3, 'right', 'right').moveIndex).toBe(3);
  });

  it('targets are two to a row: left/right swap columns, up/down move along the column', () => {
    const d = data([mv('fork', 1)], { fork: [1, 3, 2] });
    const t = (...b: ('up' | 'down' | 'left' | 'right')[]) => run(initialMenu(), d, pick(MENU_IDS.root, 0), press('a'), ...b.map(press)).state;
    expect(t().screen).toBe('targets');
    expect(t('right').targetIndex).toBe(1);
    expect(t('left').targetIndex).toBe(1);
    expect(t('down').targetIndex).toBe(2);
    expect(t('down', 'down').targetIndex).toBe(0);
    expect(t('right', 'down').targetIndex).toBe(1);
  });
});

// I-4: tall portrait shows the moves directly, the root's other items in one row under them.
describe('battle menu in direct mode', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => mv(id, 1));
  const d: MenuData = { ...data(seven), columns: 2, direct: true };
  const start: BattleMenuState = { ...initialMenu(), screen: 'moves' };

  it('the system row is reached from the bottom of a column and leads back up; it never lands on PROMPT', () => {
    expect(run(start, d, press('down'), press('down'), press('down'), press('down')).state).toMatchObject({ screen: 'root', rootIndex: ROOT.why });
    expect(run(start, d, press('right'), press('down'), press('down'), press('down')).state).toMatchObject({ screen: 'root', rootIndex: ROOT.numbers });
    expect(run(start, d, press('up')).state).toMatchObject({ screen: 'root', rootIndex: ROOT.why });
    const sys: BattleMenuState = { ...start, screen: 'root', rootIndex: ROOT.why };
    expect(run(sys, d, press('left')).state.rootIndex).toBe(ROOT.speed);
    expect(run(sys, d, press('right'), press('right'), press('right'), press('right')).state.rootIndex).toBe(ROOT.why);
    expect(run(sys, d, press('up')).state).toMatchObject({ screen: 'moves', moveIndex: 6 });
    expect(run(sys, d, press('down')).state).toMatchObject({ screen: 'moves', moveIndex: 0 });
    expect(run({ ...sys, rootIndex: ROOT.speed }, d, press('up')).state).toMatchObject({ screen: 'moves', moveIndex: 5 });
  });

  it('taps on the moves and on the system row both work from either screen; B on the moves stays', () => {
    const sys: BattleMenuState = { ...start, screen: 'root', rootIndex: ROOT.log };
    expect(run(sys, d, pick(MENU_IDS.moves, 6)).state).toMatchObject({ screen: 'moves', moveIndex: 6, armed: { screen: 'moves', index: 6 } });
    const r = run(start, d, pick(MENU_IDS.root, ROOT.speed));
    expect(r.state).toMatchObject({ screen: 'root', speed: 2 });
    expect(r.effects).toEqual([{ kind: 'speed', speed: 2 }]);
    expect(run(start, d, pick(MENU_IDS.moves, 2), pick(MENU_IDS.moves, 2)).effects).toEqual([{ kind: 'submit', choice: { moveId: 'c', target: 1, temperature: 2 } }]);
    expect(run(start, d, press('b')).state.screen).toBe('moves');
    // LOG closes back to the cursor on LOG in the row.
    expect(run(start, d, pick(MENU_IDS.root, ROOT.log), press('b')).state).toMatchObject({ screen: 'root', rootIndex: ROOT.log });
  });

  it('normalizeMenu moves a cursor on PROMPT (e.g. after a rotation from landscape) onto the moves', () => {
    expect(normalizeMenu(initialMenu(), d).screen).toBe('moves');
    expect(normalizeMenu({ ...initialMenu(), rootIndex: ROOT.log }, d).screen).toBe('root');
    expect(normalizeMenu(initialMenu(), { ...d, direct: false }).screen).toBe('root');
  });

  it('the compact row uses short labels', () => {
    expect(rootLabels(initialMenu(), d, true)).toEqual(['PROMPT', 'WHY?', 'LOG', 'NUM OFF', 'SPEED 1×']);
  });
});
