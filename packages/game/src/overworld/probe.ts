// What the overworld scene reports to the dev hook (dev and test builds only): where the player is and what the
// scene is doing, so the e2e can walk the map with real input and see triggers fire.

import type { OverworldStep } from '../flow/flow.js';
import type { Dir } from './direction.js';
import type { Pos } from './map.js';

/** `walk`: free to move; the rest are the scripted beats that hold movement until they finish. */
export type OverworldMode = 'walk' | 'talk' | 'warp' | 'encounter' | 'spotted' | 'menu' | 'leaving';

export interface OverworldProbe {
  readonly step: OverworldStep;
  readonly area: string;
  readonly x: number;
  readonly y: number;
  readonly facing: Dir;
  readonly moving: boolean;
  readonly mode: OverworldMode;
  /** The dialogue on screen, if any. */
  readonly dialogue: string | null;
  /** The place-name caption on screen, if any. */
  readonly caption: string | null;
  readonly encounterLive: boolean;
  readonly trainerLive: boolean;
  /** Where the trainer stands now (it walks over once it spots you), when it is in the shown area. */
  readonly trainer: Pos | null;
  /** Phaser's measured frame rate. */
  readonly fps: number;
  /** Listeners on the scene's SHUTDOWN event: steady across warps (each fade cleans up after itself). */
  readonly shutdownListeners: number;
}
