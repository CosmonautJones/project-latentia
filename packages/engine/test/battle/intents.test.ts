import { describe, expect, it } from 'vitest';
import type { CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import { createBattle } from '../../src/battle/setup.js';
import { defaultIntent, type ActionEntry } from '../../src/battle/order.js';
import { getIntents } from '../../src/battle/intents.js';
import { activeCards } from '../../src/battle/levers.js';
import { deckAction, planEntries } from '../../src/battle/plan.js';
import { resolveEntry, submitRound } from '../../src/battle/round.js';
import type { BattleState } from '../../src/battle/state.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import type { BattleEvent } from '../../src/events/types.js';
import type { GridLayout } from '../../src/grid/model.js';
import { lo } from '../../src/rng/draws.js';
import * as api from '../../src/index.js';
import { at, battle, faint, gridlessSetup, mon, rngWhere, SEED, withoutPassives, word } from './helpers.js';

// Canonical indices (helpers.battle): 0 a-orch sagelet, 1 a-act1 blitzr, 2 a-act2 forkling, 3-5 a bench,
// 6 b-orch sagelet, 7 b-act1 blitzr, 8 b-act2 forkling, 9-11 b bench. At L5: b-orch 12 Compute (highest),
// b-act1 20 HP (lowest), b-act2 21 HP.

const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 };
const F: Condition = { category: 'hp', op: 'below', pct: 25 };
const c = (id: string, condition: Condition, move: string, target: Card['target'] = 'lowestHpFoe', over: Partial<Card> = {}): Card => ({ id, subject: 'self', condition, move, target, ...over });
const DEF: Card = c('def', T, 'compact', 'self');

/** a-act1 (Blitzr) with `deck` and generalization `g`; a-act2 (Forkling) without a deck. */
const decked = (deck: Deck, g: number | null = 90, over: Partial<CreatureSetup> = {}): BattleState =>
  battle({ active: [{ ...mon('a-act1', 'blitzr'), deck, ...(g === null ? {} : { generalization: g }), ...over }, mon('a-act2', 'forkling')] });

const ofType = <K extends BattleEvent['type']>(events: readonly BattleEvent[], type: K): Extract<BattleEvent, { type: K }>[] =>
  events.filter((e): e is Extract<BattleEvent, { type: K }> => e.type === type);

function round(state: BattleState): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(state, {});
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

describe('getIntents (Ruling 79/82)', () => {
  const RAND: Deck = { cards: [c('finish', { category: 'hp', op: 'below', pct: 25 }, 'distilled-strike', 'lowestHpFoe', { subject: 'foe' }), c('rand', T, 'ship-it', 'randomFoe')], default: c('def', T, 'token-burst') };

  it('is exported, previews the next round from a cloned rng and leaves the state untouched', () => {
    expect(api.getIntents).toBe(getIntents);
    const s = decked(RAND);
    const before = structuredClone(s);
    const intents = getIntents(s);
    expect(s).toEqual(before);
    const next = round(s).state;
    const r2 = at(next, 1).roundStart?.r2 ?? -1;
    expect(intents).toEqual([
      { actor: 1, moveId: 'ship-it', target: [6, 7, 8][lo(r2, 3)], cardId: 'rand' },
      { actor: 2, ...defaultIntent(s, 2), cardId: null },
      { actor: 7, ...defaultIntent(s, 7), cardId: null },
      { actor: 8, ...defaultIntent(s, 8), cardId: null },
    ]);
  });

  it('equals the IntentsPlanned of the round submitRound plays, and what fires when nothing changes', () => {
    let s = decked(RAND);
    for (let r = 1; r <= 6 && !s.ended; r++) {
      const intents = getIntents(s);
      const played = round(s);
      expect(ofType(played.events, 'IntentsPlanned')).toEqual([{ round: r, type: 'IntentsPlanned', intents: intents.map(({ actor, moveId, target, cardId }) => ({ actor, moveId, target, cardId })) }]);
      if (r === 1) {
        const mine = intents[0];
        expect(ofType(played.events, 'CardTrace')).toEqual([{ round: 1, type: 'CardTrace', actor: 1, firedCardId: 'rand', skipped: [{ cardId: 'finish', reason: 'conditionFalse' }] }]);
        expect(ofType(played.events, 'MoveUsed').find((e) => e.actor === 1)).toMatchObject({ moveId: mine?.moveId, target: mine?.target });
      }
      s = played.state;
    }
  });

  it('IntentsPlanned comes right after RoundStart, one intent per subagent with an entry (orchestrators act on commands)', () => {
    const s = decked(RAND);
    faint(at(s, 8));
    const { events } = round(s);
    expect(events.slice(0, 2).map((e) => e.type)).toEqual(['RoundStart', 'IntentsPlanned']);
    expect(ofType(events, 'IntentsPlanned')[0]?.intents.map((i) => i.actor)).toEqual([1, 2, 7]);
  });

  it('is empty once the battle has ended', () => {
    const s = decked(RAND);
    s.ended = true;
    expect(getIntents(s)).toEqual([]);
  });
});

