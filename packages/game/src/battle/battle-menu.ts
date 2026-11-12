// The pure battle command menu: the root (PROMPT, WHY?, LOG, NUMBERS, SPEED, three to a row; TEMP after PROMPT once the
// save unlocks temperature, ruling V12), the move list, a target list when a move has a choice of targets, the
// temperature dial and the round log. NUMBERS toggles the move details between plain words and the numbers (V14). B backs out of every submenu. Taps on a
// menu that is not showing are ignored. On touch and pointer a commit takes two taps (ruling V5.2): the first tap on a
// move, notch or target selects it and shows its hint (and any overflow → Drift warning), a second tap on the same
// item commits. The in-image command box renders this one state.
// - The arrows move through every grid the way it is drawn (the root three to a row, the moves `columns` to a row, the
//   targets two to a row): left/right along the row and up/down along the column, wrapping at the ends. On a paged
//   move list, down past the last row turns to the next page and up past the first to the previous one (pages wrap
//   too); the MORE slot is for taps.
// - Direct mode (tall portrait, `direct`): there is no PROMPT step. The moves are the first screen, and the root's
//   other items (WHY? LOG NUMBERS SPEED) are one row drawn under them. The 'root' screen then means the cursor is on
//   that row; down past the last move row reaches it, and down from it wraps to the first move row. Taps on either
//   part work from either screen. The root's indices are unchanged (PROMPT is index 0, never drawn).

import type { Temperature } from '@latentia/engine';
import type { InputAction } from '../input/hub.js';
import type { MenuState } from '../ui/menu.js';
import type { MoveOption, PlayerChoice } from './session.js';
import type { Speed } from './timeline.js';

export type MenuScreen = 'root' | 'moves' | 'targets' | 'temp' | 'log';

export const MENU_IDS: Readonly<Record<MenuScreen, string>> = {
  root: 'battle-root',
  moves: 'battle-moves',
  targets: 'battle-targets',
  temp: 'battle-temp',
  log: 'battle-log',
};

/** The MORE button of a paged move list (a tap shows the next page). */
export const PAGE_MENU_ID = 'battle-page';

export type RootItem = 'prompt' | 'temp' | 'why' | 'log' | 'numbers' | 'speed';
/** The root is laid out three to a row (command-box.ts); the arrows move on that grid. */
export const ROOT_COLUMNS = 3;
/** The target list is laid out two to a row. */
export const TARGET_COLUMNS = 2;

/** The root's items in order: TEMP only once temperature is unlocked. */
export const rootItems = (d: Pick<MenuData, 'tempUnlocked'>): RootItem[] => (d.tempUnlocked === true ? ['prompt', 'temp', 'why', 'log', 'numbers', 'speed'] : ['prompt', 'why', 'log', 'numbers', 'speed']);

const TEMPS: readonly Temperature[] = [0, 1, 2, 3, 4];

export interface BattleMenuState {
  readonly screen: MenuScreen;
  /** The cursor's place in rootItems, laid out three to a row. */
  readonly rootIndex: number;
  readonly moveIndex: number;
  readonly targetIndex: number;
  /** The dial's cursor while TEMP is open. */
  readonly tempIndex: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
  /** NUMBERS: the move details show the numbers (power, accuracy, the damage range) instead of plain words. */
  readonly numbers: boolean;
  /** The move waiting for a target. */
  readonly pendingMove: string | null;
  /** The log line the cursor is on. */
  readonly logIndex: number;
  /** The item a first tap selected; a second tap on it commits. Cleared by any key press or screen change. */
  readonly armed: { readonly screen: MenuScreen; readonly index: number } | null;
}

export interface MenuData {
  readonly moves: readonly MoveOption[];
  targets(moveId: string): readonly number[];
  targetName(index: number): string;
  /** The round log, oldest line first. */
  readonly log: readonly string[];
  /** The save has unlocked the temperature dial (V12); absent means locked. */
  readonly tempUnlocked?: boolean;
  /** Moves shown per page when the list does not fit the band (its last slot is MORE); absent means all at once. */
  readonly pageSize?: number;
  /** How many columns the move list is drawn in (default 2). */
  readonly columns?: number;
  /** Tall portrait: the moves are shown directly with the root's other items in a row under them (no PROMPT). */
  readonly direct?: boolean;
}

