import { describe, expect, it } from 'vitest';
import type { BattleView, ViewCreature } from '../../src/cards/model.js';
import { isNoOp, isWasteful, wasteReason } from '../../src/generalization/wasteful.js';
import type { WastefulRule } from '../../src/generalization/model.js';
import { view } from '../cards/helpers.js';

// Wasteful actions (Ruling 106, amending 104): an action is wasted only when the WHOLE action achieves nothing in the
// scenario view — the move deals no damage and every one of its effects is a no-op there. The four rule kinds are
// labels: a rule flags such a no-op when the move holds an effect of its kind (a heal, a stage raise, a cure, a Drift
// or token removal). Helper view: actor 1, allies 0 (orchestrator) and 2, foes 6, 7, 8, everyone at 100/100 with no
// stages, statuses or tokens.

const rule = (kind: WastefulRule['kind']): WastefulRule => ({ kind });
const HEAL = rule('healAtFull');
const BUFF = rule('buffAtMax');
const CURE = rule('cureWithoutStatus');
const COMPACT = rule('compactWhenEmpty');

const stages = (compute: number, accuracy = 0, evasion = 0): ViewCreature['stages'] => ({ compute, robustness: 0, latency: 0, accuracy, evasion });
/** The helper view with creature `index` (the actor, an ally or a foe) changed. */
function withCreature(index: number, over: Partial<ViewCreature>, v: BattleView = view()): BattleView {
  const edit = (c: ViewCreature): ViewCreature => (c.index === index ? { ...c, ...over } : c);
  return { ...v, self: edit(v.self), orchestrator: v.orchestrator === null ? null : edit(v.orchestrator), allies: v.allies.map(edit), foes: v.foes.map(edit) };
}

describe('the whole action must be a no-op', () => {
  it('a damaging move is never wasteful, whatever its riders do (a mixed damage + cure move)', () => {
    // Retrieval Strike: damage, then cure Hallucinating on a target that is not Hallucinating
    for (const r of [HEAL, BUFF, CURE, COMPACT]) expect(isWasteful(r, 'retrieval-strike', 6, view())).toBe(false);
    expect(isWasteful(CURE, 'citation-needed', 6, view())).toBe(false);
  });

  it('damage, a status infliction, a field start, a guard, a snapshot, a reveal or a copy always does something', () => {
    for (const [move, target] of [['retrieval-strike', 6], ['throttle', 6], ['saliency-map', 1], ['guardrail', 1], ['save-state', 1], ['socratic-method', 6], ['fork', 6], ['rerank', 6]] as const) {
      expect(isNoOp(move, target, view())).toBe(false);
    }
    expect(isWasteful(CURE, 'throttle', 6, view())).toBe(false);
    expect(isNoOp('community-patch', 2, view())).toBe(true);
    expect(isNoOp('no-such-move', 2, view())).toBe(false);
  });

  it('a no-op move is flagged only by a rule whose kind it holds: the label is the reason', () => {
    // Community Patch at a full-HP target: a pure heal that heals nothing
    expect(isWasteful(HEAL, 'community-patch', 2, view())).toBe(true);
    expect(isWasteful(BUFF, 'community-patch', 2, view())).toBe(false);
    expect(isWasteful(CURE, 'community-patch', 2, view())).toBe(false);
  });
});

describe('healAtFull', () => {
  it('Community Patch heals its target: wasteful at full HP, whoever is hurt elsewhere; not when its target is hurt', () => {
    expect(isWasteful(HEAL, 'community-patch', 2, withCreature(0, { hp: 10 }))).toBe(true);
    expect(isWasteful(HEAL, 'community-patch', 2, withCreature(2, { hp: 10 }))).toBe(false);
  });

  it('Hotfix at full HP: not wasteful while its target holds a status it cures, wasteful when it holds none', () => {
    expect(isWasteful(HEAL, 'hotfix', 2, withCreature(2, { statuses: ['rateLimited'] }))).toBe(false);
    expect(isWasteful(CURE, 'hotfix', 2, withCreature(2, { statuses: ['rateLimited'] }))).toBe(false);
    expect(isWasteful(HEAL, 'hotfix', 2, view())).toBe(true);
    expect(isWasteful(CURE, 'hotfix', 2, view())).toBe(true);
    expect(isWasteful(HEAL, 'hotfix', 2, withCreature(2, { statuses: ['glazed'] }))).toBe(true); // a status Hotfix does not cure
    expect(isWasteful(HEAL, 'hotfix', 2, withCreature(2, { hp: 90 }))).toBe(false);
  });

  it('Earnest Apology is never a no-op: its next-hit damage reduction always lands', () => {
    expect(isWasteful(HEAL, 'earnest-apology', 1, view())).toBe(false);
    expect(isWasteful(COMPACT, 'earnest-apology', 1, view())).toBe(false);
  });
});

