// What the intent preview may show (controller ruling V2; engine intents.ts: "The game client must hide the foe
// side's intents from the player unless they are revealed (Red Team, Saliency Map, Socratic Method)"). The player's
// own subagents always show their plan; a foe shows "?" unless a revealIntents field the player's side started is
// on it (Red Team and Saliency Map last into later rounds), or a reveal lands on it mid-round (Socratic Method).

import type { FieldState, Intent } from '@latentia/engine';
import { formatIntent, type IntentContext } from './intent-text.js';

export const HIDDEN_INTENT = '?';

/** Foes (side 1) holding a revealIntents field that a creature of the player's side (0) started. */
export function revealedFoes(fields: readonly FieldState[], sideOf: (index: number) => 0 | 1): Set<number> {
  const out = new Set<number>();
  for (const f of fields) if (f.effect.kind === 'revealIntents' && sideOf(f.target) === 1 && sideOf(f.source) === 0) out.add(f.target);
  return out;
}

/** The preview line for one intent: its move and target when visible to the player, else "?". */
export function intentLine(intent: Intent, c: IntentContext, sideOf: (index: number) => 0 | 1, revealed: ReadonlySet<number>, maxChars: number): string {
  const visible = sideOf(intent.actor) === 0 || revealed.has(intent.actor);
  return visible ? formatIntent(intent, c, maxChars) : HIDDEN_INTENT;
}
