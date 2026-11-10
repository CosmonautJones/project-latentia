// Entry point: wires the input hub, flow, layout and Phaser together, and installs the dev hook in dev/test.

import Phaser from 'phaser';
import './style.css';
import type { App, Probe, Screen } from './app.js';
import { installHook, shouldExposeHook } from './dev/hook.js';
import { FlowController } from './flow/controller.js';
import type { SceneKey } from './flow/flow.js';
import { InputHub } from './input/hub.js';
import { bindKeyboard } from './input/keyboard.js';
import { mountTouchControls } from './input/touch-controls.js';
import { readViewport, watchLayout } from './layout/apply.js';
import { computeLayout, GAME_HEIGHT, GAME_WIDTH, type Layout } from './layout/compute.js';
import { browserStorage } from './save/browser-storage.js';
import { BattleScene } from './scenes/battle.js';
import { BootScene } from './scenes/boot.js';
import { EndScene } from './scenes/end.js';
import { LabScene } from './scenes/lab.js';
import { OverworldScene } from './scenes/overworld.js';
import { TitleScene } from './scenes/title.js';
import { css, COLOR } from './ui/palette.js';

const byId = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el;
};

const frame = byId('frame');
const band = byId('band');
const controls = byId('controls');
const bandPanel = byId('band-panel');

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

const probe: Probe = { scene: null, menu: null, battle: null };
const storage = browserStorage(window);

let layout: Layout = computeLayout(readViewport(window));
let layoutListeners: ((l: Layout) => void)[] = [];
const screen: Screen = {
  layout: () => layout,
  onLayout: (listener) => {
    layoutListeners = [...layoutListeners, listener];
    return () => {
      layoutListeners = layoutListeners.filter((l) => l !== listener);
    };
  },
  bandPanel,
};
const app: App = { input, flow: new FlowController(storage, switchScene), storage, probe, screen };

watchLayout(window, { frame, band, controls }, (l) => {
  layout = l;
  // refresh() alone reuses the cached parent size; re-read it first.
  game?.scale.getParentBounds();
  game?.scale.refresh();
  for (const listener of layoutListeners) listener(l);
});

game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: frame,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
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
  scene: [new BootScene(app), new TitleScene(app), new LabScene(app), new OverworldScene(app), new BattleScene(app), new EndScene(app)],
});

if (shouldExposeHook(import.meta.env)) installHook(window, { flow: app.flow, input, probe, layout: () => layout });
