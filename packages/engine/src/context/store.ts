import type { BattleEvent } from '../events/types.js';
import { cellsOf } from '../grid/model.js';
import type { GridLayout } from '../grid/model.js';
import { isCompactable } from '../grid/adjacency.js';

export const DRIFT_CAP = 5;

/**
 * Removal convention: there is no dedicated removal event, so removals emit ContextAdded with a NEGATIVE
 * `tokens` (the count removed) and one of these kinds. Efficient Answer (freeOldestNonJunk) uses the removed
 * token's own kind ('cost' | 'observation' | 'summary'). Additions use 'cost' | 'junk' | 'observation'.
 */
export const KIND_CLEARED = 'cleared';
export const KIND_RECOVERED = 'recovered';

export type Token = {
  kind: 'cost' | 'junk' | 'observation' | 'summary';
  buff?: { stat: string; stages: number };
  seq: number;
};

export type ContextState = {
  /** Cells available for tokens (orchestrator: grid headroom at battle start; subagent: species Ctx). */
  window: number;
  tokens: Token[];
  drift: number;
  summarizedPieces: string[];
  removedSlots: string[];
  nextSeq: number;
};

export function freeCells(ctx: ContextState): number {
  const free = ctx.window - ctx.tokens.length;
  return free > 0 ? free : 0;
}

export function newContext(window: number): ContextState {
  return { window, tokens: [], drift: 0, summarizedPieces: [], removedSlots: [], nextSeq: 0 };
}

/** Changes Drift by delta (clamped 0..DRIFT_CAP). Emits one DriftChanged only if the value changed. `drift` carries the new stack count. */
export function changeDrift(ctx: ContextState, delta: number, round: number, actor: number): BattleEvent[] {
  let next = ctx.drift + delta;
  if (next > DRIFT_CAP) next = DRIFT_CAP;
  if (next < 0) next = 0;
  if (next === ctx.drift) return [];
  ctx.drift = next;
  return [{ type: 'DriftChanged', round, target: actor, drift: next }];
}

export function pushToken(ctx: ContextState, kind: Token['kind'], buff?: Token['buff']): void {
  const token: Token = buff === undefined ? { kind, seq: ctx.nextSeq } : { kind, buff: { stat: buff.stat, stages: buff.stages }, seq: ctx.nextSeq };
  ctx.nextSeq += 1;
  ctx.tokens.push(token);
}

function added(ctx: ContextState, kind: string, tokens: number, round: number, actor: number): BattleEvent {
  return { type: 'ContextAdded', round, target: actor, kind, tokens, tokensAfter: ctx.tokens.length };
}

/** Pays n cells. Cells beyond the free ones become Drift (never stored). Cost tokens carry the buff tag. */
export function pay(ctx: ContextState, n: number, round: number, actor: number, buff?: Token['buff']): BattleEvent[] {
  const events: BattleEvent[] = [];
  const free = freeCells(ctx);
  const fit = n < free ? n : free;
  for (let i = 0; i < fit; i++) pushToken(ctx, 'cost', buff);
  if (fit > 0) events.push(added(ctx, 'cost', fit, round, actor));
  const missing = n - fit;
  if (missing > 0) events.push(...changeDrift(ctx, missing, round, actor));
  return events;
}

/** Observation token only if a cell is free; otherwise nothing (no Drift). */
export function addObservation(ctx: ContextState, round: number, actor: number): BattleEvent[] {
  if (freeCells(ctx) < 1) return [];
  pushToken(ctx, 'observation');
  return [added(ctx, 'observation', 1, round, actor)];
}

/**
 * Forced Junk tokens. With no free cell, the lowest-index compactable loadout piece becomes a 1x1 Summary
 * (window grows by its cell count minus 1) and the token takes a freed cell; with none (or grid === null) +1 Drift.
 */
export function forceTokens(
  ctx: ContextState,
  n: number,
  grid: GridLayout | null,
  round: number,
  actor: number,
): { events: BattleEvent[]; compactedPieceIds: string[] } {
  const events: BattleEvent[] = [];
  const compactedPieceIds: string[] = [];
  for (let t = 0; t < n; t++) {
    if (freeCells(ctx) < 1 && grid !== null) {
      for (let i = 0; i < grid.pieces.length; i++) {
        const p = grid.pieces[i];
        if (p === undefined || !isCompactable(grid, p.id, ctx.summarizedPieces)) continue;
        ctx.summarizedPieces.push(p.id);
        if (p.kind === 'subagentSlot') ctx.removedSlots.push(p.id);
        ctx.window += cellsOf(p).length - 1;
        compactedPieceIds.push(p.id);
        events.push({ type: 'PieceCompacted', round, target: actor, pieceId: p.id });
        break;
      }
    }
    if (freeCells(ctx) >= 1) {
      pushToken(ctx, 'junk');
      events.push(added(ctx, 'junk', 1, round, actor));
    } else {
      events.push(...changeDrift(ctx, 1, round, actor));
    }
  }
  return { events, compactedPieceIds };
}

/** /clear: removes all tokens and Drift (stat stages are the battle unit's job). */
export function clearAll(ctx: ContextState, round: number, actor: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  const count = ctx.tokens.length;
  ctx.tokens = [];
  if (count > 0) events.push(added(ctx, KIND_CLEARED, -count, round, actor));
  events.push(...changeDrift(ctx, -ctx.drift, round, actor));
  return events;
}

/** Efficient Answer: removes the oldest non-Junk token, if any. */
export function freeOldestNonJunk(ctx: ContextState, round: number, actor: number): BattleEvent[] {
  for (let i = 0; i < ctx.tokens.length; i++) {
    const tok = ctx.tokens[i];
    if (tok !== undefined && tok.kind !== 'junk') {
      ctx.tokens.splice(i, 1);
      return [added(ctx, tok.kind, -1, round, actor)];
    }
  }
  return [];
}

/** Bench recovery: removes the n oldest tokens, never below 0. */
export function recover(ctx: ContextState, n: number, round: number, actor: number): BattleEvent[] {
  const count = n < ctx.tokens.length ? n : ctx.tokens.length;
  if (count <= 0) return [];
  ctx.tokens.splice(0, count);
  return [added(ctx, KIND_RECOVERED, -count, round, actor)];
}