describe('buffAtMax', () => {
  it('Step-Back Prompt raises Compute and Accuracy: wasteful only when both are already +3', () => {
    expect(isWasteful(BUFF, 'step-back-prompt', 1, withCreature(1, { stages: stages(3, 3) }))).toBe(true);
    expect(isWasteful(BUFF, 'step-back-prompt', 1, withCreature(1, { stages: stages(3, 2) }))).toBe(false);
    expect(isWasteful(BUFF, 'step-back-prompt', 1, view())).toBe(false);
  });

  it('Hype Train also lowers Accuracy: a no-op only at Compute +3 with Accuracy already −3', () => {
    expect(isWasteful(BUFF, 'hype-train', 1, withCreature(1, { stages: stages(3, -3) }))).toBe(true);
    expect(isWasteful(BUFF, 'hype-train', 1, withCreature(1, { stages: stages(3, 0) }))).toBe(false);
    expect(isWasteful(BUFF, 'hype-train', 1, withCreature(1, { stages: stages(2, -3) }))).toBe(false);
  });

  it('Permissive License raises everyone on the field: wasteful only when all of them are at +3', () => {
    const maxed = (v: BattleView): BattleView => {
      const up = (c: ViewCreature): ViewCreature => ({ ...c, stages: stages(3) });
      return { ...v, self: up(v.self), orchestrator: v.orchestrator === null ? null : up(v.orchestrator), allies: v.allies.map(up), foes: v.foes.map(up) };
    };
    expect(isWasteful(BUFF, 'permissive-license', 1, maxed(view()))).toBe(true);
    expect(isWasteful(BUFF, 'permissive-license', 1, withCreature(7, { stages: stages(2) }, maxed(view())))).toBe(false);
  });

  it('a move that raises no stage is never flagged (Fact Check clears, Refactor clears)', () => {
    expect(isWasteful(BUFF, 'fact-check', 6, view())).toBe(false);
    expect(isWasteful(BUFF, 'refactor', 1, view())).toBe(false);
  });
});

describe('cureWithoutStatus', () => {
  it('Ground Truth cures the allied side and makes it ignore evasion: wasteful only with neither to do', () => {
    expect(isWasteful(CURE, 'ground-truth', 1, withCreature(6, { statuses: ['hallucinating'] }))).toBe(true); // a foe's status does not count
    expect(isWasteful(CURE, 'ground-truth', 1, withCreature(2, { statuses: ['hallucinating'] }))).toBe(false);
    expect(isWasteful(CURE, 'ground-truth', 1, withCreature(7, { stages: stages(0, 0, 1) }))).toBe(false); // a foe holds evasion
  });

  it('Drift counts as a status: Compact cures one stack', () => {
    expect(isWasteful(CURE, 'compact', 1, view())).toBe(true);
    expect(isWasteful(CURE, 'compact', 1, withCreature(1, { statuses: ['drift'] }))).toBe(false);
  });
});

describe('compactWhenEmpty', () => {
  it('Compact pairs the oldest tokens into summaries: with two or more tokens held it frees cells, so it is not wasteful', () => {
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 6 }))).toBe(false); // ordinary cost tokens only
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 2 }))).toBe(false);
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 1 }))).toBe(true); // one token pairs with nothing
    expect(isWasteful(COMPACT, 'compact', 1, view())).toBe(true);
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(1, { contextUsed: 1, statuses: ['drift'] }))).toBe(false);
  });

  it('/clear and Refactor remove any token held: a no-op only with no token, no stage, nothing to cure', () => {
    for (const move of ['clear', 'refactor']) {
      expect(isWasteful(COMPACT, move, 1, view())).toBe(true);
      expect(isWasteful(COMPACT, move, 1, withCreature(1, { contextUsed: 1 }))).toBe(false);
      expect(isWasteful(COMPACT, move, 1, withCreature(1, { stages: stages(-1) }))).toBe(false);
    }
    expect(isWasteful(COMPACT, 'refactor', 1, withCreature(1, { statuses: ['quantized'] }))).toBe(false);
  });

  it('/clear skips the next orchestrator command: a no-op for a subagent, a change for an orchestrator', () => {
    expect(isWasteful(COMPACT, 'clear', 1, withCreature(1, { isOrchestrator: true }))).toBe(false);
  });

  it('another creature’s tokens do not count, and a move that adds Junk to a foe always does something', () => {
    expect(isWasteful(COMPACT, 'compact', 1, withCreature(2, { contextUsed: 4 }))).toBe(true);
    expect(isWasteful(COMPACT, 'filibuster', 6, view())).toBe(false);
  });
});

describe('wasteReason: the first listed rule that flags the action', () => {
  it('names the label, or null when no listed rule flags it', () => {
    expect(wasteReason([], 'community-patch', 2, view())).toBeNull();
    expect(wasteReason([BUFF], 'community-patch', 2, view())).toBeNull();
    expect(wasteReason([BUFF, HEAL], 'community-patch', 2, view())).toBe('healAtFull');
    expect(wasteReason([CURE, HEAL], 'hotfix', 2, view())).toBe('cureWithoutStatus');
    expect(wasteReason([HEAL, CURE], 'hotfix', 2, view())).toBe('healAtFull');
    expect(wasteReason([HEAL, CURE], 'hotfix', 2, withCreature(2, { statuses: ['quantized'] }))).toBeNull();
  });
});
