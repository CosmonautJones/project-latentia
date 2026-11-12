// What a move does, in plain words (ruling V14): "Hits hard. Costs 3. Never misses." instead of "PWR 70 ACC 100".
// Built from the move's public data only, so a new move gets a sentence without new copy; the numbers stay behind the
// details toggle (battle-menu moveHint). Pure.

import type { MoveDef } from '@latentia/engine';

type NonPassiveEffect = MoveDef['effects'][number];
import { statName, statusLabel } from './labels.js';

/** How hard a hit lands, by base power. */
function hitWords(power: number): string {
  if (power >= 90) return 'Hits very hard.';
  if (power >= 65) return 'Hits hard.';
  if (power >= 50) return 'Hits.';
  if (power >= 30) return 'Hits lightly.';
  return 'A light hit.';
}

function aimWords(accuracy: number | null): string | null {
  if (accuracy === null || accuracy >= 100) return 'Never misses.';
  if (accuracy >= 90) return 'Rarely misses.';
  if (accuracy >= 80) return 'Sometimes misses.';
  return 'Often misses.';
}

const whose = (who: string): string => (who === 'self' ? 'its' : who === 'allAllies' ? "your team's" : "the foe's");

function stageWords(e: Extract<NonPassiveEffect, { kind: 'stage' }>): string {
  if (e.op === 'clear') return e.who === 'self' ? 'Resets its stats.' : "Wipes the foe's stat boosts.";
  const stat = statName(e.stat);
  const much = Math.abs(e.delta) >= 2 ? ' a lot' : '';
  return `${e.delta > 0 ? 'Raises' : 'Lowers'} ${whose(e.who)} ${stat}${much}.`;
}

/** One effect in words, or null for one the hit sentence already covers. */
function effectWords(e: NonPassiveEffect): string | null {
  const chance = e.chance === undefined ? '' : `${e.chance.pct}%: `;
  switch (e.kind) {
    case 'damage':
      if (e.who === 'self') return `It takes ${e.pctOfDealt}% of the damage back.`;
      if (e.bonus?.kind === 'perCount') return 'Gets stronger each turn in a row it is used.';
      if (e.bonus?.kind === 'flat') return "Stronger while its HP % is above the foe's.";
      if (e.mult !== undefined && e.mult.length > 0) return 'Double if the foe used a non-attack last turn.';
      if (e.crit?.kind === 'never') return 'Never crits.';
      return null;
    case 'multiHit':
      return e.count.kind === 'range' ? `Hits ${e.count.min}-${e.count.max} times.` : 'Hits once, +1 per ally of its type.';
    case 'stage':
      return `${chance}${stageWords(e)}`;
    case 'heal':
      return `${e.who === 'self' ? 'Heals itself' : 'Heals an ally'} ${e.pct}% of max HP.`;
    case 'guard':
      return e.damageBp !== undefined ? 'Guards this turn: takes half damage, blocks non-attacks.' : 'Guards this turn.';
    case 'shield':
      return `Blocks the next ${e.count === 1 ? '' : `${e.count} `}${e.against === 'hit' ? 'hit' : 'status'}${e.count === 1 ? '' : 's'}.`;
    case 'applyStatus':
      return `${chance}Makes ${e.who === 'self' ? 'itself' : 'the foe'} ${statusLabel(e.status).name}.`;
    case 'cure':
      return e.statuses.includes('drift') && e.statuses.length === 1 ? (e.driftStacks === undefined ? 'Clears Drift.' : `Clears ${e.driftStacks} Drift.`) : 'Cures its statuses.';
    case 'tokens':
      if (e.op === 'compact') return 'Frees up context.';
      if (e.op === 'clear') return 'Wipes its context.';
      if (e.op === 'freeOldest') return `Frees ${e.count} context.`;
      return e.who === 'self' ? 'Leaves junk in its own context.' : `Stuffs ${e.count} junk into the foe's context.`;
    case 'nextActionModifier': {
      const m = e.modifier;
      const on = e.who === 'self' ? 'Its' : "The foe's";
      if (m.kind === 'costAdd') return `${chance}${on} next move costs ${m.cells} more.`;
      if (m.kind === 'fail') return `${chance}${on} next move fails.`;
      if (m.kind === 'skip') return 'Skips a turn.';
      if (m.kind === 'priority') return `${on} next move goes first.`;
      if (m.kind === 'cannotMiss') return `${on} next move can't miss.`;
      return `${chance}Changes ${e.who === 'self' ? 'its' : "the foe's"} next move.`;
    }
    case 'copy':
      return e.what === 'move' ? 'Copies a move.' : e.mode === 'swap' ? 'Swaps a random boost with the foe.' : "Copies the foe's best boost.";
    case 'reorder':
      return e.what === 'fieldSlot' ? 'Then swaps out, if it has a bench.' : 'Swaps turn order with the foe.';
    case 'reveal':
      return "Shows the foe's next move.";
    case 'stealStage':
      return "Steals the foe's best boost.";
    case 'charge':
      return `Takes ${e.rounds} turn${e.rounds === 1 ? '' : 's'} to charge.`;
    case 'timedField':
      return `Sets up an effect for ${e.rounds} turns.`;
    case 'snapshot':
    case 'revert':
      return 'Saves or restores a snapshot.';
  }
}

/** The move as plain sentences: what it does, then its cost (`cost`, the cells it costs now; its base cost by default), then how sure it is. */
export function moveWords(move: MoveDef, cost: number = move.cost): string[] {
  const out: string[] = [];
  if (move.power !== null && !move.effects.some((e) => e.kind === 'multiHit')) out.push(hitWords(move.power));
  if (move.power !== null && move.effects.some((e) => e.kind === 'multiHit')) out.push('Light hits.');
  for (const e of move.effects) {
    const w = effectWords(e);
    if (w !== null && !out.includes(w)) out.push(w);
  }
  if (move.priority > 0) out.push('Goes first.');
  if (move.priority < 0) out.push('Goes last.');
  out.push(cost === 0 ? 'Free.' : `Costs ${cost}.`);
  if (move.power !== null) {
    const aim = aimWords(move.accuracy);
    if (aim !== null) out.push(aim);
  }
  return out;
}

export const moveSentence = (move: MoveDef, cost: number = move.cost): string => moveWords(move, cost).join(' ');
