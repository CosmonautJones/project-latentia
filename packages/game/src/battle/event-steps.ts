// The pure event → UI-step mapper: each engine BattleEvent becomes the ordered steps the Battle scene plays (text,
// windup, hit-stop and flash, HP drain, status icons, faint, swap, context and Drift). EVENT_HANDLERS is keyed by
// every BattleEventType, so the compiler rejects a missing type, and every handler returns at least one step: no
// event is ever dropped silently (plan "Review Focus").

import type { BattleEvent, BattleEventType, CardTrace } from '@latentia/engine';
import { fieldName, guardName, statName, statusLabel } from './labels.js';

export type UiStep =
  /** A line for the message box. Major lines (moves, faints, results) get more reading time than minor ones. */
  | { readonly kind: 'text'; readonly text: string; readonly weight: 'major' | 'minor' }
  /** The attacker's anticipation lunge. */
  | { readonly kind: 'windup'; readonly actor: number }
  /** Impact: a 2–4 frame hit-stop and a white flash on the target. */
  | { readonly kind: 'hit'; readonly target: number }
  /** Drain (or fill) the target's HP bar to `hp`. */
  | { readonly kind: 'hp'; readonly target: number; readonly hp: number }
  | { readonly kind: 'status'; readonly target: number; readonly status: string; readonly on: boolean }
  | { readonly kind: 'drift'; readonly target: number; readonly drift: number }
  /** Set the target's context bar to `used` tokens. */
  | { readonly kind: 'context'; readonly target: number; readonly used: number }
  | { readonly kind: 'faint'; readonly target: number }
  | { readonly kind: 'swap'; readonly side: number; readonly out: number; readonly in: number }
  /** A deck card fired: the scene keeps it for the "why?" popup. */
  | { readonly kind: 'trace'; readonly trace: CardTrace }
  /** The intents the engine actually planned this round (refreshes the preview). */
  | { readonly kind: 'intents'; readonly intents: Extract<BattleEvent, { type: 'IntentsPlanned' }>['intents'] }
  /** Highlight the creature whose action starts. */
  | { readonly kind: 'actor'; readonly actor: number }
  | { readonly kind: 'round'; readonly round: number; readonly phase: 'start' | 'end' }
  | { readonly kind: 'end'; readonly winner: number | null }
  /** Nothing to show: a deliberate no-op (a neutral type effect, a one-hit "chain"). */
  | { readonly kind: 'beat' };

export interface MapContext {
  /** "Sagelet", "Kip's Blitzr". */
  name(index: number): string;
  moveName(moveId: string): string;
}

type Handlers = { readonly [K in BattleEventType]: (e: Extract<BattleEvent, { type: K }>, c: MapContext) => UiStep[] };

const major = (text: string): UiStep => ({ kind: 'text', text, weight: 'major' });
const minor = (text: string): UiStep => ({ kind: 'text', text, weight: 'minor' });

const SKIP_TEXT: Readonly<Record<Extract<BattleEvent, { type: 'ActionSkipped' }>['reason'], string>> = {
  rateLimited: '429: Too Many Requests. {n} loses its turn.',
  cleared: '{n} is rebooting after /clear.',
  headless: '{n} has no orchestrator to obey.',
  fainted: '{n} is offline and cannot act.',
  leftField: '{n} left the field before it could act.',
  charging: '{n} is still thinking...',
};

const sideName = (side: number): string => (side === 0 ? 'Your team' : 'The other side');

