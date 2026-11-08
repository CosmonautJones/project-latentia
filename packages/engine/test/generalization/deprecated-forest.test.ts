import { describe, expect, it } from 'vitest';
import { holds } from '../../src/cards/conditions.js';
import { evaluateDeck } from '../../src/cards/evaluate.js';
import { CONDITION_CATEGORIES, FIELD_KINDS, type BattleView, type Card, type Condition, type Deck, type ViewCreature } from '../../src/cards/model.js';
import { STATUS_IDS, TYPES } from '../../src/content/ids.js';
import { moveDef } from '../../src/content/moves.js';
import { computeGeneralization, scenarioHit } from '../../src/generalization/score.js';
import { isWasteful, wasteReason } from '../../src/generalization/wasteful.js';
import type { EvalScenario, WastefulRule } from '../../src/generalization/model.js';
import { DEPRECATED_FOREST_SUITE } from '../../src/generalization/suites/deprecated-forest.js';

// The Deprecated Forest Eval Suite (Ruling 105): 12 held-out scenarios as plain data. Every test deck here is a
// probe: a card written for one scenario, evaluated with the deck rules B5 uses (Ruling 103).

const SUITE = DEPRECATED_FOREST_SUITE;
const scenario = (id: string): EvalScenario => {
  const s = SUITE.scenarios.find((x) => x.id === id);
  if (s === undefined) throw new Error(`no scenario ${id}`);
  return s;
};
const c = (id: string, subject: Card['subject'], condition: Condition, move: string, target: Card['target']): Card => ({ id, subject, condition, move, target });
const DEFAULT: Card = c('default', 'self', { category: 'turn', op: 'atLeast', round: 1 }, 'token-burst', 'lowestHpFoe');
const deckOf = (...cards: Card[]): Deck => ({ cards, default: DEFAULT });

/** One probe per scenario: the card a well-generalized deck plays there (each from a different category). */
const PROBES: Record<string, Card> = {
  'trailhead-wild-nullbeetle': c('hp', 'self', { category: 'hp', op: 'below', pct: 25 }, 'community-patch', 'self'),
  'first-brush-heisenmoth': c('coin', 'self', { category: 'coin' }, 'pixel-peep', 'randomFoe'),
  'switchbacks-bootcamp-grad': c('turn', 'self', { category: 'turn', op: 'below', round: 2 }, 'step-back-prompt', 'self'),
  'switchbacks-retro-collector': c('foeType', 'foe', { category: 'foeType', is: 'memory' }, 'stack-trace', 'foeWeakToMove'),
  'abandoned-repo-alpha-cobolt': c('cooldown', 'self', { category: 'cooldown', rounds: 1 }, 'hard-fork', 'lowestHpFoe'),
  'sunset-server-bench': c('allyHp', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'community-patch', 'orchestrator'),
  'legacy-cache-prompt-engineer': c('telegraphing', 'foe', { category: 'telegraphing' }, 'guardrail', 'self'),
  'legacy-cache-memory-leak': c('field', 'foe', { category: 'field', effect: 'junkPerRound' }, 'filibuster', 'lowestHpFoe'),
  'legacy-cache-stochastiparrot': c('foeBuffed', 'foe', { category: 'foeBuffed' }, 'fact-check', 'lowestHpFoe'),
  'scrape-camp-grunt-a': c('status', 'foe', { category: 'status', status: 'hallucinating' }, 'citation-needed', 'lowestHpFoe'),
  'scrape-camp-grunt-b': c('contextFill', 'self', { category: 'contextFill', op: 'atLeast', pct: 75 }, 'compact', 'self'),
  'model-graveyard-hallucinat': c('foeLastMove', 'foe', { category: 'foeLastMove', move: 'confident-citation' }, 'ground-truth', 'self'),
};

/** One trap per wasteful rule: a card that fires in its scenario and wastes the action. */
const TRAPS: { rule: WastefulRule['kind']; scenario: string; card: Card }[] = [
  // lowestHpAlly reads absolute HP: the actor (13/13) is "lower" than the hurt orchestrator (14/32)
  { rule: 'healAtFull', scenario: 'sunset-server-bench', card: c('t-heal', 'self', { category: 'allyHp', op: 'below', pct: 50 }, 'community-patch', 'lowestHpAlly') },
  { rule: 'buffAtMax', scenario: 'legacy-cache-stochastiparrot', card: c('t-buff', 'foe', { category: 'foeBuffed' }, 'hype-train', 'self') },
  { rule: 'cureWithoutStatus', scenario: 'scrape-camp-grunt-a', card: c('t-cure', 'foe', { category: 'status', status: 'hallucinating' }, 'ground-truth', 'self') },
  { rule: 'compactWhenEmpty', scenario: 'legacy-cache-memory-leak', card: c('t-compact', 'foe', { category: 'field', effect: 'junkPerRound' }, 'compact', 'self') },
];

