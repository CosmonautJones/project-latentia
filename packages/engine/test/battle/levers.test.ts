import { describe, expect, it } from 'vitest';
import type { OrchestratorAction, RoundCommand } from '../../src/battle/log.js';
import type { ActionEntry } from '../../src/battle/order.js';
import { getIntents } from '../../src/battle/plan.js';
import { resolveEntry, submitRound } from '../../src/battle/round.js';
import type { BattleState } from '../../src/battle/state.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import { pay } from '../../src/context/store.js';
import type { BattleEvent } from '../../src/events/types.js';
import { lo } from '../../src/rng/draws.js';
import { ofType, run } from './effects/kit.js';
import { at, battle, entry, mon, rngWhere } from './helpers.js';

// Task B3 (spec §5 "Orchestrator levers"; Rulings 74, 90): Directive and Policy Update take effect when the
// orchestrator's entry resolves; Headless Mode. Specialist and card injection: specialist-injection.test.ts.

const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 };
const F: Condition = { category: 'hp', op: 'below', pct: 25 };
const card = (id: string, move: string, over: Partial<Card> = {}): Card => ({ id, subject: 'self', condition: T, move, target: 'lowestHpFoe', ...over });
const POLICY = card('pol', 'long-term-recall');

/**
 * 0 a-orch Blitzr L20 (Latency 37: always first), 1 a-act1 Cobolt L20 (Latency 21; knows long-term-recall),
 * 2 a-act2 Nullbeetle L20 (Latency 23; does not), 3 b-orch Sagelet, 4 b-act1 Blitzr, 5 b-act2 Forkling (all L5).
 * No bench; everyone at 5000 HP so nothing faints.
 */
function levers(deck1: Deck = { cards: [], default: card('def', 'batch-job') }, deck2: Deck | null = { cards: [], default: card('nd', 'null-chomp') }): BattleState {
  const s = battle(
    {
      orchestrator: mon('a-orch', 'blitzr', 20),
      // Generalization 90 (Robust): decks always obey, so traces are predictable.
      active: [{ ...mon('a-act1', 'cobolt', 20), deck: deck1, generalization: 90 }, deck2 === null ? mon('a-act2', 'nullbeetle', 20) : { ...mon('a-act2', 'nullbeetle', 20), deck: deck2, generalization: 90 }],
      bench: [],
    },
    { bench: [] },
  );
  for (const c of s.creatures) c.hp = c.maxHp = 5000;
  return s;
}

const directive = (subagent: number, moveId: string, target: number): RoundCommand => ({ a: { temperature: 2, action: { kind: 'directive', subagent, moveId, target } } });
const policy = (c: Card = POLICY): RoundCommand => ({ a: { temperature: 2, action: { kind: 'policyUpdate', card: c } } });
const NONE: RoundCommand = { a: { temperature: 2, action: { kind: 'none' } } };

function ok(state: BattleState, cmd: RoundCommand): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(state, cmd);
  if ('error' in r) throw new Error(`unexpected ${r.error.code}: ${r.error.message}`);
  return r;
}

function code(state: BattleState, cmd: RoundCommand): string | null {
  const r = submitRound(state, cmd);
  return 'error' in r ? r.error.code : null;
}

/** The events of one actor's entry: its ActionStarted up to (not including) the next ActionStarted or RoundEnd. */
function entryEvents(events: readonly BattleEvent[], actor: number): BattleEvent[] {
  const start = events.findIndex((e) => e.type === 'ActionStarted' && e.actor === actor);
  if (start < 0) return [];
  const rest = events.slice(start + 1);
  const end = rest.findIndex((e) => e.type === 'ActionStarted' || e.type === 'RoundEnd');
  return [events[start] as BattleEvent, ...(end < 0 ? rest : rest.slice(0, end))];
}

const intentOf = (events: readonly BattleEvent[], actor: number) => ofType([...events], 'IntentsPlanned')[0]?.intents.find((i) => i.actor === actor);
const traceOf = (events: readonly BattleEvent[], actor: number) => ofType([...events], 'CardTrace').find((e) => e.actor === actor);

