import type { BattleEvent } from '../events/types.js';
import { changeDrift, type ContextState, type Token } from './store.js';

/**
 * Compact: pairs the six oldest tokens (1,2),(3,4),(5,6) into summaries (an odd last token stays as is),
 * clears 1 Drift. Never emits StageChanged: `summarizedBuffs` lists one entry per summarized buff-tagged token
 * so the battle unit can emit accurate StageChanged events.
 */
export function compact(
  ctx: ContextState,
  round: number,
  actor: number,
): { events: BattleEvent[]; summarizedBuffs: { stat: string; stages: number }[] } {
  const events: BattleEvent[] = [];
  const summarizedBuffs: { stat: string; stages: number }[] = [];
  const before = ctx.tokens.length;
  const span = before < 6 ? before : 6;
  const next: Token[] = [];
  let i = 0;
  while (i + 1 < span) {
    for (let j = i; j <= i + 1; j++) {
      const buff = (ctx.tokens[j] as Token).buff;
      if (buff !== undefined) summarizedBuffs.push({ stat: buff.stat, stages: buff.stages });
    }
    next.push({ kind: 'summary', seq: ctx.nextSeq });
    ctx.nextSeq += 1;
    i += 2;
  }
  for (let k = i; k < before; k++) next.push(ctx.tokens[k] as Token);
  ctx.tokens = next;
  events.push({ type: 'Compacted', round, target: actor, tokensBefore: before, tokensAfter: next.length });
  events.push(...changeDrift(ctx, -1, round, actor));
  return { events, summarizedBuffs };
}