/** The page of the move list the cursor is on: its first index and size (the whole list when it fits). */
export function movePage(index: number, d: Pick<MenuData, 'moves' | 'pageSize'>): { first: number; size: number; pages: number } {
  const n = d.moves.length;
  const size = d.pageSize === undefined || d.pageSize >= n ? n : Math.max(1, d.pageSize);
  return { first: Math.floor(index / size) * size, size, pages: Math.max(1, Math.ceil(n / size)) };
}

export type MenuEffect =
  | { readonly kind: 'submit'; readonly choice: PlayerChoice }
  | { readonly kind: 'why' }
  | { readonly kind: 'speed'; readonly speed: Speed }
  | { readonly kind: 'numbers'; readonly numbers: boolean }
  | { readonly kind: 'temperature'; readonly temperature: Temperature };

export interface MenuResult {
  readonly state: BattleMenuState;
  readonly effect?: MenuEffect;
}

export function initialMenu(temperature: Temperature = 2, speed: Speed = 1, numbers = false): BattleMenuState {
  return { screen: 'root', rootIndex: 0, moveIndex: 0, targetIndex: 0, tempIndex: temperature, temperature, speed, numbers, pendingMove: null, logIndex: 0, armed: null };
}

/** Whether the highlighted item was selected by a tap, so the next tap on it commits. */
export function armedHere(s: BattleMenuState): boolean {
  const index = s.screen === 'moves' ? s.moveIndex : s.screen === 'targets' ? s.targetIndex : s.screen === 'temp' ? s.tempIndex : -1;
  return s.armed !== null && s.armed.screen === s.screen && s.armed.index === index;
}

/** First tap: select and arm; second tap on the armed item: commit. */
function tap(s: BattleMenuState, index: number, select: (s: BattleMenuState) => BattleMenuState, commit: (s: BattleMenuState) => MenuResult): MenuResult {
  if (s.armed !== null && s.armed.screen === s.screen && s.armed.index === index) return commit({ ...s, armed: null });
  return { state: { ...select(s), armed: { screen: s.screen, index } } };
}

type Arrow = 'up' | 'down' | 'left' | 'right';

/**
 * The arrows on a grid of `count` items drawn `columns` to a row: left/right along the row (wrapping in it), up/down
 * along the column (wrapping in it; a short last row keeps its columns).
 */
export function gridMove(index: number, button: Arrow, count: number, columns: number): number {
  if (count <= 0) return 0;
  const C = Math.max(1, columns);
  const rowStart = index - (index % C);
  const rowLen = Math.min(C, count - rowStart);
  if (button === 'left' || button === 'right') return rowStart + ((index - rowStart + (button === 'right' ? 1 : rowLen - 1)) % rowLen);
  const inCol = columnOf(index, count, C);
  const at = inCol.indexOf(index);
  return inCol[(at + (button === 'down' ? 1 : inCol.length - 1)) % inCol.length] ?? index;
}

/** The indices in `index`'s column, top to bottom. */
const columnOf = (index: number, count: number, C: number): number[] => Array.from({ length: Math.ceil(count / C) }, (_, r) => r * C + (index % C)).filter((i) => i < count);

/** The root items drawn in direct mode's system row (all but PROMPT), as root indices. */
const systemIndices = (d: MenuData): number[] => rootItems(d).flatMap((r, i) => (r === 'prompt' ? [] : [i]));

