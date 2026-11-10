// The overworld's two scripted beats that end in a choice (plan steps 2 and 7): Prof. Epoch's intro and the starter
// pick in the lab, and the card tutorial over the trailhead. Each says its lines in the dialogue box, then opens a
// ChoicePanel; B on the panel replays the lines (a back path), and the promise resolves with the choice.

import type Phaser from 'phaser';
import type { App } from '../app.js';
import { CARD_TUTORIAL_HINT, CARD_TUTORIAL_TITLE, PROFESSOR_INTRO, STARTER_CHOICES } from '../content/journey-text.js';
import { TOKENIBBLE_PRESETS } from '../content/trainers.js';
import { STARTERS, type StarterId } from '../flow/flow.js';
import { cardChoices } from '../journey/debrief.js';
import { ChoicePanel, type ChoiceItem } from '../ui/choice-panel.js';
import type { DialogueBox } from '../ui/dialogue-box.js';

interface Beat {
  readonly scene: Phaser.Scene;
  readonly app: App;
  readonly box: DialogueBox;
  /** False once the scene has restarted or shut down: the beat stops. */
  readonly live: () => boolean;
  /** Told what is on screen, for the dev probe. */
  readonly onSay: (text: string | null) => void;
}

/** Say `lines`, then offer `items`; B replays the lines. Resolves with the picked index, or null if the scene went away. */
async function sayThenChoose(b: Beat, lines: readonly string[], panel: { id: string; title: string; items: readonly ChoiceItem[] }, closeOnB: boolean): Promise<number | null> {
  for (;;) {
    for (const line of lines) {
      b.onSay(line);
      await b.box.say(line, { closeOnB });
      if (!b.live()) return null;
    }
    b.onSay(null);
    const picked = await new Promise<number | null>((resolve) => {
      const p = new ChoicePanel(b.scene, b.app, {
        ...panel,
        onConfirm: (i) => {
          p.destroy();
          resolve(i);
        },
        onCancel: () => {
          p.destroy();
          resolve(-1);
        },
      });
    });
    if (!b.live() || picked === null) return null;
    if (picked >= 0) return picked;
  }
}

/** Prof. Epoch's intro, then Sagelet, Blitzr or Forkling, each with a line on what it is like. */
export async function labIntro(b: Beat): Promise<StarterId | null> {
  const items = STARTERS.map((s) => STARTER_CHOICES[s]);
  const i = await sayThenChoose(b, PROFESSOR_INTRO, { id: 'starter', title: 'CHOOSE YOUR FIRST MODEL', items }, false);
  return i === null ? null : (STARTERS[i] ?? null);
}

/** The card tutorial: the first-time hint about cards, then the three example cards, each with what it's good for. */
export async function cardTutorial(b: Beat): Promise<string | null> {
  const cards = cardChoices(TOKENIBBLE_PRESETS, null);
  const i = await sayThenChoose(b, [CARD_TUTORIAL_HINT], { id: 'tutorial-card', title: CARD_TUTORIAL_TITLE, items: cards.map((c) => ({ label: c.label, detail: c.detail })) }, true);
  return i === null ? null : (cards[i]?.id ?? null);
}
