import { describe, expect, it } from 'vitest';
import { getIntents, planEntries, deckAction } from '../../src/battle/plan.js';
import { replay } from '../../src/battle/replay.js';
import { submitRound } from '../../src/battle/round.js';
import { createBattle, validateSetup, type BattleSetup, type SideSetup } from '../../src/battle/setup.js';
import { simulate } from '../../src/battle/simulate.js';
import type { BattleState, Temperature } from '../../src/battle/state.js';
import type { Card, Condition, Deck } from '../../src/cards/model.js';
import type { BattleEvent } from '../../src/events/types.js';
import { buildGrid, GRID_TEMPLATES } from '../helpers/arbitraries.js';
import { ofType, run } from './effects/kit.js';
import { firstUsable } from '../golden/script.js';
import { at, battle, draws, faint, gridlessSetup, mon, SEED } from './helpers.js';

// Task B4 (Rulings 93-96): Autopilot decks drive an AI trainer's or ghost's orchestrator when its side sends no
// command. Canonical indices (helpers.battle): 0 a-orch Sagelet, 1 a-act1 Blitzr, 2 a-act2 Forkling, 3-5 a bench,
// 6 b-orch Sagelet, 7 b-act1 Blitzr, 8 b-act2 Forkling, 9-11 b bench.

const T: Condition = { category: 'hp', op: 'atLeast', pct: 25 };
const F: Condition = { category: 'hp', op: 'below', pct: 25 };
const c = (id: string, condition: Condition, move: string, target: Card['target'] = 'lowestHpFoe', over: Partial<Card> = {}): Card => ({ id, subject: 'self', condition, move, target, ...over });

/** Sagelet's Autopilot: finish a weak foe, think on a cooldown, flip a coin, else (Default) Happy to Help. */
const SAGE: Deck = {
  cards: [
    c('finish', { category: 'hp', op: 'below', pct: 50 }, 'proof-by-contradiction', 'lowestHpFoe', { subject: 'foe' }),
    c('think', { category: 'cooldown', rounds: 2 }, 'step-back-prompt', 'self'),
    c('coin', { category: 'coin' }, 'chain-of-thought', 'randomFoe'),
  ],
  default: c('help', T, 'happy-to-help'),
};

const auto = (deck: Deck = SAGE, temperature: Temperature = 2): Pick<SideSetup, 'autopilot'> => ({ autopilot: { deck, temperature } });
const bothAuto = (a: Deck = SAGE, b: Deck = SAGE): BattleSetup => gridlessSetup(auto(a, 1), auto(b, 3));
const codes = (s: BattleSetup): [string, string][] => validateSetup(s).errors.map((e) => [e.code, e.path]);

function round(state: BattleState, cmd: Parameters<typeof submitRound>[1] = {}): { state: BattleState; events: BattleEvent[] } {
  const r = submitRound(state, cmd);
  if ('error' in r) throw new Error(r.error.message);
  return r;
}

const intentsOf = (events: readonly BattleEvent[]) => ofType([...events], 'IntentsPlanned').flatMap((e) => e.intents);
const tracesOf = (events: readonly BattleEvent[], actor: number) => ofType([...events], 'CardTrace').filter((e) => e.actor === actor);

