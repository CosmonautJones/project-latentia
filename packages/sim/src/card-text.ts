import type { Card, Condition, Deck } from '@latentia/engine';
import type { Table } from './report.js';

// Cards as text for reports and mutation labels: `IF <subject> <condition> THEN <move> → <target>`.

const pctText = (t: { op: 'below' | 'atLeast'; pct: number }): string => `${t.op === 'below' ? '<' : '≥'} ${t.pct}%`;

/** A condition as a phrase after its subject. */
export function conditionText(c: Condition): string {
  switch (c.category) {
    case 'hp':
      return `hp ${pctText(c)}`;
    case 'status':
      return `has ${c.status}`;
    case 'foeType':
      return c.is === 'weakToMove' ? 'is weak to the move' : `is ${c.is} type`;
    case 'foeLastMove':
      return `last used ${c.move}`;
    case 'turn':
      return `round ${c.op === 'below' ? '<' : '≥'} ${c.round}`;
    case 'cooldown':
      return `has not used the move for ${c.rounds} round${c.rounds === 1 ? '' : 's'}`;
    case 'allyHp':
      return `has an ally at hp ${pctText(c)}`;
    case 'field':
      return `holds field ${c.effect}`;
    case 'foeBuffed':
      return 'is buffed';
    case 'contextFill':
      return `context ${pctText(c)} full`;
    case 'telegraphing':
      return 'is telegraphing';
    case 'coin':
      return 'coin flip';
  }
}

/** A card as `IF <subject> <condition> THEN <move> → <target>`, with its overflow and injection choices. */
export function cardText(c: Card): string {
  const extra = [...(c.allowOverflow === true ? ['allowOverflow'] : []), ...(c.injection === undefined ? [] : [`injection ${c.injection.moveId} → ${c.injection.target}`])];
  return `IF ${c.subject} ${conditionText(c.condition)} THEN ${c.move} → ${c.target}${extra.length === 0 ? '' : ` (${extra.join('; ')})`}`;
}

/** A deck as a table read top to bottom: its cards by priority, then Default (which fires when no card does; its condition is not read). */
export function deckTable(d: Deck): Table {
  const def = d.default;
  return { columns: ['priority', 'id', 'card'], rows: [...d.cards.map((c, i) => [i + 1, c.id, cardText(c)]), ['default', def.id, `OTHERWISE ${def.move} → ${def.target}`]] };
}