describe('planning from decks', () => {
  it('creatures without a deck keep the default intent and emit no CardTrace', () => {
    const s = battle();
    s.round = 1;
    for (const e of planEntries(s, {}).filter((x) => !at(s, x.actor).isOrchestrator)) {
      expect(e).toMatchObject(defaultIntent(s, e.actor));
      expect(e.cardId).toBeUndefined();
    }
    expect(ofType(round(battle()).events, 'CardTrace')).toEqual([]);
  });

  it('active cards: versionSlots 3 / 5 / 7 / 8 on a gridless side', () => {
    for (const [version, n] of [['v1', 3], ['v2', 5], ['v3.5', 7], ['v4', 8]] as const) {
      const s = decked({ cards: [], default: DEF }, 90, { version });
      expect(activeCards(s, at(s, 1))).toBe(n);
    }
  });

  it('active cards on a gridded side: Example Cards adjacent to the subagent’s bound slot, capped by its version', () => {
    const SLOT: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const grid: GridLayout = {
      width: 4,
      height: 4,
      pieces: [
        { id: 'sp', kind: 'systemPrompt', shape: [[0, 0], [1, 0], [2, 0]], anchor: [0, 0], rotation: 0 },
        { id: 'slot', kind: 'subagentSlot', shape: SLOT, anchor: [0, 1], rotation: 0, subagentId: 'a-act1' },
        { id: 'ex1', kind: 'exampleCard', shape: [[0, 0]], anchor: [2, 1], rotation: 0 },
        { id: 'ex2', kind: 'exampleCard', shape: [[0, 0]], anchor: [2, 2], rotation: 0 },
      ],
    };
    const deck: Deck = { cards: [c('a', F, 'ship-it'), c('b', F, 'ship-it'), c('e', T, 'token-burst')], default: DEF };
    const side: Partial<SideSetup> = { orchestrator: { ...mon('a-orch', 'sagelet', 1), moves: [] }, grid, active: [{ ...mon('a-act1', 'blitzr'), deck, generalization: 90 }], bench: [] };
    const s = withoutPassives(createBattle(gridlessSetup(side), SEED));
    expect(activeCards(s, at(s, 1))).toBe(2);
    s.round = 1;
    const entry = planEntries(s, {}).find((e) => e.actor === 1);
    if (entry === undefined) throw new Error('no entry');
    const events: BattleEvent[] = [];
    resolveEntry(s, entry, events);
    expect(ofType(events, 'CardTrace')[0]).toMatchObject({
      firedCardId: 'def',
      skipped: [
        { cardId: 'a', reason: 'conditionFalse' },
        { cardId: 'b', reason: 'conditionFalse' },
        { cardId: 'e', reason: 'notActive' },
      ],
    });
  });

  it('plan-time usability matches resolution: free cells after pending cost modifiers (Ruling 84)', () => {
    const fork: Deck = { cards: [c('fork', T, 'hard-fork')], default: DEF };
    const s = battle({ active: [mon('a-act1', 'blitzr'), { ...mon('a-act2', 'forkling'), deck: fork }] });
    s.round = 1;
    const ctx = at(s, 2).context;
    for (let i = 0; i < ctx.window - 1; i++) ctx.tokens.push({ kind: 'junk', seq: i }); // 1 cell free; hard-fork costs 2
    expect(planEntries(s, {}).find((e) => e.actor === 2)).toMatchObject({ cardId: 'def', moveId: 'compact' });
    at(s, 2).nextActionMods.push({ kind: 'costSet', cells: 1 });
    expect(planEntries(s, {}).find((e) => e.actor === 2)).toMatchObject({ cardId: 'fork', moveId: 'hard-fork' });
  });
});