describe('Directive (Ruling 74: takes effect when the orchestrator entry resolves)', () => {
  it('costs the orchestrator 2 cells and replaces a subagent action that has not happened yet; the intent shows the deck', () => {
    const { state, events } = ok(levers(), directive(1, 'long-term-recall', 4));
    const orch = entryEvents(events, 0);
    // Ruling 90: the lever is announced (MoveUsed 'directive' at the directed subagent), then paid.
    expect(orch.slice(1)).toEqual([
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'directive', target: 1 },
      { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 2, tokensAfter: 2 },
    ]);
    expect(intentOf(events, 1)).toEqual({ actor: 1, moveId: 'batch-job', target: expect.any(Number), cardId: 'def' });
    const sub = entryEvents(events, 1);
    expect(sub.find((e) => e.type === 'MoveUsed')).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'long-term-recall', target: 4 });
    expect(traceOf(events, 1)).toBeUndefined(); // a directed action is not deck-driven
    expect(state.sides.a.directive).toBeNull();
    // The other subagent acts from its deck as usual.
    expect(traceOf(events, 2)?.firedCardId).toBe('nd');
  });

  it('is spent with no effect when the subagent already acted this round (cells still paid, nothing else emitted)', () => {
    const s = levers();
    at(s, 1).stats.latency = 100; // a-act1 now acts before its orchestrator
    const { state, events } = ok(s, directive(1, 'long-term-recall', 4));
    expect(events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 1)).toBeLessThan(events.findIndex((e) => e.type === 'ActionStarted' && e.actor === 0));
    // A spent Directive is still visible as issued (Ruling 90).
    expect(entryEvents(events, 0).slice(1)).toEqual([
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'directive', target: 1 },
      { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 2, tokensAfter: 2 },
    ]);
    expect(ofType(events, 'MoveUsed').filter((e) => e.actor === 1).map((e) => e.moveId)).toEqual(['batch-job']);
    expect(traceOf(events, 1)?.firedCardId).toBe('def');
    expect(state.sides.a.directive).toBeNull();
  });

  it('directs a subagent without a deck too; overflow becomes Drift', () => {
    const s = levers(undefined, null);
    pay(at(s, 0).context, 11, 0, 0); // one free cell left
    const { state, events } = ok(s, directive(2, 'segfault', 5));
    expect(entryEvents(events, 0).slice(1)).toEqual([
      { round: 1, type: 'MoveUsed', actor: 0, moveId: 'directive', target: 2 },
      { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 1, tokensAfter: 12 },
      { round: 1, type: 'DriftChanged', target: 0, drift: 1 },
    ]);
    expect(entryEvents(events, 2).find((e) => e.type === 'MoveUsed')).toMatchObject({ actor: 2, moveId: 'segfault', target: 5 });
    expect(at(state, 0).context.drift).toBe(1);
  });

  it('falls back to the subagent own action when a status forbids the directed move by the time it acts', () => {
    const s = levers();
    s.round = 1;
    s.turnOrder = [1];
    const events: BattleEvent[] = [];
    resolveEntry(s, { ...entry(0, 'directive', 1), lever: { kind: 'directive', subagent: 1, moveId: 'long-term-recall', target: 4 } }, events);
    expect(s.sides.a.directive).toEqual({ subagent: 1, moveId: 'long-term-recall', target: 4, round: 1 });
    at(s, 1).statuses.push({ id: 'overfit', remaining: 3 });
    at(s, 1).lastMoveId = 'batch-job';
    const sub: ActionEntry = { ...entry(1, 'batch-job', 4), cardId: 'def', skipped: [] };
    resolveEntry(s, sub, events);
    expect(ofType(events, 'MoveUsed').at(-1)).toMatchObject({ actor: 1, moveId: 'batch-job' });
    expect(s.sides.a.directive).toBeNull();
  });

  it('a Rate Limited skip of the orchestrator entry applies to it: no cells, no Directive', () => {
    const s = levers();
    s.round = 1;
    s.turnOrder = [1];
    s.rng = rngWhere((d) => lo(d.d2, 100) < 25);
    at(s, 0).statuses.push({ id: 'rateLimited', remaining: 3 });
    const events: BattleEvent[] = [];
    resolveEntry(s, { ...entry(0, 'directive', 1), lever: { kind: 'directive', subagent: 1, moveId: 'long-term-recall', target: 4 } }, events);
    expect(events.slice(1)).toEqual([{ round: 1, type: 'ActionSkipped', actor: 0, reason: 'rateLimited' }]);
    expect(at(s, 0).context.tokens).toHaveLength(0);
    expect(s.sides.a.directive).toBeNull();
  });

  it('a Prompt Injected orchestrator is hijacked instead: no Directive', () => {
    const s = levers();
    s.round = 1;
    s.turnOrder = [1];
    s.rng = rngWhere((d) => lo(d.d2, 100) >= 25);
    at(s, 0).statuses.push({ id: 'promptInjected', remaining: 1, injected: { moveId: 'ship-it', target: 4 } });
    const events: BattleEvent[] = [];
    resolveEntry(s, { ...entry(0, 'directive', 1), lever: { kind: 'directive', subagent: 1, moveId: 'long-term-recall', target: 4 } }, events);
    expect(ofType(events, 'MoveUsed')).toEqual([{ round: 1, type: 'MoveUsed', actor: 0, moveId: 'ship-it', target: 4 }]);
    expect(s.sides.a.directive).toBeNull();
  });

  it('a Directive that lands on a Prompt Injected subagent is used up, and the hijack wins', () => {
    const s = levers();
    s.round = 1;
    s.turnOrder = [1];
    const events: BattleEvent[] = [];
    resolveEntry(s, { ...entry(0, 'directive', 1), lever: { kind: 'directive', subagent: 1, moveId: 'long-term-recall', target: 4 } }, events);
    expect(s.sides.a.directive).not.toBeNull();
    at(s, 1).statuses.push({ id: 'promptInjected', remaining: 1, injected: { moveId: 'batch-job', target: 2 } });
    resolveEntry(s, { ...entry(1, 'batch-job', 4), cardId: 'def', skipped: [] }, events);
    expect(ofType(events, 'MoveUsed').at(-1)).toEqual({ round: 1, type: 'MoveUsed', actor: 1, moveId: 'batch-job', target: 2 });
    expect(ofType(events, 'StatusExpired')).toContainEqual(expect.objectContaining({ target: 1, status: 'promptInjected' }));
    expect(traceOf(events, 1)).toBeUndefined();
    expect(s.sides.a.directive).toBeNull();
  });

  it('validation: a move a held status forbids the subagent is moveDisabled; a charging subagent is actorSkipped', () => {
    const s = levers();
    at(s, 1).statuses.push({ id: 'overfit', remaining: 3 });
    at(s, 1).lastMoveId = 'batch-job';
    expect(code(s, directive(1, 'long-term-recall', 4))).toBe('moveDisabled');
    expect(code(s, directive(1, 'batch-job', 4))).toBeNull();
    const c = levers();
    at(c, 1).charging = { moveId: 'batch-job', target: 4, remaining: 1, powerDelta: 0, hitPower: 0 };
    expect(code(c, directive(1, 'long-term-recall', 4))).toBe('actorSkipped');
  });
});