describe('Autopilot deck validation (Ruling 95)', () => {
  const many = (n: number): Card[] => Array.from({ length: n }, (_, i) => c(`k${i}`, T, 'chain-of-thought'));

  it('accepts up to 12 cards (Default aside) and rejects 13 with deckSize', () => {
    expect(codes(gridlessSetup(auto({ cards: many(12), default: c('d', T, 'happy-to-help') })))).toEqual([]);
    expect(codes(gridlessSetup({}, auto({ cards: many(13), default: c('d', T, 'happy-to-help') })))).toEqual([['deckSize', 'b.autopilot.deck.cards']]);
  });

  it('gives an Autopilot deck the subagent deck rules against the orchestrator moveset', () => {
    const bad: Deck = {
      cards: [c('x', T, 'ship-it'), c('x', { category: 'turn', op: 'atLeast', round: 0 }, 'compact'), c('y', { category: 'coin' }, 'chain-of-thought', 'randomFoe', { subject: 'foe' })],
      default: undefined as never,
    };
    expect(codes(gridlessSetup(auto(bad)))).toEqual([
      ['deckDefault', 'a.autopilot.deck.default'],
      ['moveNotKnown', 'a.autopilot.deck.cards[0].move'],
      ['duplicateId', 'a.autopilot.deck.cards[1].id'],
      ['range', 'a.autopilot.deck.cards[1].condition.round'],
      ['cardSubject', 'a.autopilot.deck.cards[2].subject'],
    ]);
  });

  it('Autopilot cards name moves only: a lever or Swap is rejected (Ruling 94)', () => {
    const deck: Deck = { cards: [c('dir', T, 'directive'), c('pol', T, 'policy-update'), c('sw', T, 'swap')], default: c('d', T, 'happy-to-help') };
    expect(codes(gridlessSetup(auto(deck)))).toEqual([
      ['moveNotKnown', 'a.autopilot.deck.cards[0].move'],
      ['moveNotKnown', 'a.autopilot.deck.cards[1].move'],
      ['unknownId', 'a.autopilot.deck.cards[2].move'],
    ]);
  });

  it("a gridded orchestrator's Autopilot may name its grid moves (signature, Skills) and nothing else", () => {
    // Template 2 (L4-6): its one Skill piece holds Sagelet's first non-signature move, Chain of Thought.
    const grid = buildGrid(GRID_TEMPLATES[2] as (typeof GRID_TEMPLATES)[number], 'sagelet', ['a-act1', 'a-act2'], 0);
    const gridded = (deck: Deck): BattleSetup => gridlessSetup({ orchestrator: { ...mon('a-orch', 'sagelet'), moves: [] }, grid, ...auto(deck) });
    expect(codes(gridded({ cards: [c('k', T, 'chain-of-thought'), c('u', T, 'compact')], default: c('d', T, 'happy-to-help') }))).toEqual([]);
    expect(codes(gridded({ cards: [c('k', T, 'step-back-prompt')], default: c('d', T, 'happy-to-help') }))).toEqual([['moveNotKnown', 'a.autopilot.deck.cards[0].move']]);
  });

  it('shape-checks an untrusted Autopilot deck like a subagent deck', () => {
    const s = gridlessSetup({ autopilot: { deck: 7 as never, temperature: 2 } }, { autopilot: { deck: { cards: [{ id: 1 }], default: c('d', T, 'happy-to-help') } as never, temperature: 2 } });
    const got = codes(s);
    expect(got[0]).toEqual(['shape', 'a.autopilot.deck']);
    expect(got.slice(1).every(([code, path]) => code === 'shape' && path.startsWith('b.autopilot.deck.cards[0]'))).toBe(true);
    expect(got.length).toBeGreaterThan(1);
  });
});