describe('resolution: re-plan, obedience and Brittle repeat', () => {
  const TWO: Deck = { cards: [c('hit', T, 'ship-it', 'highestAtkFoe'), c('next', T, 'token-burst')], default: DEF };

  /** The state at round 1 with a-act1's planned entry. */
  function planned(deck: Deck, g: number | null) {
    const s = decked(deck, g);
    s.round = 1;
    const entry = planEntries(s, {}).find((e) => e.actor === 1);
    if (entry === undefined) throw new Error('no entry');
    return { s, entry };
  }

  it('when the intent’s target faints first, evaluation continues from the next card down and the intent is marked replanned', () => {
    const { s, entry } = planned(TWO, 90);
    expect(entry).toMatchObject({ cardId: 'hit', moveId: 'ship-it', target: 6 });
    faint(at(s, 6));
    expect(deckAction(s, at(s, 1), entry, word(0, 0))).toEqual({
      intent: { actor: 1, moveId: 'token-burst', target: 7, cardId: 'next', replanned: true },
      trace: { firedCardId: 'next', skipped: [{ cardId: 'hit', reason: 'conditionFalse' }] },
      brittleRepeat: false,
    });
    const events: BattleEvent[] = [];
    resolveEntry(s, entry, events);
    expect(ofType(events, 'CardTrace')).toEqual([{ round: 1, type: 'CardTrace', actor: 1, firedCardId: 'next', skipped: [{ cardId: 'hit', reason: 'conditionFalse' }] }]);
    expect(ofType(events, 'MoveUsed')).toEqual([{ round: 1, type: 'MoveUsed', actor: 1, moveId: 'token-burst', target: 7 }]);
  });

  it('an intent that still holds is kept, with its plan-time trace', () => {
    const deck: Deck = { cards: [c('no', F, 'ship-it'), ...TWO.cards], default: DEF };
    const { s, entry } = planned(deck, 90);
    expect(deckAction(s, at(s, 1), entry, word(0, 99))).toEqual({
      intent: { actor: 1, moveId: 'ship-it', target: 6, cardId: 'hit', replanned: false },
      trace: { firedCardId: 'hit', skipped: [{ cardId: 'no', reason: 'conditionFalse' }] },
      brittleRepeat: false,
    });
  });

  it('a Brittle creature disobeys when lo(D1, 100) ≥ 85: the next matching card fires and the intent’s card is traced disobeyed', () => {
    const { s, entry } = planned(TWO, 10);
    expect(entry.cardId).toBe('hit'); // the intent shows the obeying choice
    s.rng = rngWhere((d) => lo(d.d1, 100) >= 85);
    const events: BattleEvent[] = [];
    resolveEntry(s, entry, events);
    expect(ofType(events, 'CardTrace')).toEqual([{ round: 1, type: 'CardTrace', actor: 1, firedCardId: 'next', skipped: [{ cardId: 'hit', reason: 'disobeyed' }] }]);
    expect(ofType(events, 'MoveUsed')[0]).toMatchObject({ moveId: 'token-burst' });

    const again = planned(TWO, 10);
    again.s.rng = rngWhere((d) => lo(d.d1, 100) < 85);
    const obeyed: BattleEvent[] = [];
    resolveEntry(again.s, again.entry, obeyed);
    expect(ofType(obeyed, 'CardTrace')[0]).toMatchObject({ firedCardId: 'hit', skipped: [] });
  });

  it('no generalization is Stable (95%): lo(D1, 100) = 95 disobeys', () => {
    const { s, entry } = planned(TWO, null);
    expect(deckAction(s, at(s, 1), entry, word(0, 94)).intent.cardId).toBe('hit');
    expect(deckAction(s, at(s, 1), entry, word(0, 95)).intent.cardId).toBe('next');
  });

  describe('replanned (Ruling 92): the obeying choice differs from the planned intent; obedience alone never re-plans', () => {
    const replanned = (s: BattleState, entry: ActionEntry, lo1: number) => deckAction(s, at(s, 1), entry, word(0, lo1)).intent;
    /** A Policy Update of side a resolved this round, after a-act1 was planned. */
    const policyNow = (s: BattleState, card: Card): void => {
      s.sides.a.policies = [{ card, fromRound: s.round, lastRound: s.round + 2 }];
    };

    it('resume path: a disobeyed intent is not re-planned; a target that fainted is', () => {
      const { s, entry } = planned(TWO, 10);
      expect(replanned(s, entry, 90)).toMatchObject({ cardId: 'next', replanned: false });
      faint(at(s, 6));
      expect(replanned(s, entry, 0)).toMatchObject({ cardId: 'next', replanned: true });
      expect(replanned(s, entry, 90)).toMatchObject({ cardId: 'def', replanned: true });
    });

    it('fresh path (a policy resolved this round): the same rule', () => {
      const unmet = planned(TWO, 10);
      policyNow(unmet.s, c('pol', F, 'token-burst'));
      // The policy does not hold, so the obeying choice is still the planned card: a disobeyed roll is no re-plan.
      expect(replanned(unmet.s, unmet.entry, 0)).toMatchObject({ cardId: 'hit', replanned: false });
      expect(replanned(unmet.s, unmet.entry, 90)).toMatchObject({ cardId: 'next', replanned: false });
      const met = planned(TWO, 10);
      policyNow(met.s, c('pol', T, 'token-burst'));
      expect(replanned(met.s, met.entry, 0)).toMatchObject({ cardId: 'pol', replanned: true });
      // Disobeying the policy lands back on the planned card, but the policy changed the obeying choice.
      expect(replanned(met.s, met.entry, 90)).toMatchObject({ cardId: 'hit', replanned: true });
    });
  });

  it('a Brittle creature with no matching card repeats its most-represented move and emits BrittleRepeat', () => {
    const deck: Deck = { cards: [c('a', F, 'ship-it'), c('b', F, 'token-burst'), c('e', F, 'token-burst')], default: DEF };
    const { s, entry } = planned(deck, 10);
    expect(entry).toMatchObject({ cardId: 'def', moveId: 'token-burst', target: 7 });
    const events: BattleEvent[] = [];
    resolveEntry(s, entry, events);
    expect(events.filter((e) => e.type === 'CardTrace' || e.type === 'BrittleRepeat' || e.type === 'MoveUsed')).toEqual([
      {
        round: 1,
        type: 'CardTrace',
        actor: 1,
        firedCardId: 'def',
        skipped: [
          { cardId: 'a', reason: 'conditionFalse' },
          { cardId: 'b', reason: 'conditionFalse' },
          { cardId: 'e', reason: 'conditionFalse' },
        ],
      },
      { round: 1, type: 'BrittleRepeat', actor: 1, moveId: 'token-burst' },
      { round: 1, type: 'MoveUsed', actor: 1, moveId: 'token-burst', target: 7 },
    ]);
  });

  it('a Default (or Brittle repeat) move a status forbids falls back to the no-deck default intent, the Default traced moveDisabled (Rulings 86, 88)', () => {
    const buff = c('def', T, 'low-latency', 'self');
    const cases: [Deck, number][] = [
      [{ cards: [c('a', F, 'ship-it')], default: buff }, 90],
      [{ cards: [c('a', F, 'low-latency', 'self'), c('b', F, 'low-latency', 'self')], default: c('def', T, 'ship-it') }, 10],
    ];
    for (const [deck, g] of cases) {
      const s = decked(deck, g);
      s.round = 1;
      at(s, 1).statuses.push({ id: 'glazed', remaining: 3, source: 7 });
      const fallback = defaultIntent(s, 1);
      expect(fallback.moveId).toBe('ship-it');
      const entry = planEntries(s, {}).find((e) => e.actor === 1);
      if (entry === undefined) throw new Error('no entry');
      expect(entry).toMatchObject({ cardId: 'def', moveId: fallback.moveId, target: fallback.target });
      expect(getIntents(s).find((i) => i.actor === 1)).toMatchObject({ cardId: 'def', moveId: 'ship-it' });
      const events: BattleEvent[] = [];
      resolveEntry(s, entry, events);
      const trace = ofType(events, 'CardTrace')[0];
      expect(trace?.firedCardId).toBe('def');
      expect(trace?.skipped.at(-1)).toEqual({ cardId: 'def', reason: 'moveDisabled' });
      // Traced once: the plan-time fallback's own skip is not carried over as a card above the intent's.
      expect(trace?.skipped.filter((k) => k.cardId === 'def')).toHaveLength(1);
      expect(ofType(events, 'BrittleRepeat')).toEqual([]);
      expect(ofType(events, 'MoveUsed')[0]).toMatchObject({ actor: 1, moveId: 'ship-it', target: fallback.target });
    }
  });

  it('a skipped action (KO’d before its turn) emits no CardTrace', () => {
    const { s, entry } = planned(TWO, 90);
    faint(at(s, 1));
    const events: BattleEvent[] = [];
    resolveEntry(s, entry, events);
    expect(ofType(events, 'CardTrace')).toEqual([]);
  });
});