describe('Policy Update', () => {
  it('costs 2 cells and fires above the decks for exactly rounds r, r+1, r+2', () => {
    let s = levers();
    const fired: (string | undefined)[] = [];
    const planned: (string | null | undefined)[] = [];
    const other: unknown[] = [];
    const previews: (string | null | undefined)[] = [];
    for (let r = 1; r <= 4; r++) {
      const { state, events } = ok(s, r === 1 ? policy() : NONE);
      if (r === 1) {
        expect(entryEvents(events, 0).slice(1)).toEqual([
          { round: 1, type: 'MoveUsed', actor: 0, moveId: 'policy-update', target: 0 },
          { round: 1, type: 'ContextAdded', target: 0, kind: 'cost', tokens: 2, tokensAfter: 2 },
        ]);
      }
      fired.push(traceOf(events, 1)?.firedCardId);
      planned.push(intentOf(events, 1)?.cardId);
      other.push(traceOf(events, 2)?.skipped);
      previews.push(getIntents(state).find((i) => i.actor === 1)?.cardId);
      s = state;
    }
    // Round 1: planned before the policy existed, then re-evaluated from the top when a-act1 acts.
    expect(planned).toEqual(['def', 'pol', 'pol', 'def']);
    expect(fired).toEqual(['pol', 'pol', 'pol', 'def']);
    expect(previews).toEqual(['pol', 'pol', 'def', 'def']);
    // a-act2 does not know the policy's move: traced moveDisabled, under its own id, then its Default fires.
    expect(other).toEqual([[{ cardId: 'pol', reason: 'moveDisabled' }], [{ cardId: 'pol', reason: 'moveDisabled' }], [{ cardId: 'pol', reason: 'moveDisabled' }], []]);
    expect(s.sides.a.policies).toEqual([]);
  });

  it('uses no card slot: the deck keeps all its active cards below it', () => {
    const deck: Deck = { cards: [card('x1', 'batch-job', { condition: F }), card('x2', 'batch-job', { condition: F }), card('x3', 'long-term-recall'), card('x4', 'batch-job')], default: card('def', 'batch-job') };
    const s = ok(levers(deck), policy(card('pol', 'refactor', { condition: F }))).state;
    const { events } = ok(s, NONE);
    expect(traceOf(events, 1)).toMatchObject({
      firedCardId: 'x3',
      skipped: [
        { cardId: 'pol', reason: 'conditionFalse' },
        { cardId: 'x1', reason: 'conditionFalse' },
        { cardId: 'x2', reason: 'conditionFalse' },
      ],
    });
  });

  it('a newer policy goes above an older one; re-issuing an id replaces it', () => {
    let s = ok(levers(), policy(card('p1', 'batch-job'))).state;
    s = ok(s, policy(card('p2', 'long-term-recall'))).state;
    expect(s.sides.a.policies.map((p) => [p.card.id, p.fromRound, p.lastRound])).toEqual([['p2', 2, 4], ['p1', 1, 3]]);
    s = ok(s, policy(card('p1', 'batch-job'))).state;
    expect(s.sides.a.policies.map((p) => [p.card.id, p.fromRound, p.lastRound])).toEqual([['p1', 3, 5], ['p2', 2, 4]]);
  });

  it('subagents without a deck are unaffected', () => {
    const { events } = ok(ok(levers(undefined, null), policy()).state, NONE);
    expect(traceOf(events, 2)).toBeUndefined();
    expect(intentOf(events, 2)?.cardId).toBeNull();
  });

  it('validation: a malformed card or a card the deck rules reject is invalidCommand, as is an id an allied deck uses', () => {
    const s = levers();
    const bad = (c: unknown): RoundCommand => ({ a: { temperature: 2, action: { kind: 'policyUpdate', card: c } as OrchestratorAction } });
    expect(code(s, bad({ id: 'x' }))).toBe('invalidCommand');
    expect(code(s, bad({ ...POLICY, target: 'nobody' }))).toBe('invalidCommand');
    expect(code(s, policy(card('x', 'no-such-move')))).toBe('invalidCommand');
    expect(code(s, policy(card('x', 'batch-job', { subject: 'foe', condition: { category: 'coin' } })))).toBe('invalidCommand');
    expect(code(s, policy(card('x', 'batch-job', { condition: { category: 'turn', op: 'below', round: 0 } })))).toBe('invalidCommand');
    expect(code(s, policy(card('def', 'batch-job')))).toBe('invalidCommand');
    expect(code(s, policy(card('nd', 'batch-job')))).toBe('invalidCommand');
    expect(code(s, policy())).toBeNull();
  });
});