/** One non-trap per wasteful rule: a scenario listing the rule where its probe plays a move of that kind well. */
const NON_TRAPS: { rule: WastefulRule['kind']; scenario: string }[] = [
  { rule: 'healAtFull', scenario: 'trailhead-wild-nullbeetle' },
  { rule: 'buffAtMax', scenario: 'switchbacks-bootcamp-grad' },
  { rule: 'cureWithoutStatus', scenario: 'model-graveyard-hallucinat' },
  { rule: 'compactWhenEmpty', scenario: 'scrape-camp-grunt-b' },
];

/** Every problem with a view, so a failure names it (empty when the view is internally valid). */
function problems(v: BattleView): string[] {
  const out: string[] = [];
  const all = [v.self, ...v.allies, ...v.foes];
  const creature = (cr: ViewCreature): void => {
    const at = `creature ${cr.index}`;
    if (!(Number.isSafeInteger(cr.maxHp) && cr.maxHp > 0 && Number.isSafeInteger(cr.hp) && cr.hp > 0 && cr.hp <= cr.maxHp)) out.push(`${at}: hp ${cr.hp}/${cr.maxHp}`);
    if (cr.types.length < 1 || cr.types.length > 2 || cr.types.some((t) => !TYPES.includes(t))) out.push(`${at}: types`);
    if (new Set(cr.statuses).size !== cr.statuses.length || cr.statuses.some((s) => !STATUS_IDS.includes(s))) out.push(`${at}: statuses`);
    if (cr.statuses.includes('drift') && cr.statuses.at(-1) !== 'drift') out.push(`${at}: drift is listed last`);
    if (Object.values(cr.stages).some((s) => !Number.isSafeInteger(s) || s < -3 || s > 3)) out.push(`${at}: stages`);
    if (!(Number.isSafeInteger(cr.compute) && cr.compute > 0)) out.push(`${at}: compute`);
    if (!(Number.isSafeInteger(cr.contextUsed) && cr.contextUsed >= 0 && cr.contextUsed <= cr.contextWindow)) out.push(`${at}: context`);
    if (cr.lastMove !== null && moveDef(cr.lastMove) === null) out.push(`${at}: lastMove`);
    if (cr.fields.some((f) => !FIELD_KINDS.includes(f))) out.push(`${at}: fields`);
    if (cr.telegraphing && cr.index === v.self.index) out.push(`${at}: the actor is planning, not charging`);
  };
  all.forEach(creature);
  if (new Set(all.map((x) => x.index)).size !== all.length) out.push('indices are not unique');
  if (all.map((x) => x.index).sort((a, b) => a - b).some((x, i) => x !== i)) out.push('indices are not contiguous from 0');
  for (const list of [v.allies, v.foes]) if (list.some((x, i) => i > 0 && (list[i - 1] as ViewCreature).index >= x.index)) out.push('a list is out of canonical order');
  if (v.foes.length < 1) out.push('no foe');
  if (v.foes.filter((f) => f.isOrchestrator).length !== 1) out.push('foes need exactly one orchestrator');
  const allied = [v.self, ...v.allies].filter((x) => x.isOrchestrator);
  if (allied.length !== 1 || v.orchestrator === null || allied[0]?.index !== v.orchestrator.index) out.push('orchestrator');
  if (v.orchestrator !== null && JSON.stringify(v.orchestrator) !== JSON.stringify(allied[0])) out.push('orchestrator differs from its ally entry');
  if (v.orchestratorTarget !== null && !v.foes.some((f) => f.index === v.orchestratorTarget)) out.push('orchestratorTarget is not a foe');
  if (!(Number.isSafeInteger(v.round) && v.round >= 1 && v.round <= 50)) out.push('round');
  if (v.roundStart === null || ![v.roundStart.r1, v.roundStart.r2].every((d) => Number.isSafeInteger(d) && d >= 0 && d <= 0xffffffff)) out.push('roundStart');
  const used = v.selfLastUsed;
  if (used.some((u) => moveDef(u.moveId) === null || u.round < 1 || u.round >= v.round) || new Set(used.map((u) => u.moveId)).size !== used.length) out.push('selfLastUsed');
  const latest = used.reduce<{ moveId: string; round: number } | null>((best, u) => (best === null || u.round > best.round ? u : best), null);
  if ((latest?.moveId ?? null) !== v.lastMoveId || v.lastMoveId !== v.self.lastMove) out.push('lastMoveId / lastMove disagree with selfLastUsed');
  if (v.round === 1 && (used.length > 0 || all.some((x) => x.lastMove !== null))) out.push('round 1 has history');
  return out;
}

