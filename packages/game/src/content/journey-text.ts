// The journey's words that are not battle lines: the professor, the starter and distill choices, the card tutorial,
// the debrief and the end card. One text box per joke (bible writing rule 4); the satire lands on the industry,
// never on the player's models (rule 3).

import type { DistillChoice, StarterId } from '../flow/flow.js';

export const PROFESSOR_INTRO = [
  "PROF. EPOCH: Welcome to the lab! I train models. Well, I fine-tune other people's models. Same thing, says marketing.",
  "Pick one. They're all state of the art. For about six weeks.",
];

export const STARTER_CHOICES: Readonly<Record<StarterId, { readonly label: string; readonly detail: string }>> = {
  sagelet: { label: 'SAGELET   Reasoning', detail: 'Thinks step by step, out loud, at length. Hits Code hard.' },
  blitzr: { label: 'BLITZR    Speed', detail: 'Ships first, tests never. Fast, fragile, very confident.' },
  forkling: { label: 'FORKLING  Open', detail: 'Open weights, open opinions. Tough, and forks a decoy once.' },
};

export const DISTILL_TITLE = 'DISTILL TOKENIBBLE';
export const DISTILL_INTRO = "Tokenibble is beaten, not deleted. Distill it. (We don't say 'catch'. Legal was very clear.)";

export const DISTILL_CHOICES: Readonly<Record<DistillChoice, { readonly label: string; readonly detail: string }>> = {
  spinUp: { label: 'SPIN UP  (recommended)', detail: 'It joins your team at L3 and acts on its own, from one card you teach it.' },
  graft: { label: 'GRAFT', detail: 'Its Token Nibble becomes a piece of your grid. Your starter uses it; no new teammate.' },
};

/** The card tutorial's first-time hint, in the battle hints' style: one box, then the cards. */
export const CARD_TUTORIAL_HINT =
  "CARDS: a subagent acts on its own, from example cards. A card reads IF this THEN that. Tokenibble has room for one card. When no card fits, it uses its Default: Token Burst.";
export const CARD_TUTORIAL_TITLE = 'TEACH TOKENIBBLE ONE CARD';

/** The graft path's debrief hint, after a loss: there is no card to swap, so it's about using the grafted move. */
export const GRAFT_HINT = "Token Nibble hits softer than your best move, but costs just 1 and makes the foe's next move cost 1 more. Try it when your context is tight.";
