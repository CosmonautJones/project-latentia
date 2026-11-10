// Lab (stub): one line from the professor, then the starter pick. P4 replaces the frame with the real lab.

import type { App } from '../app.js';
import { STARTERS, type StarterId } from '../flow/flow.js';
import { DialogueBox } from '../ui/dialogue-box.js';
import { MenuList } from '../ui/menu-list.js';
import { BaseScene } from './base-scene.js';

const STARTER_LABELS: Readonly<Record<StarterId, string>> = {
  sagelet: 'SAGELET   Reasoning',
  blitzr: 'BLITZR    Speed',
  forkling: 'FORKLING  Open',
};

const PROFESSOR_LINE =
  "PROF. EPOCH: Welcome to the lab! Pick a model. They're all state of the art. For about six weeks.";

export class LabScene extends BaseScene {
  constructor(app: App) {
    super('Lab', app);
  }

  create(): void {
    this.stubFrame('LAB');
    const box = new DialogueBox(this, this.app);
    const menu = new MenuList(this, this.app, {
      id: 'starter',
      items: STARTERS.map((s) => STARTER_LABELS[s]),
      x: 60,
      y: 40,
      width: 200,
      rowHeight: 16,
      onConfirm: (i) => {
        const starter = STARTERS[i];
        if (starter) this.send({ type: 'starterPicked', starter });
      },
      // Back: hear the professor out again.
      onCancel: () => void talk(),
    }).setActive(false);
    const talk = async () => {
      menu.setActive(false);
      await box.say(PROFESSOR_LINE);
      menu.setActive(true);
    };
    void talk();
    this.ready();
  }
}