export const EVENT_HANDLERS: Handlers = {
  RoundStart: (e) => [{ kind: 'round', round: e.round, phase: 'start' }],
  IntentsPlanned: (e) => [{ kind: 'intents', intents: e.intents }],
  ActionStarted: (e) => [{ kind: 'actor', actor: e.actor }],
  CardTrace: (e) => [{ kind: 'trace', trace: e }],
  MoveUsed: (e, c) => [major(`${c.name(e.actor)} used ${c.moveName(e.moveId)}!`), { kind: 'windup', actor: e.actor }],
  Missed: (e, c) => [minor(e.actor === e.target ? `${c.name(e.actor)}'s guard failed!` : `${c.name(e.actor)} missed!`)],
  Damage: (e) => [
    { kind: 'hit', target: e.target },
    { kind: 'hp', target: e.target, hp: e.hpAfter },
  ],
  Crit: () => [minor('A critical hit!')],
  TypeEffect: (e) =>
    e.multiplierBp > 10000 ? [minor('On-distribution! It hits hard.')] : e.multiplierBp < 10000 ? [minor('Out of distribution... it barely lands.')] : [{ kind: 'beat' }],
  StatusApplied: (e, c) => [{ kind: 'status', target: e.target, status: e.status, on: true }, minor(`${c.name(e.target)} is ${statusLabel(e.status).name}!`)],
  StatusBlocked: (e, c) => [minor(`${c.name(e.target)} shrugged off ${statusLabel(e.status).name}.`)],
  StatusExpired: (e, c) => [{ kind: 'status', target: e.target, status: e.status, on: false }, minor(`${c.name(e.target)} is no longer ${statusLabel(e.status).name}.`)],
  StatusCured: (e, c) => [{ kind: 'status', target: e.target, status: e.status, on: false }, minor(`${c.name(e.target)} was cured of ${statusLabel(e.status).name}.`)],
  StageChanged: (e, c) => {
    const how = e.delta >= 2 ? 'rose sharply' : e.delta > 0 ? 'rose' : e.delta <= -2 ? 'fell sharply' : e.delta < 0 ? 'fell' : 'held steady';
    return [minor(`${c.name(e.target)}'s ${statName(e.stat)} ${how}!`)];
  },
  StageStolen: (e, c) => [minor(`${c.name(e.actor)} took ${c.name(e.target)}'s ${statName(e.stat)} boost!`)],
  Healed: (e, c) => [
    { kind: 'hp', target: e.target, hp: e.hpAfter },
    minor(`${c.name(e.target)} recovered ${e.amount} HP.`),
  ],
  ActionSkipped: (e, c) => [minor(SKIP_TEXT[e.reason].replace('{n}', c.name(e.actor)))],
  GuardResolved: (e, c) => [minor(e.blocked ? `${c.name(e.target)}'s ${guardName(e.kind)} blocked it!` : `${c.name(e.target)}'s ${guardName(e.kind)} softened the hit.`)],
  ShieldAbsorbed: (e, c) => [minor(`${c.name(e.target)}'s shield took the hit.`)],
  FieldEffectStarted: (e, c) => [minor(`${fieldName(e.effect)} is on ${c.name(e.target)} for ${e.rounds} rounds.`)],
  FieldEffectEnded: (e, c) => [minor(`${fieldName(e.effect)} wore off ${c.name(e.target)}.`)],
  Revealed: (e, c) =>
    e.what === 'telegraph'
      ? [minor(`${c.name(e.actor)} is winding up something big...`)]
      : [minor(`${c.name(e.actor)} can see ${c.name(e.target)}'s ${e.what === 'nextIntent' ? 'next move' : 'top card'}.`)],
  ContextAdded: (e) => [{ kind: 'context', target: e.target, used: e.tokensAfter }],
  DriftChanged: (e, c) => [
    { kind: 'drift', target: e.target, drift: e.drift },
    minor(e.drift > 0 ? `${c.name(e.target)} overflowed: Drift ${e.drift}.` : `${c.name(e.target)} is back on track.`),
  ],
  Compacted: (e, c) => [{ kind: 'context', target: e.target, used: e.tokensAfter }, minor(`${c.name(e.target)} compacted its context.`)],
  PieceCompacted: (e, c) => [minor(`${c.name(e.target)} summarised a grid piece to make room.`)],
  ObservationGained: (e, c) => [minor(`${c.name(e.target)} took notes on ${c.moveName(e.observation)}.`)],
  HandoffChain: (e) => (e.chain.length >= 2 ? [minor(`Handoff chain x${e.chain.length}!`)] : [{ kind: 'beat' }]),
  Swapped: (e, c) => [{ kind: 'swap', side: e.side, out: e.outIndex, in: e.inIndex }, minor(`${c.name(e.inIndex)} swapped in.`)],
  Fainted: (e, c) => [{ kind: 'faint', target: e.target }, major(`${c.name(e.target)} went offline!`)],
  HeadlessMode: (e) => [major(e.active ? `${sideName(e.side)} is headless! The subagents fight on.` : `${sideName(e.side)} has an orchestrator again.`)],
  BrittleRepeat: (e, c) => [minor(`${c.name(e.actor)} repeats ${c.moveName(e.moveId)} out of habit.`)],
  RoundEnd: (e) => [{ kind: 'round', round: e.round, phase: 'end' }],
  BattleEnd: (e) => [{ kind: 'end', winner: e.winner }],
};

export function mapEvent(e: BattleEvent, c: MapContext): UiStep[] {
  // The cast is safe: `e.type` picks the handler for exactly e's member of the union.
  const handler = EVENT_HANDLERS[e.type] as (e: BattleEvent, c: MapContext) => UiStep[];
  return handler(e, c);
}

export const mapEvents = (events: readonly BattleEvent[], c: MapContext): UiStep[] => events.flatMap((e) => mapEvent(e, c));
