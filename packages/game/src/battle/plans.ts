// What the HUD says each deck-driven creature will do next round: the foe's telegraph (category, "~N" and target;
// the exact move once revealed) and the player's subagent's plan with the card that chose it ("Tokenibble will:
// Early Exit → Vibrat", "its card: IF foe HP < 50%"). Read from the session before the round; pure given it.

import { moveDef, type DamagePreview, type Deck, type Intent } from '@latentia/engine';
import { cardTrigger } from './card-text.js';
import { telegraph, telegraphDetail, telegraphLine, type Telegraph } from './telegraph.js';

export interface FoePlan {
  readonly kind: 'foe';
  readonly actor: number;
  readonly telegraph: Telegraph;
  /** The category line ("ATTACK ~6 → SAGELET"). */
  readonly line: string;
  /** The same with the move's name instead of the category, shown once a reveal lands mid-round. */
  readonly exactLine: string;
  /** The numbers behind the details toggle ("ATTACK 5-7 → SAGELET"). */
  readonly detail: string;
}

export interface MatePlan {
  readonly kind: 'mate';
  readonly actor: number;
  readonly cardId: string | null;
  /** "TOKENIBBLE WILL:" */
  readonly who: string;
  /** "EARLY EXIT → VIBRAT" */
  readonly line: string;
  /** "its card: IF foe HP < 50%" */
  readonly card: string;
}

export type Plan = FoePlan | MatePlan;

export interface PlanSource {
  intents(): Intent[];
  revealedFoes(): Set<number>;
  sideOf(index: number): 0 | 1;
  shortName(index: number): string;
  moveName(moveId: string): string;
  deckOf(index: number): Deck | null;
  damagePreview(intent: Intent): DamagePreview | null;
}

/** The plan line of the player's subagent: its move and target, upper case like the panels. */
const mateLine = (i: Intent, s: PlanSource): string => {
  // "TOKENIBBLE WILL:" plus this must fit the 240 px band's 38 characters; "(SELF)" keeps Low Latency inside it.
  const move = s.moveName(i.moveId).toUpperCase();
  return i.target === i.actor ? `${move} (SELF)` : `${move} → ${s.shortName(i.target)}`;
};

/** The card text for a fired card id: its trigger, or "Default" for the card that fires when nothing above does. */
export function cardLine(deck: Deck | null, cardId: string | null, moveName: (m: string) => string): string {
  if (deck === null || cardId === null) return 'its card: none';
  if (deck.default.id === cardId) return 'its card: Default';
  const card = deck.cards.find((c) => c.id === cardId);
  return card === undefined ? `its card: ${cardId}` : `its card: ${cardTrigger(card, moveName)}`;
}

export function plansFor(s: PlanSource): Plan[] {
  const revealed = s.revealedFoes();
  return s.intents().flatMap((i): Plan[] => {
    const move = moveDef(i.moveId);
    if (move === null) return [];
    if (s.sideOf(i.actor) === 0) {
      return [{ kind: 'mate', actor: i.actor, cardId: i.cardId, who: `${s.shortName(i.actor)} WILL:`, line: mateLine(i, s), card: cardLine(s.deckOf(i.actor), i.cardId, s.moveName) }];
    }
    const input = { move, preview: s.damagePreview(i), selfAimed: i.target === i.actor, targetName: s.shortName(i.target) };
    const t = telegraph({ ...input, revealed: revealed.has(i.actor) });
    const exact = telegraph({ ...input, revealed: true });
    return [{ kind: 'foe', actor: i.actor, telegraph: t, line: telegraphLine(t), exactLine: telegraphLine(exact), detail: telegraphDetail(t) }];
  });
}
