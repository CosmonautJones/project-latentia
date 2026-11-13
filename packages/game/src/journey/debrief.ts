// The debrief after every Bootcamp Grad fight (plan step 8, the core loop): what the fight showed and what you can do
// next. Pure, from the flow state. A spin-up loss shows what Tokenibble kept doing and offers a card swap, then a
// rematch as is; a win offers the end, then an optional "try a different card?"; the graft path gets the grafted-move
// hint and a plain rematch. Every option is a flow event the debrief accepts (test/unit/journey.test.ts).

import { moveDef } from '@latentia/engine';
import { cardText } from '../battle/card-text.js';
import type { CardPreset } from '../content/trainers.js';
import type { FlowEvent, FlowState } from '../flow/flow.js';

export interface CardChoice {
  readonly id: string;
  /** "IF foe HP < 50% THEN Early Exit", with "(TAUGHT)" on the card Tokenibble already has. */
  readonly label: string;
  readonly detail: string;
}

export type DebriefOption =
  | { readonly kind: 'event'; readonly label: string; readonly event: FlowEvent }
  /** Opens the card picker; picking a card sends a rematch with it. */
  | { readonly kind: 'pickCard'; readonly label: string };

export interface Debrief {
  readonly title: string;
  readonly lines: readonly string[];
  readonly options: readonly DebriefOption[];
  readonly cards: readonly CardChoice[];
}

const moveName = (id: string): string => moveDef(id)?.name ?? id;

/** The presets as picker rows: the card in plain words, its one-line hint, and which one is taught now. */
export function cardChoices(presets: readonly CardPreset[], taughtId: string | null): CardChoice[] {
  return presets.map((p) => ({ id: p.id, label: `${cardText(p.card, moveName)}${p.id === taughtId ? ' (TAUGHT)' : ''}`, detail: p.hint }));
}

const FINISH: DebriefOption = { kind: 'event', label: 'ON TO THE END', event: { type: 'finish' } };

export function debriefFor(s: FlowState, presets: readonly CardPreset[]): Debrief {
  const fight = s.lastFight;
  const won = fight?.outcome === 'win';
  const lines = fight?.kept ?? [];
  if (s.distill !== 'spinUp') {
    const rematch: DebriefOption = { kind: 'event', label: 'REMATCH', event: { type: 'rematch', cardId: null } };
    return {
      title: won ? 'YOU BEAT BOOTCAMP GRAD' : 'ABOUT YOUR GRAFT...',
      lines,
      options: won ? [FINISH] : s.trainerBeaten ? [rematch, FINISH] : [rematch],
      cards: [],
    };
  }
  const cards = cardChoices(presets, s.tutorialCardId);
  if (won) return { title: 'YOU BEAT BOOTCAMP GRAD', lines, options: [FINISH, { kind: 'pickCard', label: 'TRY A DIFFERENT CARD?' }], cards };
  const options: DebriefOption[] = [
    { kind: 'pickCard', label: 'SWAP ITS CARD, THEN REMATCH' },
    { kind: 'event', label: 'REMATCH AS IS', event: { type: 'rematch', cardId: null } },
    ...(s.trainerBeaten ? [FINISH] : []),
  ];
  return { title: 'TOKENIBBLE KEPT...', lines, options, cards };
}
