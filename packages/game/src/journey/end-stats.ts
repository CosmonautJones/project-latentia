// The end card's numbers (plan step 9): turns played, cards fired, the distill choice, the core loop's losses →
// swaps → rematches, and the virtual water receipt. Pure, from the flow state.

import type { FlowState } from '../flow/flow.js';
import { virtualWaterReceipt } from './receipt.js';

export interface EndStats {
  readonly lines: readonly string[];
  readonly receipt: string;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export function endCardStats(s: FlowState): EndStats {
  const t = s.telemetry;
  const distill = s.distill === 'spinUp' ? 'spin up (Tokenibble)' : s.distill === 'graft' ? 'graft (Token Nibble)' : '-';
  return {
    lines: [
      `Turns played: ${t.turns}`,
      `Cards fired: ${t.cardsFired}`,
      `Distill: ${distill}`,
      `Bootcamp Grad: ${plural(t.losses, 'loss', 'losses')} -> ${plural(t.swaps, 'swap', 'swaps')} -> ${plural(t.rematches, 'rematch', 'rematches')}`,
    ],
    receipt: virtualWaterReceipt({ rounds: t.turns, moves: t.moves }).text,
  };
}