/** The arrows on the move list, page by page (direct mode: past the top or bottom row onto the system row). */
function moveArrow(s: BattleMenuState, button: Arrow, d: MenuData): BattleMenuState {
  const C = d.columns ?? 2;
  const p = movePage(s.moveIndex, d);
  const n = Math.min(p.size, d.moves.length - p.first);
  const local = s.moveIndex - p.first;
  if (button === 'left' || button === 'right') return { ...s, moveIndex: p.first + gridMove(local, button, n, C) };
  const col = columnOf(local, n, C);
  const edge = button === 'down' ? col[col.length - 1] === local : col[0] === local;
  if (edge && d.direct === true) {
    const sys = systemIndices(d);
    const at = Math.min(sys.length - 1, Math.floor(((local % C) * sys.length) / C));
    return { ...s, screen: 'root', rootIndex: sys[at] ?? s.rootIndex };
  }
  if (edge && p.pages > 1) {
    const first = (p.first + (button === 'down' ? p.size : -p.size) + p.pages * p.size) % (p.pages * p.size);
    const count = Math.min(p.size, d.moves.length - first);
    const inCol = columnOf(Math.min(local % C, count - 1), count, C);
    return { ...s, moveIndex: first + ((button === 'down' ? inCol[0] : inCol[inCol.length - 1]) ?? 0) };
  }
  return { ...s, moveIndex: p.first + gridMove(local, button, n, C) };
}

/** Direct mode's system row: left/right along it (wrapping); up to the last move row, down to the first. */
function systemArrow(s: BattleMenuState, button: Arrow, d: MenuData): BattleMenuState {
  const sys = systemIndices(d);
  const at = Math.max(0, sys.indexOf(s.rootIndex));
  if (button === 'left' || button === 'right') return { ...s, rootIndex: sys[(at + (button === 'right' ? 1 : sys.length - 1)) % sys.length] ?? s.rootIndex };
  const C = d.columns ?? 2;
  const p = movePage(s.moveIndex, d);
  const n = Math.min(p.size, d.moves.length - p.first);
  const colIndex = Math.min(C - 1, Math.floor((at * C) / sys.length), Math.max(0, n - 1));
  const inCol = columnOf(colIndex, n, C);
  return { ...s, screen: 'moves', moveIndex: p.first + ((button === 'down' ? inCol[0] : inCol[inCol.length - 1]) ?? 0) };
}

/**
 * The state as it should be shown with `d`: in direct mode a cursor on PROMPT (never drawn there; e.g. after a
 * rotation from landscape) is on the moves instead.
 */
export function normalizeMenu(s: BattleMenuState, d: MenuData): BattleMenuState {
  return d.direct === true && s.screen === 'root' && rootItems(d)[s.rootIndex] === 'prompt' ? { ...s, screen: 'moves' } : s;
}

const clampTemp = (i: number): Temperature => TEMPS[Math.max(0, Math.min(TEMPS.length - 1, i))] ?? 2;

/** The row the cursor is on and the action, for the screen showing; a tap elsewhere is null. */
function decode(s: BattleMenuState, a: InputAction): { button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b' } | { pickAt: number } | { page: true } | null {
  if (a.kind === 'pick' && a.menuId === PAGE_MENU_ID) return s.screen === 'moves' ? { page: true } : null;
  if (a.kind === 'pick') return a.menuId === MENU_IDS[s.screen] ? { pickAt: a.index } : null;
  return a.kind === 'press' ? { button: a.button } : null;
}

function submit(s: BattleMenuState, moveId: string, target: number): MenuResult {
  return { state: { ...s, screen: 'root', rootIndex: 0, pendingMove: null, targetIndex: 0, armed: null }, effect: { kind: 'submit', choice: { moveId, target, temperature: s.temperature } } };
}

function chooseMove(s: BattleMenuState, index: number, d: MenuData): MenuResult {
  const move = d.moves[index];
  if (move === undefined) return { state: s };
  const targets = d.targets(move.moveId);
  const only = targets.length === 1 ? targets[0] : undefined;
  if (only !== undefined) return submit({ ...s, moveIndex: index }, move.moveId, only);
  if (targets.length === 0) return { state: { ...s, moveIndex: index } };
  return { state: { ...s, moveIndex: index, screen: 'targets', pendingMove: move.moveId, targetIndex: 0 } };
}

