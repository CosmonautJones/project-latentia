// The services every scene shares, built once in main.ts and handed to each scene's constructor.

import type { BattleProbe } from './battle/probe.js';
import type { FlowController } from './flow/controller.js';
import type { InputHub } from './input/hub.js';
import type { Layout } from './layout/compute.js';
import type { KeyValueStorage } from './save/save.js';
import type { OverworldProbe } from './overworld/probe.js';
import type { PanelProbe } from './ui/choice-panel.js';
import type { MenuState } from './ui/menu.js';

/** What the dev hook can observe: the running scene, the menu that has the cursor, the battle and the overworld. */
export interface Probe {
  scene: string | null;
  menu: MenuState | null;
  battle: BattleProbe | null;
  overworld: OverworldProbe | null;
  /** The choice panel on screen (starter, distill, card, debrief), if any. */
  panel: PanelProbe | null;
}

/** The page around the game: the current layout, and the portrait band's panel for DOM menus. */
export interface Screen {
  layout(): Layout;
  /** Called after every re-layout; returns an unsubscribe. */
  onLayout(listener: (layout: Layout) => void): () => void;
  /** `#band-panel`: shown in portrait under the game, hidden in landscape. */
  readonly bandPanel: HTMLElement;
}

export interface App {
  readonly input: InputHub;
  readonly flow: FlowController;
  readonly storage: KeyValueStorage;
  readonly probe: Probe;
  readonly screen: Screen;
}
