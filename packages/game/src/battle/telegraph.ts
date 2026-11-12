// The intent telegraphs (ruling V11, Slay the Spire style). A foe's next move is always shown by category, from the
// move's public data: ATTACK with an estimated damage "~N" (the midpoint of the engine's previewDamage range), GUARD,
// BUFF, DEBUFF or SPECIAL, plus its target. A reveal (Red Team, Saliency Map, Socratic Method; intent-visibility.ts)
// upgrades it to the exact move. "Attack" is only ever shown for a move the engine says deals damage this round. The
// player's own subagent (V14, Bootcamp Grad on) shows its exact move and the card that chose it. Pure.

import type { DamagePreview, MoveDef } from '@latentia/engine';

type NonPassiveEffect = MoveDef['effects'][number];

export type IntentCategory = 'attack' | 'guard' | 'buff' | 'debuff' | 'special';

export const CATEGORY_LABEL: Readonly<Record<IntentCategory, string>> = {
  attack: 'ATTACK',
  guard: 'GUARD',
  buff: 'BUFF',
  debuff: 'DEBUFF',
  special: 'SPECIAL',
};

/** What each category means, for the first-time hint and the details line. */
export const CATEGORY_MEANING: Readonly<Record<IntentCategory, string>> = {
  attack: 'it will hit for about that much',
  guard: 'it will protect itself',
  buff: 'it will power itself up',
  debuff: 'it will weaken its target',
  special: 'something that is not an attack',
};

const onFoes = (who: string): boolean => who === 'target' || who === 'allFoes';
const onOwnSide = (who: string): boolean => who === 'self' || who === 'allAllies';

/** Does this effect weaken whoever it lands on (the move's target or every foe)? */
function weakens(e: NonPassiveEffect): boolean {
  if (!onFoes(e.who)) return false;
  switch (e.kind) {
    case 'stage':
      return e.op === 'add' ? e.delta < 0 : true;
    case 'applyStatus':
    case 'stealStage':
      return true;
    case 'tokens':
      return e.op === 'addJunk';
    case 'nextActionModifier':
      return ['fail', 'costAdd', 'costSet', 'skip', 'incomingDamageBp'].includes(e.modifier.kind) || (e.modifier.kind === 'accuracy' && e.modifier.delta < 0);
    case 'timedField':
      return e.field.kind === 'junkPerRound' || e.field.kind === 'critStagesAgainst' || e.field.kind === 'forceTemperature';
    default:
      return false;
  }
}

/** Does this effect strengthen the user's own side? */
function strengthens(e: NonPassiveEffect): boolean {
  if (!onOwnSide(e.who) && !(e.who === 'target' && (e.kind === 'heal' || e.kind === 'cure'))) return false;
  switch (e.kind) {
    case 'stage':
      return e.op === 'add' && e.delta > 0;
    case 'heal':
    case 'cure':
      return true;
    case 'nextActionModifier':
      return ['powerBp', 'cannotMiss', 'ignoreEvasion', 'priority'].includes(e.modifier.kind) || (e.modifier.kind === 'accuracy' && e.modifier.delta > 0);
    case 'timedField':
      return e.field.kind === 'accuracyStages' && e.field.delta > 0;
    default:
      return false;
  }
}

/**
 * The category of `move` as it will run this round. `deals` is whether the engine previews damage on its target this
 * round (previewDamage non-null): a move with power that only charges this round, or aims at its user, is not an
 * attack. Then guard (a guard or a shield), debuff, buff, and everything else is special (Compact, /clear, reveals,
 * swaps, copies).
 */
export function classifyMove(move: MoveDef, deals: boolean): IntentCategory {
  if (deals && move.power !== null) return 'attack';
  const effects = move.effects;
  if (effects.some((e) => e.kind === 'guard' || (e.kind === 'shield' && onOwnSide(e.who)))) return 'guard';
  if (effects.some(weakens)) return 'debuff';
  // Compact and /clear manage the user's own context: special, not a buff.
  if (effects.some((e) => e.kind === 'tokens' && e.who === 'self' && e.op !== 'addJunk')) return 'special';
  if (effects.some(strengthens)) return 'buff';
  return 'special';
}

/** "~N": the damage range's midpoint, rounded. */
export const estimate = (p: DamagePreview): number => Math.round((p.min + p.max) / 2);

export interface Telegraph {
  readonly category: IntentCategory;
  /** The midpoint estimate for an attack, else null. */
  readonly estimate: number | null;
  /** The engine's damage range for an attack (the details toggle shows it), else null. */
  readonly range: DamagePreview | null;
  /** The move's name when revealed (or for the player's own side), else null. */
  readonly exact: string | null;
  /** "SAGELET", or null when the move aims at its user. */
  readonly target: string | null;
}

export interface TelegraphInput {
  readonly move: MoveDef;
  readonly preview: DamagePreview | null;
  readonly revealed: boolean;
  readonly selfAimed: boolean;
  readonly targetName: string;
}

export function telegraph(i: TelegraphInput): Telegraph {
  const category = classifyMove(i.move, i.preview !== null);
  const attack = category === 'attack' && i.preview !== null;
  return {
    category,
    estimate: attack && i.preview !== null ? estimate(i.preview) : null,
    range: attack ? i.preview : null,
    exact: i.revealed ? i.move.name : null,
    target: i.selfAimed ? null : i.targetName,
  };
}

/** The telegraph as one line: "ATTACK ~6 → SAGELET", "GUARD", "TOKEN BURST ~6 → SAGELET" once revealed. */
export function telegraphLine(t: Telegraph): string {
  const head = t.exact === null ? CATEGORY_LABEL[t.category] : t.exact.toUpperCase();
  const est = t.estimate === null ? '' : ` ~${t.estimate}`;
  return t.target === null ? `${head}${est}` : `${head}${est} → ${t.target}`;
}

/** The details toggle's version: the exact range ("ATTACK 5-7 → SAGELET"). */
export function telegraphDetail(t: Telegraph): string {
  if (t.range === null) return telegraphLine(t);
  const head = t.exact === null ? CATEGORY_LABEL[t.category] : t.exact.toUpperCase();
  const span = t.range.min === t.range.max ? `${t.range.min}` : `${t.range.min}-${t.range.max}`;
  return t.target === null ? `${head} ${span}` : `${head} ${span} → ${t.target}`;
}