describe('Headless Mode (spec §5; Ruling 36)', () => {
  it('orchestrator KO -> HeadlessMode; later commands are ignored; subagents act from their decks; the bench auto-fills', () => {
    const s = battle({ active: [{ ...mon('a-act1', 'blitzr'), deck: { cards: [], default: card('def', 'ship-it') } }, mon('a-act2', 'forkling')] });
    for (const c of s.creatures) c.hp = c.maxHp = 500;
    at(s, 0).hp = 1;
    const ko = run(s, 7, 'ship-it', 0);
    expect(ko).toContainEqual({ round: 0, type: 'HeadlessMode', side: 0, active: true });
    expect(s.sides.a.headless).toBe(true);
    at(s, 2).hp = 0;
    at(s, 2).fainted = true;
    const before = s.sides.a.temperature;
    // Not even validated (an illegal Directive and an unknown policy move are accepted) and never executed.
    for (const cmd of [directive(1, 'no-such-move', 99), policy(card('def', 'no-such-move'))] as RoundCommand[]) {
      const { state, events } = ok(s, { a: { ...(cmd.a as NonNullable<RoundCommand['a']>), temperature: 4 } });
      expect(entryEvents(events, 0).slice(0, 2)).toEqual([expect.objectContaining({ type: 'ActionStarted', actor: 0 }), { round: 1, type: 'ActionSkipped', actor: 0, reason: 'headless' }]);
      expect(ofType(events, 'ContextAdded').filter((e) => e.target === 0)).toEqual([]);
      expect(state.sides.a.temperature).toBe(before);
      expect(state.sides.a.policies).toEqual([]);
      expect(traceOf(events, 1)?.firedCardId).toBe('def');
      expect(ofType(events, 'MoveUsed').some((e) => e.actor === 1)).toBe(true);
      expect(ofType(events, 'Swapped')).toEqual([{ round: 1, type: 'Swapped', side: 0, outIndex: 2, inIndex: 3 }]);
    }
  });
});
