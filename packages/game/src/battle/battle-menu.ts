// The pure battle command menu: a 2×2 root (PROMPT, TEMP, WHY?, SPEED), the move list, a target list when a move
// has a choice of targets, and the temperature dial. B backs out of every submenu. Taps on a menu that is not
// showing are ignored. The landscape canvas menu and the portrait band menu both render this one state.

import type { Temperature } from '@latentia/engine';
import type { InputAction } from '../input/hub.js';
import type { MenuState } from '../ui/menu.js';
import type { MoveOption, PlayerChoice } from './session.js';
import type { Speed } from './timeline.js';

export type MenuScreen = 'root' | 'moves' | 'targets' | 'temp';

export const MENU_IDS: Readonly<Record<MenuScreen, string>> = {
  root: 'battle-root',
  moves: 'battle-moves',
  targets: 'battle-targets',
  temp: 'battle-temp',
};

const TEMPS: readonly Temperature[] = [0, 1, 2, 3, 4];

export interface BattleMenuState {
  readonly screen: MenuScreen;
  /** 0 PROMPT, 1 TEMP, 2 WHY?, 3 SPEED, laid out as a 2×2 grid. */
  readonly rootIndex: number;
  readonly moveIndex: number;
  readonly targetIndex: number;
  /** The dial's cursor while TEMP is open. */
  readonly tempIndex: number;
  readonly temperature: Temperature;
  readonly speed: Speed;
  /** The move waiting for a target. */
  readonly pendingMove: string | null;
}

export interface MenuData {
  readonly moves: readonly MoveOption[];
  targets(moveId: string): readonly number[];
  targetName(index: number): string;
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
  return { screen: 'root', rootIndex: 0, moveIndex: 0, targetIndex: 0, tempIndex: temperature, temperature, speed, pendingMove: null };
}

const wrap = (i: number, n: number): number => (n === 0 ? 0 : (i + n) % n);
const clampTemp = (i: number): Temperature => TEMPS[Math.max(0, Math.min(TEMPS.length - 1, i))] ?? 2;

/** The row the cursor is on and the action, for the screen showing; a tap elsewhere is null. */
function decode(s: BattleMenuState, a: InputAction): { button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b' } | { pickAt: number } | null {
  if (a.kind === 'pick') return a.menuId === MENU_IDS[s.screen] ? { pickAt: a.index } : null;
  return a.kind === 'press' ? { button: a.button } : null;
}

function submit(s: BattleMenuState, moveId: string, target: number): MenuResult {
  return { state: { ...s, screen: 'root', rootIndex: 0, pendingMove: null, targetIndex: 0 }, effect: { kind: 'submit', choice: { moveId, target, temperature: s.temperature } } };
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

function chooseRoot(s: BattleMenuState, index: number): MenuResult {
  const at = { ...s, rootIndex: index };
  switch (index) {
    case 0:
      return { state: { ...at, screen: 'moves' } };
    case 1:
      return { state: { ...at, screen: 'temp', tempIndex: s.temperature } };
    case 2:
      return { state: at, effect: { kind: 'why' } };
    default: {
      const speed: Speed = s.speed === 1 ? 2 : 1;
      return { state: { ...at, speed }, effect: { kind: 'speed', speed } };
    }
  }
}

export function menuStep(s: BattleMenuState, action: InputAction, d: MenuData): MenuResult {
  const input = decode(s, action);
  if (input === null) return { state: s };
  const button = 'button' in input ? input.button : null;
  const picked = 'pickAt' in input ? input.pickAt : null;
  switch (s.screen) {
    case 'root': {
      if (picked !== null) return picked >= 0 && picked < 4 ? chooseRoot(s, picked) : { state: s };
      if (button === 'a') return chooseRoot(s, s.rootIndex);
      if (button === 'left' || button === 'right') return { state: { ...s, rootIndex: s.rootIndex ^ 1 } };
      if (button === 'up' || button === 'down') return { state: { ...s, rootIndex: s.rootIndex ^ 2 } };
      return { state: s };
    }
    case 'moves': {
      if (picked !== null) return chooseMove(s, picked, d);
      if (button === 'a') return chooseMove(s, s.moveIndex, d);
      if (button === 'b') return { state: { ...s, screen: 'root' } };
      if (button === 'up' || button === 'down') return { state: { ...s, moveIndex: wrap(s.moveIndex + (button === 'up' ? -1 : 1), d.moves.length) } };
      return { state: s };
    }
    case 'targets': {
      const targets = s.pendingMove === null ? [] : d.targets(s.pendingMove);
      const at = picked ?? (button === 'a' ? s.targetIndex : null);
      const target = at === null ? undefined : targets[at];
      if (target !== undefined && s.pendingMove !== null) return submit(s, s.pendingMove, target);
      if (button === 'b') return { state: { ...s, screen: 'moves', pendingMove: null } };
      if (button === 'up' || button === 'down') return { state: { ...s, targetIndex: wrap(s.targetIndex + (button === 'up' ? -1 : 1), targets.length) } };
      return { state: s };
    }
    case 'temp': {
      const confirm = (i: number): MenuResult => {
        const temperature = clampTemp(i);
        return { state: { ...s, screen: 'root', temperature, tempIndex: temperature }, effect: { kind: 'temperature', temperature } };
      };
      if (picked !== null) return picked >= 0 && picked < TEMPS.length ? confirm(picked) : { state: s };
      if (button === 'a') return confirm(s.tempIndex);
      if (button === 'b') return { state: { ...s, screen: 'root', tempIndex: s.temperature } };
      if (button === 'left' || button === 'up') return { state: { ...s, tempIndex: clampTemp(s.tempIndex - 1) } };
      if (button === 'right' || button === 'down') return { state: { ...s, tempIndex: clampTemp(s.tempIndex + 1) } };
      return { state: s };
    }
  }
}

/** The showing menu as plain items (what the renderers draw and the dev hook reports). */
export function menuView(s: BattleMenuState, d: MenuData): MenuState {
  switch (s.screen) {
    case 'root':
      return { id: MENU_IDS.root, items: ['PROMPT', `TEMP T${s.temperature}`, 'WHY?', `SPEED ${s.speed}×`], index: s.rootIndex };
    case 'moves':
      return { id: MENU_IDS.moves, items: d.moves.map((m) => m.name.toUpperCase()), index: s.moveIndex };
    case 'targets':
      return { id: MENU_IDS.targets, items: (s.pendingMove === null ? [] : d.targets(s.pendingMove)).map((t) => d.targetName(t)), index: s.targetIndex };
    case 'temp':
      return { id: MENU_IDS.temp, items: TEMPS.map((t) => `T${t}`), index: s.tempIndex };
  }
}

/** The one-line hint under the move list for the highlighted move. */
export function moveHint(m: MoveOption): string {
  if (!m.affordable) return `COST ${m.cost}, ONLY ${m.free} FREE: OVERFLOW → DRIFT`;
  const stats = m.power === null ? '' : `PWR ${m.power}  ACC ${m.accuracy ?? '-'}  `;
  return `${stats}COST ${m.cost} / ${m.free} FREE`;
}

/** The dial's tooltip per notch (bible temperature table). */
export const TEMPERATURE_TIPS: Readonly<Record<Temperature, string>> = {
  0: 'GREEDY 0.0: fixed damage, +10 accuracy.',
  1: 'COOL 0.5: 95-105% damage, +5 accuracy.',
  2: 'DEFAULT 1.0: 85-110% damage.',
  3: 'WARM 1.5: 75-125%, -5 acc, Wild riders.',
  4: 'UNHINGED 2.0: 60-150%, -15 acc, 12% hallucinate.',
};