describe('Autopilot battles (Rulings 93-96)', () => {
  it("simulate { kind: 'autopilot' } runs a both-Autopilot battle on {} rounds, and replay reproduces its hash", () => {
    const r = simulate(bothAuto(), SEED, { kind: 'autopilot' });
    expect(r.events.at(-1)?.type).toBe('BattleEnd');
    expect(r.log.rounds).toEqual(Array.from({ length: r.rounds }, () => ({})));
    const again = replay(structuredClone(r.log));
    if ('error' in again) throw new Error(again.error.code);
    expect(again.hash).toBe(r.hash);
    expect(again.events).toEqual(r.events);
  });

  it('Autopilot orchestrators emit CardTrace and are listed in IntentsPlanned with their card', () => {
    const r = simulate(bothAuto(), SEED, { kind: 'autopilot' });
    for (const orch of [0, 6]) {
      const traces = tracesOf(r.events, orch);
      expect(traces.length).toBeGreaterThan(0);
      const fired = new Set(traces.map((t) => t.firedCardId));
      expect([...fired].every((id) => ['finish', 'think', 'coin', 'help'].includes(id))).toBe(true);
      const listed = intentsOf(r.events).filter((i) => i.actor === orch);
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.every((i) => i.cardId !== null)).toBe(true);
    }
    // Always obeys (Ruling 93): no orchestrator trace ever records a disobeyed card or a Brittle repeat.
    const orchTraces = ofType(r.events, 'CardTrace').filter((t) => t.actor === 0 || t.actor === 6);
    expect(orchTraces.some((t) => t.skipped.some((k) => k.reason === 'disobeyed'))).toBe(false);
    expect(ofType(r.events, 'BrittleRepeat')).toEqual([]);
  });

  it('IntentsPlanned lists orchestrator intents in canonical order among the subagents', () => {
    const { events } = round(createBattle(bothAuto(), SEED));
    expect(intentsOf(events).map((i) => i.actor)).toEqual([0, 1, 2, 6, 7, 8]);
  });

  it("simulate { kind: 'autopilot' } with no Autopilot config plays default intents with no error", () => {
    const r = simulate(gridlessSetup(), SEED, { kind: 'autopilot' });
    expect(r.hash).toBe(simulate(gridlessSetup(), SEED, { kind: 'recorded', rounds: [] }).hash);
    expect(ofType(r.events, 'CardTrace')).toEqual([]);
  });

  it('a present SideCommand wins for that round (and its temperature stays); Autopilot drives again when it is absent', () => {
    let s = createBattle(bothAuto(), SEED);
    expect([s.sides.a.temperature, s.sides.b.temperature]).toEqual([1, 3]);
    const commanded = round(s, { a: { temperature: 4, action: { kind: 'move', moveId: 'chain-of-thought', target: 7 } } });
    expect(intentsOf(commanded.events).map((i) => i.actor)).toEqual([1, 2, 6, 7, 8]);
    expect(tracesOf(commanded.events, 0)).toEqual([]);
    expect(ofType(commanded.events, 'MoveUsed').find((e) => e.actor === 0)?.moveId).toBe('chain-of-thought');
    expect(tracesOf(commanded.events, 6).length).toBe(1);
    s = commanded.state;
    expect(s.sides.a.temperature).toBe(4);
    const next = round(s);
    expect(intentsOf(next.events).map((i) => i.actor)).toContain(0);
    expect(next.state.sides.a.temperature).toBe(4);
  });

  it('getIntents previews Autopilot orchestrators (assuming no command) and equals the next IntentsPlanned', () => {
    let s = createBattle(bothAuto(), SEED);
    expect(getIntents(s).map((i) => i.actor)).toEqual([0, 1, 2, 6, 7, 8]);
    for (let r = 1; r <= 8 && !s.ended; r++) {
      const before = structuredClone(s);
      const intents = getIntents(s);
      expect(s).toEqual(before);
      expect(intents.filter((i) => i.actor === 0 || i.actor === 6).every((i) => i.cardId !== null)).toBe(true);
      const played = round(s);
      expect(intentsOf(played.events)).toEqual(intents.map(({ actor, moveId, target, cardId }) => ({ actor, moveId, target, cardId })));
      s = played.state;
    }
  });

  it('a headless Autopilot side lists no orchestrator intent and traces nothing for it', () => {
    const s = battle(auto());
    faint(at(s, 0));
    s.sides.a.headless = true;
    const { events } = round(s);
    expect(intentsOf(events).some((i) => i.actor === 0)).toBe(false);
    expect(tracesOf(events, 0)).toEqual([]);
    expect(ofType(events, 'ActionSkipped').find((e) => e.actor === 0)?.reason).toBe('headless');
  });

  it('a charging Autopilot orchestrator releases its charge instead of evaluating its deck', () => {
    const s = battle(auto());
    s.round = 1;
    at(s, 0).charging = { moveId: 'happy-to-help', target: 7, remaining: 1, powerDelta: 0, hitPower: 0 };
    const orch = planEntries(s, {}).find((e) => e.actor === 0);
    expect(orch).toMatchObject({ moveId: 'happy-to-help', target: 7 });
    expect(orch?.cardId).toBeUndefined();
  });
});