function chooseRoot(s: BattleMenuState, index: number, d: MenuData): MenuResult {
  const at = { ...s, rootIndex: index, armed: null };
  switch (rootItems(d)[index]) {
    case 'prompt':
      return { state: { ...at, screen: 'moves' } };
    case 'temp':
      return { state: { ...at, screen: 'temp', tempIndex: s.temperature } };
    case 'why':
      return { state: at, effect: { kind: 'why' } };
    case 'log':
      return { state: { ...at, screen: 'log', logIndex: Math.max(0, d.log.length - 1) } };
    case 'numbers':
      return { state: { ...at, numbers: !s.numbers }, effect: { kind: 'numbers', numbers: !s.numbers } };
    case 'speed': {
      const speed: Speed = s.speed === 1 ? 2 : 1;
      return { state: { ...at, speed }, effect: { kind: 'speed', speed } };
    }
    default:
      return { state: s };
  }
}

export function menuStep(s00: BattleMenuState, action: InputAction, d: MenuData): MenuResult {
  // Direct mode draws the moves and the system row together: a tap on either part works from either screen.
  const cross: MenuScreen | null = d.direct === true && action.kind === 'pick' && (s00.screen === 'root' || s00.screen === 'moves') ? (action.menuId === MENU_IDS.root ? 'root' : action.menuId === MENU_IDS.moves ? 'moves' : null) : null;
  const s0: BattleMenuState = cross !== null && cross !== s00.screen ? { ...s00, screen: cross } : s00;
  const input = decode(s0, action);
  if (input === null) return { state: s0 };
  if ('page' in input) {
    const p = movePage(s0.moveIndex, d);
    const next = p.first + p.size >= d.moves.length ? 0 : p.first + p.size;
    return { state: { ...s0, moveIndex: next, armed: null } };
  }
  const button = 'button' in input ? input.button : null;
  const picked = 'pickAt' in input ? input.pickAt : null;
  // Any key press disarms a tap selection.
  const s = button !== null && s0.armed !== null ? { ...s0, armed: null } : s0;
  const arrow = button === 'up' || button === 'down' || button === 'left' || button === 'right' ? button : null;
  switch (s.screen) {
    case 'root': {
      const count = rootItems(d).length;
      if (picked !== null) return picked >= 0 && picked < count ? chooseRoot(s, picked, d) : { state: s };
      if (button === 'a') return chooseRoot(s, s.rootIndex, d);
      if (arrow !== null) return { state: d.direct === true ? systemArrow(s, arrow, d) : { ...s, rootIndex: gridMove(s.rootIndex, arrow, count, ROOT_COLUMNS) } };
      return { state: s };
    }
    case 'moves': {
      if (picked !== null) return picked >= 0 && picked < d.moves.length ? tap(s, picked, (x) => ({ ...x, moveIndex: picked }), (x) => chooseMove(x, picked, d)) : { state: s };
      if (button === 'a') return chooseMove(s, s.moveIndex, d);
      // Direct mode has no root to go back to: B stays.
      if (button === 'b') return { state: d.direct === true ? s : { ...s, screen: 'root' } };
      if (arrow !== null) return { state: moveArrow(s, arrow, d) };
      return { state: s };
    }
    case 'targets': {
      const targets = s.pendingMove === null ? [] : d.targets(s.pendingMove);
      const commitAt = (x: BattleMenuState, at: number): MenuResult => {
        const target = targets[at];
        return target !== undefined && x.pendingMove !== null ? submit(x, x.pendingMove, target) : { state: x };
      };
      if (picked !== null) return picked >= 0 && picked < targets.length ? tap(s, picked, (x) => ({ ...x, targetIndex: picked }), (x) => commitAt(x, picked)) : { state: s };
      if (button === 'a') return commitAt(s, s.targetIndex);
      if (button === 'b') return { state: { ...s, screen: 'moves', pendingMove: null } };
      if (arrow !== null) return { state: { ...s, targetIndex: gridMove(s.targetIndex, arrow, targets.length, TARGET_COLUMNS) } };
      return { state: s };
    }
    case 'temp': {
      if (d.tempUnlocked !== true) return { state: { ...s, screen: 'root' } };
      const confirm = (x: BattleMenuState, i: number): MenuResult => {
        const temperature = clampTemp(i);
        return { state: { ...x, screen: 'root', temperature, tempIndex: temperature }, effect: { kind: 'temperature', temperature } };
      };
      if (picked !== null) return picked >= 0 && picked < TEMPS.length ? tap(s, picked, (x) => ({ ...x, tempIndex: clampTemp(picked) }), (x) => confirm(x, picked)) : { state: s };
      if (button === 'a') return confirm(s, s.tempIndex);
      if (button === 'b') return { state: { ...s, screen: 'root', tempIndex: s.temperature } };
      if (button === 'left' || button === 'up') return { state: { ...s, tempIndex: clampTemp(s.tempIndex - 1) } };
      if (button === 'right' || button === 'down') return { state: { ...s, tempIndex: clampTemp(s.tempIndex + 1) } };
      return { state: s };
    }
    case 'log': {
      if (button === 'a' || button === 'b') return { state: { ...s, screen: 'root' } };
      const last = Math.max(0, d.log.length - 1);
      if (button === 'up') return { state: { ...s, logIndex: Math.max(0, s.logIndex - 1) } };
      if (button === 'down') return { state: { ...s, logIndex: Math.min(last, s.logIndex + 1) } };
      return { state: s };
    }
  }
}

