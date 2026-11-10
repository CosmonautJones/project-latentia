// The services every scene shares, built once in main.ts and handed to each scene's constructor.

import type { FlowController } from './flow/controller.js';
import type { InputHub } from './input/hub.js';
import type { KeyValueStorage } from './save/save.js';
import type { MenuState } from './ui/menu.js';

/** What the dev hook can observe: the running scene and the menu that has the cursor. */
export interface Probe {
  scene: string | null;
  menu: MenuState | null;
}

export interface App {
  readonly input: InputHub;
  readonly flow: FlowController;
  readonly storage: KeyValueStorage;
  readonly probe: Probe;
}