describe('Autopilot resolution (Ruling 93)', () => {
  it('always obeys: a Brittle-generalization orchestrator never rolls obedience and never repeats', () => {
    // Generalization 0 would make a subagent Brittle (85% obedience, Brittle repeat); lo(D1, 100) = 99 would disobey.
    const deck: Deck = { cards: [c('go', T, 'chain-of-thought'), c('rare', F, 'chain-of-thought'), c('rare2', F, 'chain-of-thought')], default: c('help', T, 'happy-to-help') };
    const s = battle({ orchestrator: { ...mon('a-orch', 'sagelet'), generalization: 0 }, ...auto(deck) });
    s.round = 1;
    const entry = planEntries(s, {}).find((e) => e.actor === 0);
    if (entry === undefined) throw new Error('no orchestrator entry');
    expect(entry.cardId).toBe('go');
    const r = deckAction(s, at(s, 0), entry, draws({ d1lo: 99 }).d1);
    expect(r.trace).toEqual({ firedCardId: 'go', skipped: [] });
    expect(r.brittleRepeat).toBe(false);
    // Nothing above Default fires: Default's own move, not the most-represented one.
    const quiet: Deck = { cards: [c('rare', F, 'chain-of-thought'), c('rare2', F, 'chain-of-thought')], default: c('help', T, 'happy-to-help') };
    s.sides.a.autopilot = { deck: quiet, temperature: 2 };
    const def = planEntries(s, {}).find((e) => e.actor === 0);
    if (def === undefined) throw new Error('no orchestrator entry');
    const r2 = deckAction(s, at(s, 0), def, draws({ d1lo: 99 }).d1);
    expect(r2.intent.moveId).toBe('happy-to-help');
    expect(r2.brittleRepeat).toBe(false);
  });

  it('re-plans when its planned target is KO\'d before it acts', () => {
    const s = battle(auto({ cards: [c('hit', T, 'chain-of-thought', 'lowestHpFoe')], default: c('help', T, 'happy-to-help') }));
    s.round = 1;
    const entry = planEntries(s, {}).find((e) => e.actor === 0);
    if (entry === undefined) throw new Error('no orchestrator entry');
    expect(entry).toMatchObject({ cardId: 'hit', target: 7 });
    faint(at(s, 7));
    const r = deckAction(s, at(s, 0), entry, draws().d1);
    // The next lowest-HP living foe (b-orch).
    expect(r.intent).toMatchObject({ cardId: 'help', moveId: 'happy-to-help', target: 6, replanned: true });
    expect(r.trace).toEqual({ firedCardId: 'help', skipped: [{ cardId: 'hit', reason: 'conditionFalse' }] });
  });

  it('a status-disabled Default falls back to the default intent, traced moveDisabled (Ruling 86)', () => {
    const s = battle(auto({ cards: [], default: c('help', T, 'happy-to-help') }));
    at(s, 0).statuses.push({ id: 'overfit', remaining: 3, source: 7 });
    at(s, 0).lastMoveId = 'chain-of-thought';
    const { events } = round(s);
    expect(tracesOf(events, 0)).toEqual([{ round: 1, type: 'CardTrace', actor: 0, firedCardId: 'help', skipped: [{ cardId: 'help', reason: 'moveDisabled' }] }]);
    expect(intentsOf(events).find((i) => i.actor === 0)).toMatchObject({ moveId: 'chain-of-thought', cardId: 'help' });
    expect(ofType(events, 'MoveUsed').find((e) => e.actor === 0)?.moveId).toBe('chain-of-thought');
  });

  it("applies the fired Autopilot card's injection preference", () => {
    // No slice species knows Deepfake Call, so the deck and the move are put on the state directly.
    const s = battle(auto());
    s.sides.a.autopilot = { deck: { cards: [c('deep', T, 'deepfake-call', 'lowestHpFoe', { injection: { moveId: 'token-burst', target: 'lowestHpAlly' } })], default: c('help', T, 'happy-to-help') }, temperature: 2 };
    s.round = 1;
    for (const k of s.creatures) k.hp = k.maxHp = 500;
    at(s, 0).moves = ['deepfake-call', ...at(s, 0).moves];
    at(s, 8).hp = 100; // the victim's lowest-HP ally
    const events = run(s, 0, 'deepfake-call', 7, {}, { cardId: 'deep', skipped: [] });
    expect(tracesOf(events, 0)[0]?.firedCardId).toBe('deep');
    expect(at(s, 7).statuses.find((x) => x.id === 'promptInjected')?.injected).toEqual({ moveId: 'token-burst', target: 8 });
  });

  it('keeps the Autopilot side out of the log and replays from it, mixed with a commanded side', () => {
    const setup = gridlessSetup({}, auto(SAGE, 4));
    const r = simulate(setup, SEED, { kind: 'scripted', next: (state) => ({ a: firstUsable(state, 'a') }) });
    expect(r.log.rounds.every((cmd) => cmd.b === undefined && cmd.a !== undefined)).toBe(true);
    expect(tracesOf(r.events, 6).length).toBeGreaterThan(0);
    const again = replay(r.log);
    expect('error' in again ? again.error : again.hash).toBe(r.hash);
  });
});
