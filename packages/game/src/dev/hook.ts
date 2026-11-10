// `window.__latentia`: the automation hook for Playwright and for poking at the game in dev. It exists only in
// dev and in the test build (`vite build --mode test`); production builds never install it.

import type { BattleProbe } from '../battle/probe.js';
import type { Button } from '../input/actions.js';
import type { InputHub } from '../input/hub.js';
import type { FlowController } from '../flow/controller.js';
import type { FlowEvent, FlowState } from '../flow/flow.js';
import type { Layout } from '../layout/compute.js';
import type { OverworldProbe } from '../overworld/probe.js';
import type { PanelProbe } from '../ui/choice-panel.js';
import type { MenuState } from '../ui/menu.js';

export interface LatentiaHook {
  /** The current flow state (step, choices, attempt). */
  flow(): FlowState;
  /** The key of the running scene, once it has finished `create`. */
  scene(): string | null;
  /** The menu that currently has the cursor, if any. */
  menu(): MenuState | null;
  /** The battle in progress (or just finished), if the Battle scene is running one. */
  battle(): BattleProbe | null;
  /** The overworld while the Overworld scene runs: the player's tile, facing and what the scene is doing. */
  overworld(): OverworldProbe | null;
  /** The choice panel on screen (starter, distill, card tutorial, debrief, card swap), if any. */
  panel(): PanelProbe | null;
  layout(): Layout;
  /** Inject a button tap (press and release) into the action stream. */
  press(button: Button): void;
  /** Inject a pointer tap on item `index` of menu `menuId`. */
  pick(menuId: string, index: number): void;
  /** Send a flow event directly; false when the flow rejects it. */
  send(event: FlowEvent): boolean;
}

export interface HookDeps {
  readonly flow: FlowController;
  readonly input: InputHub;
  readonly probe: {
    readonly scene: string | null;
    readonly menu: MenuState | null;
    readonly battle: BattleProbe | null;
    readonly overworld: OverworldProbe | null;
    readonly panel: PanelProbe | null;
  };
  readonly layout: () => Layout;
}

declare global {
  interface Window {
    __latentia?: LatentiaHook;
  }
}

export function shouldExposeHook(env: { readonly DEV: boolean; readonly MODE: string }): boolean {
  return env.DEV || env.MODE === 'test';
}

export function installHook(target: Window, deps: HookDeps): void {
  target.__latentia = {
    flow: () => deps.flow.state,
    scene: () => deps.probe.scene,
    menu: () => deps.probe.menu,
    battle: () => deps.probe.battle,
    overworld: () => deps.probe.overworld,
    panel: () => deps.probe.panel,
    layout: deps.layout,
    press: (button) => deps.input.tap(button),
    pick: (menuId, index) => deps.input.pick(menuId, index),
    send: (event) => deps.flow.send(event),
  };
}