describe('DEPRECATED_FOREST_SUITE: shape', () => {
  it('is the Deprecated Forest suite of 12 uniquely named scenarios', () => {
    expect(SUITE.id).toBe('deprecated-forest');
    expect(SUITE.scenarios).toHaveLength(12);
    expect(new Set(SUITE.scenarios.map((s) => s.id)).size).toBe(12);
    expect(Object.keys(PROBES).sort()).toEqual(SUITE.scenarios.map((s) => s.id).sort());
  });

  it('is deeply frozen plain data (JSON round-trips unchanged)', () => {
    const frozen = (x: unknown): boolean => typeof x !== 'object' || x === null || (Object.isFrozen(x) && Object.values(x).every(frozen));
    expect(frozen(SUITE)).toBe(true);
    expect(JSON.parse(JSON.stringify(SUITE))).toEqual(SUITE);
  });

  it.each(SUITE.scenarios.map((s) => [s.id, s] as const))('%s: the view is internally valid', (_id, s) => {
    expect(problems(s.view)).toEqual([]);
  });
});

describe('DEPRECATED_FOREST_SUITE: every scenario is hit, and together they exercise all 12 categories', () => {
  it('the 12 probes are one card from each condition category', () => {
    expect(Object.values(PROBES).map((p) => p.condition.category).sort()).toEqual([...CONDITION_CATEGORIES].sort());
  });

  it.each(Object.entries(PROBES))('%s: its probe fires there and the action is not wasteful', (id, probe) => {
    const s = scenario(id);
    const e = evaluateDeck(deckOf(probe), s.view, 1, { band: 'stable' });
    expect(e.cardId).toBe(probe.id);
    expect(scenarioHit(deckOf(probe), s, 1)).toBe(true);
  });

  it.each(Object.entries(PROBES))('%s: its probe’s condition is false in some other scenario (the scenario is what exercises it)', (id, probe) => {
    expect(SUITE.scenarios.some((s) => s.id !== id && !holds(probe, s.view))).toBe(true);
  });
});

describe('DEPRECATED_FOREST_SUITE: wasteful traps', () => {
  it('has at least one trap scenario for every wasteful rule', () => {
    expect(TRAPS.map((t) => t.rule).sort()).toEqual(['buffAtMax', 'compactWhenEmpty', 'cureWithoutStatus', 'healAtFull']);
  });

  it.each(TRAPS)('$rule flags its trap in $scenario: the trap card fires and wastes the action', ({ rule, scenario: id, card }) => {
    const s = scenario(id);
    expect(s.wasteful).toContainEqual({ kind: rule });
    const e = evaluateDeck(deckOf(card), s.view, 1, { band: 'stable' });
    expect(e.cardId).toBe(card.id);
    expect(isWasteful({ kind: rule }, e.moveId, e.target as number, s.view)).toBe(true);
    expect(wasteReason(s.wasteful, e.moveId, e.target as number, s.view)).toBe(rule);
    expect(scenarioHit(deckOf(card), s, 1)).toBe(false);
  });

  it.each(NON_TRAPS)('$rule does not flag the well-played $scenario', ({ rule, scenario: id }) => {
    const s = scenario(id);
    const probe = PROBES[id] as Card;
    expect(s.wasteful).toContainEqual({ kind: rule });
    const e = evaluateDeck(deckOf(probe), s.view, 1, { band: 'stable' });
    expect(e.cardId).toBe(probe.id);
    expect(isWasteful({ kind: rule }, e.moveId, e.target as number, s.view)).toBe(false);
  });

  it('the same four categories score the same Coverage, but only the well-played deck scores Holdout', () => {
    const good = deckOf(...TRAPS.map((t) => PROBES[t.scenario] as Card));
    const traps = deckOf(...TRAPS.map((t) => t.card));
    expect(computeGeneralization(good, SUITE, 4)).toEqual({ c: [1, 1], r: [0, 1], h: [1, 3], g: 70, band: 'robust' });
    expect(computeGeneralization(traps, SUITE, 4)).toEqual({ c: [1, 1], r: [0, 1], h: [0, 1], g: 55, band: 'stable' });
  });
});