/** The showing menu as plain items (what the renderers draw and the dev hook reports). */
export function menuView(s: BattleMenuState, d: MenuData): MenuState {
  switch (s.screen) {
    case 'root':
      return { id: MENU_IDS.root, items: rootLabels(s, d), index: s.rootIndex };
    case 'moves':
      return { id: MENU_IDS.moves, items: d.moves.map((m) => m.name.toUpperCase()), index: s.moveIndex };
    case 'targets':
      return { id: MENU_IDS.targets, items: (s.pendingMove === null ? [] : d.targets(s.pendingMove)).map((t) => d.targetName(t)), index: s.targetIndex };
    case 'temp':
      return { id: MENU_IDS.temp, items: TEMPS.map((t) => `T${t}`), index: s.tempIndex };
    case 'log':
      return d.log.length === 0 ? { id: MENU_IDS.log, items: ['(nothing yet)'], index: 0 } : { id: MENU_IDS.log, items: d.log, index: Math.min(s.logIndex, d.log.length - 1) };
  }
}

/** The root's labels, in rootItems order; `short` for direct mode's compact row ("NUM OFF", "T2"). */
export function rootLabels(s: BattleMenuState, d: Pick<MenuData, 'tempUnlocked'>, short = false): string[] {
  const label: Record<RootItem, string> = {
    prompt: 'PROMPT',
    temp: short ? `T${s.temperature}` : `TEMP T${s.temperature}`,
    why: 'WHY?',
    log: 'LOG',
    numbers: `${short ? 'NUM' : 'NUMBERS'} ${s.numbers ? 'ON' : 'OFF'}`,
    speed: `SPEED ${s.speed}×`,
  };
  return rootItems(d).map((r) => label[r]);
}

/** The one-line hint under the move list for the highlighted move. */
export function moveHint(m: MoveOption): string {
  if (!m.affordable) return `COST ${m.cost}, ONLY ${m.free} FREE: OVERFLOW → DRIFT`;
  const stats = m.power === null ? '' : `PWR ${m.power}  ACC ${m.accuracy ?? '-'}  `;
  return `${stats}COST ${m.cost} / ${m.free} FREE`;
}

/** The dial's tooltip per notch (bible temperature table), each named "Tn · x.x" like the dial. */
export const TEMPERATURE_TIPS: Readonly<Record<Temperature, string>> = {
  0: 'T0 · 0.0 GREEDY: fixed damage, +10 accuracy.',
  1: 'T1 · 0.5 COOL: 95-105% damage, +5 accuracy.',
  2: 'T2 · 1.0 DEFAULT: 85-110% damage.',
  3: 'T3 · 1.5 WARM: 75-125%, -5 acc, Wild riders.',
  4: 'T4 · 2.0 UNHINGED: 60-150%, -15 acc, 12% hallucinate.',
};
