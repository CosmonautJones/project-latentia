// Entry point: wires the input hub, flow, layout and Phaser together, and installs the dev hook in dev/test.

import Phaser from 'phaser';
import './style.css';
import type { App, Probe, Screen } from './app.js';
import { installHook } from './dev/hook.js';
import { FlowController } from './flow/controller.js';
import type { SceneKey } from './flow/flow.js';
import { InputHub } from './input/hub.js';
import { bindKeyboard } from './input/keyboard.js';
import { mountTouchControls } from './input/touch-controls.js';
import { readViewport, watchLayout } from './layout/apply.js';
import { computeViewport, type Layout } from './layout/viewport.js';
import { browserStorage } from './save/browser-storage.js';
import { BattleScene } from './scenes/battle.js';
import { BootScene } from './scenes/boot.js';
import { DebriefScene } from './scenes/debrief.js';
import { DistillScene } from './scenes/distill.js';
import { EndScene } from './scenes/end.js';
import { OverworldScene } from './scenes/overworld.js';
import { TitleScene } from './scenes/title.js';
import { showNotice } from './ui/notice.js';
import { liveTapZones } from './ui/tap-zone.js';
import { css, COLOR } from './ui/palette.js';

const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
};

const frame = byId('frame');
const controls = byId('controls');

const input = new InputHub();
bindKeyboard(window, input);
mountTouchControls(controls, input);

let game: Phaser.Game | null = null;
const switchScene = (key: SceneKey) => {
  // Deferred so a scene is never stopped from inside its own input or update handler.
  setTimeout(() => {
    if (!game) return;
    for (const s of game.scene.getScenes(true)) if (s.scene.key !== key) game.scene.stop(s.scene.key);
    game.scene.start(key);
  }, 0);
};

const probe: Probe = { scene: null, menu: null, battle: null, overworld: null, panel: null };
// A blocked or full localStorage never stops the game: it plays on in memory and says so once.
const storage = browserStorage(window, () => showNotice(document, 'SAVES UNAVAILABLE'));

let layout: Layout = computeViewport(readViewport(window));
let layoutListeners: ((l: Layout) => void)[] = [];
const screen: Screen = {
  layout: () => layout,
  onLayout: (listener) => {
    layoutListeners = [...layoutListeners, listener];
    return () => {
      layoutListeners = layoutListeners.filter((l) => l !== listener);
    };
  },
};
const app: App = { input, flow: new FlowController(storage, switchScene), storage, probe, screen };

watchLayout(window, { frame, controls }, (l) => {
  const resized = l.logical.width !== layout.logical.width || l.logical.height !== layout.logical.height;
  layout = l;
  if (game) {
    // The game runs at the logical size; FIT then fills the exactly-sized parent. refresh() alone reuses the cached
    // parent size, so re-read it first.
    if (resized) game.scale.setGameSize(l.logical.width, l.logical.height);
    game.scale.getParentBounds();
    game.scale.refresh();
  }
  // relayout: every scene lays itself out again for the new size.
  for (const listener of layoutListeners) listener(l);
});

game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: frame,
  width: layout.logical.width,
  height: layout.logical.height,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: css(COLOR.ink),
  banner: false,
  disableContextMenu: true,
  input: { keyboard: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER,
    expandParent: false,
  },
  scene: [new BootScene(app), new TitleScene(app), new OverworldScene(app), new BattleScene(app), new DistillScene(app), new DebriefScene(app), new EndScene(app)],
});

// The static form of shouldExposeHook (dev/hook.ts), so production folds it away and drops the hook entirely.
if (import.meta.env.DEV || import.meta.env.MODE === 'test') installHook(window, { flow: app.flow, input, probe, layout: () => layout, taps: () => (game ? liveTapZones(game) : []) });
