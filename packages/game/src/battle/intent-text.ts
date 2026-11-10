// An engine Intent as the short line the intent preview shows over a creature: "Token Burst → SAGELET".

import type { Intent } from '@latentia/engine';

export interface IntentContext {
  /** The upper-case short name the panels use ("SAGELET"). */
  shortName(index: number): string;
  moveName(moveId: string): string;
}

/** At most `maxChars` characters; a longer line ends in "…". */
export function formatIntent(intent: Intent, c: IntentContext, maxChars: number): string {
  const move = c.moveName(intent.moveId);
  const line = intent.target === intent.actor ? `${move} (self)` : `${move} → ${c.shortName(intent.target)}`;
  const chars = [...line];
  return chars.length <= maxChars ? line : `${chars.slice(0, Math.max(0, maxChars - 1)).join('')}…`;
}
