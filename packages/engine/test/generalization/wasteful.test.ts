import { describe, expect, it } from 'vitest';
import type { BattleView, ViewCreature } from '../../src/cards/model.js';
import { isWasteful, wasted } from '../../src/generalization/wasteful.js';
import type { WastefulRule } from '../../src/generalization/model.js';
import { view } from '../cards/helpers.js';

// Wasteful actions (Ruling 104): each rule reads the fired move's effect primitives and the creatures they land on
// (the resolved target, the actor, or a group) in the scenario view. Helper view: actor 1, allies 0 (orchestrator)
// and 2, foes 6, 7, 8, everyone at 100/100 with no stages, statuses or tokens.

const rule = (kind: WastefulRule['kind']): WastefulRule => ({ kind });
const HEAL = rule('healAtFull');
const BUFF = rule('buffAtMax');
const CURE = rule('cureWithoutStatus');
const COMPACT = rule('compactWhenEmpty');

const stages = (compute: number, accuracy = 0): ViewCreature['stages'] => ({ compute, robustness: 0, latency: 0, accuracy, evasion: 0 });
/** The helper view with creature `index` (the actor, an ally or a foe) changed. */
function withCreature(index: number, over: Partial<ViewCreature>): BattleView {
  const v = view();
  const edit = (c: ViewCreature): ViewCreature => (c.index === index ? { ...c, ...over } : c);
  return { ...v, self: edit(v.self), orchestrator: v.orchestrator === null ? null : edit(v.orchestrator), allies: v.allies.map(edit), foes: v.foes.map(edit) };
}

describe('healAtFull: the move heals and every creature it heals is at full HP', () => {
  it('Earnest Apology heals the actor: wasteful at full HP, not when hurt', () => {
    expect(isWasteful(HEAL, 'earnest-apology', 1, view())).toBe(true);
    expect(isWasteful(HEAL, 'earnest-apology', 1, withCreature(1, { hp: 99 }))).toBe(false);
  });

  it('Community Patch heals its target, whoever is hurt elsewhere', () => {
    expect(isWasteful(HEAL, 'community-patch', 2, withCreature(0, { hp: 10 }))).toBe(true);
    expect(isWasteful(HEAL, 'community-patch', 2, withCreature(2, { hp: 10 }))).toBe(false);
  });

  it('Hotfix heals too, so it is flagged at full HP even when it would cure (each rule reads its own primitive)', () => {
    expect(isWasteful(HEAL, 'hotfix', 2, withCreature(2, { statuses: ['rateLimited'] }))).toBe(true);
  });

  it('a move that does not heal is never flagged', () => {
    expect(isWasteful(HEAL, 'ship-it', 6, view())).toBe(false);
  });
});

describe('buffAtMax: every stage the move raises, on every creature it raises it on, is already +3', () => {
  it('Step-Back Prompt raises Compute and Accuracy: wasteful only when both are +3', () => {
    expect(isWasteful(BUFF, 'step-back-prompt', 1, withCreature(1, { stages: stages(3, 3) }))).toBe(true);
    expect(isWasteful(BUFF, 'step-back-prompt', 1, withCreature(1, { stages: stages(3, 2) }))).toBe(false);
    expect(isWasteful(BUFF, 'step-back-prompt', 1, view())).toBe(false);
  });

  it('Hype Train raises only Compute (its Accuracy drop is not a raise)', () => {
    expect(isWasteful(BUFF, 'hype-train', 1, withCreature(1, { stages: stages(3, -3) }))).toBe(true);
    expect(isWasteful(BUFF, 'hype-train', 1, withCreature(1, { stages: stages(2) }))).toBe(false);
  });

  it('Permissive License raises everyone on the field: wasteful only when all of them are at +3', () => {
    const maxed = (v: BattleView): BattleView => {
      const up = (c: ViewCreature): ViewCreature => ({ ...c, stages: stages(3) });
      return { ...v, self: up(v.self), orchestrator: v.orchestrator === null ? null : up(v.orchestrator), allies: v.allies.map(up), foes: v.foes.map(up) };
    };
    expect(isWasteful(BUFF, 'permissive-license', 1, maxed(view()))).toBe(true);
    const oneFoeBelow = maxed(view());
    expect(isWasteful(BUFF, 'permissive-license', 1, { ...oneFoeBelow, foes: oneFoeBelow.foes.map((f) => (f.index === 7 ? { ...f, stages: stages(2) } : f)) })).toBe(false);
  });

  it('a move that raises no stage is never flagged (Fact Check clears, Refactor clears)', () => {
    expect(isWasteful(BUFF, 'fact-check', 6, withCreature(6, { stages: stages(3, 3) }))).toBe(false);
    expect(isWasteful(BUFF, 'refactor', 1, withCreature(1, { stages: stages(3, 3) }))).toBe(false);
  });
});

