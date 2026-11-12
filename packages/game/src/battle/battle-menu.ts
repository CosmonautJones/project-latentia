// The pure battle command menu: the root (PROMPT, TEMP, WHY?, LOG, SPEED in two columns), the move list, a target list
// when a move has a choice of targets, the temperature dial and the round log. B backs out of every submenu. Taps on a
// menu that is not showing are ignored. On touch and pointer a commit takes two taps (ruling V5.2): the first tap on a
// move, notch or target selects it and shows its hint (and any overflow → Drift warning), a second tap on the same
// item commits. Keys and the D-pad are unchanged. The in-image command box renders this one state.

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

const ROOT_COUNT = 5;

const TEMPS: readonly Temperature[] = [0, 1, 2, 3, 4];

export interface BattleMenuState {
  readonly screen: MenuScreen;
  /** 0 PROMPT, 1 TEMP, 2 WHY?, 3 LOG, 4 SPEED, laid out two to a row. */
  readonly rootIndex: number;
  readonly moveIndex: number;
  readonly targetIndex: number;
  /** The dial's cursor while TEMP is open. */
  readonly tempIndex: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
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
}

export type MenuEffect =
  | { readonly kind: 'submit'; readonly choice: PlayerChoice }
  | { readonly kind: 'why' }
  | { readonly kind: 'speed'; readonly speed: Speed }
  | { readonly kind: 'temperature'; readonly temperature: Temperature };

export interface MenuResult {
  readonly state: BattleMenuState;
  readonly effect?: MenuEffect;
}

export function initialMenu(temperature: Temperature = 2, speed: Speed = 1): BattleMenuState {
  return { screen: 'root', rootIndex: 0, moveIndex: 0, targetIndex: 0, tempIndex: temperature, temperature, speed, pendingMove: null, logIndex: 0, armed: null };
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

function rootMove(index: number, button: 'up' | 'down' | 'left' | 'right'): number {
  if (button === 'left' || button === 'right') return (index ^ 1) < ROOT_COUNT ? index ^ 1 : index;
  if (button === 'down') return index + 2 < ROOT_COUNT ? index + 2 : index % 2;
  if (index - 2 >= 0) return index - 2;
  // Up from the top row wraps to the bottom of the same column.
  let last = index % 2;
  while (last + 2 < ROOT_COUNT) last += 2;
  return last;
}

const wrap = (i: number, n: number): number => (n === 0 ? 0 : (i + n) % n);
const clampTemp = (i: number): Temperature => TEMPS[Math.max(0, Math.min(TEMPS.length - 1, i))] ?? 2;

/** The row the cursor is on and the action, for the screen showing; a tap elsewhere is null. */
function decode(s: BattleMenuState, a: InputAction): { button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b' } | { pickAt: number } | null {
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
  switch (index) {
    case 0:
      return { state: { ...at, screen: 'moves' } };
    case 1:
      return { state: { ...at, screen: 'temp', tempIndex: s.temperature } };
    case 2:
      return { state: at, effect: { kind: 'why' } };
    case 3:
      return { state: { ...at, screen: 'log', logIndex: Math.max(0, d.log.length - 1) } };
    default: {
      const speed: Speed = s.speed === 1 ? 2 : 1;
      return { state: { ...at, speed }, effect: { kind: 'speed', speed } };
    }
  }
}

export function menuStep(s0: BattleMenuState, action: InputAction, d: MenuData): MenuResult {
  const input = decode(s0, action);
  if (input === null) return { state: s0 };
  const button = 'button' in input ? input.button : null;
  const picked = 'pickAt' in input ? input.pickAt : null;
  // Any key press disarms a tap selection.
  const s = button !== null && s0.armed !== null ? { ...s0, armed: null } : s0;
  switch (s.screen) {
    case 'root': {
      if (picked !== null) return picked >= 0 && picked < ROOT_COUNT ? chooseRoot(s, picked, d) : { state: s };
      if (button === 'a') return chooseRoot(s, s.rootIndex, d);
      if (button === 'left' || button === 'right' || button === 'up' || button === 'down') return { state: { ...s, rootIndex: rootMove(s.rootIndex, button) } };
      return { state: s };
    }
    case 'moves': {
      if (picked !== null) return picked >= 0 && picked < d.moves.length ? tap(s, picked, (x) => ({ ...x, moveIndex: picked }), (x) => chooseMove(x, picked, d)) : { state: s };
      if (button === 'a') return chooseMove(s, s.moveIndex, d);
      if (button === 'b') return { state: { ...s, screen: 'root' } };
      if (button === 'up' || button === 'down') return { state: { ...s, moveIndex: wrap(s.moveIndex + (button === 'up' ? -1 : 1), d.moves.length) } };
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
      if (button === 'up' || button === 'down') return { state: { ...s, targetIndex: wrap(s.targetIndex + (button === 'up' ? -1 : 1), targets.length) } };
      return { state: s };
    }
    case 'temp': {
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
      return { id: MENU_IDS.root, items: ['PROMPT', `TEMP T${s.temperature}`, 'WHY?', 'LOG', `SPEED ${s.speed}×`], index: s.rootIndex };
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