describe('cureWithoutStatus: the move cures and no creature it cures holds any status it cures', () => {
  it('Hotfix on an ally: wasteful without a status it cures, not with one', () => {
    expect(isWasteful(CURE, 'hotfix', 2, view())).toBe(true);
    expect(isWasteful(CURE, 'hotfix', 2, withCreature(2, { statuses: ['glazed'] }))).toBe(true); // not one Hotfix cures
    expect(isWasteful(CURE, 'hotfix', 2, withCreature(2, { statuses: ['deprecated'] }))).toBe(false);
  });

  it('Ground Truth cures the whole allied side: a hallucinating foe does not count', () => {
    expect(isWasteful(CURE, 'ground-truth', 1, withCreature(6, { statuses: ['hallucinating'] }))).toBe(true);
    expect(isWasteful(CURE, 'ground-truth', 1, withCreature(2, { statuses: ['hallucinating'] }))).toBe(false);
  });

  it('Drift counts as a status Compact cures', () => {
    expect(isWasteful(CURE, 'compact', 1, view())).toBe(true);
    expect(isWasteful(CURE, 'compact', 1, withCreature(1, { statuses: ['drift'] }))).toBe(false);
  });

  it('a damaging move’s cure rider counts too (any Search hit cures Hallucinating)', () => {
    expect(isWasteful(CURE, 'retrieval-strike', 6, view())).toBe(true);
    expect(isWasteful(CURE, 'retrieval-strike', 6, withCreature(6, { statuses: ['hallucinating'] }))).toBe(false);
  });

  it('a move that cures nothing is never flagged', () => {
    expect(isWasteful(CURE, 'ship-it', 6, view())).toBe(false);
  });
});

describe('compactWhenEmpty: the move removes Drift or Junk and the actor holds neither', () => {
  it('Compact with only cost tokens held is wasteful; with any Junk or Drift it is not', () => {
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 6 }))).toBe(true);
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 6, junk: 1 }))).toBe(false);
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { statuses: ['drift'] }))).toBe(false);
  });

  it('/clear, Refactor (frees the oldest tokens) and Earnest Apology (cures one Drift) remove Drift or Junk too', () => {
    for (const move of ['clear', 'refactor', 'earnest-apology']) {
      expect(isWasteful(COMPACT, move, 1, view())).toBe(true);
      expect(isWasteful(COMPACT, move, 1, withCreature(1, { contextUsed: 3, junk: 3 }))).toBe(false);
    }
  });

  it('another creature’s Junk does not count, and a move that adds Junk to a foe removes nothing', () => {
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(2, { contextUsed: 4, junk: 4 }))).toBe(true);
    expect(isWasteful(COMPACT, 'filibuster', 6, view())).toBe(false);
  });
});

describe('wasted: any rule the scenario lists', () => {
  it('is false with no rules, and true as soon as one listed rule flags the action', () => {
    expect(wasted([], 'earnest-apology', 1, view())).toBe(false);
    expect(wasted([BUFF], 'earnest-apology', 1, view())).toBe(false);
    expect(wasted([BUFF, HEAL], 'earnest-apology', 1, view())).toBe(true);
    expect(wasted([COMPACT], 'earnest-apology', 1, view())).toBe(true);
  });
});
