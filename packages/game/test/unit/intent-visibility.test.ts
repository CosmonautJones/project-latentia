import type { FieldState, Intent } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { HIDDEN_INTENT, intentLine, revealedFoes } from '../../src/battle/intent-visibility.js';
import { BattleSession } from '../../src/battle/session.js';
import { rivalBattle, type BattleDef } from '../../src/content/battles.js';

// Canonical indices: 0 the player's orchestrator, 1 its subagent; 2 and 3 the foe's.
const sideOf = (i: number): 0 | 1 => (i < 2 ? 0 : 1);
const field = (kind: 'revealIntents' | 'revealTopDeckCard' | 'junkPerRound', source: number, target: number): FieldState =>
  ({ effect: kind === 'junkPerRound' ? { kind, count: 1 } : { kind }, source, target, remaining: 2 }) as FieldState;

const ictx = { shortName: (i: number) => ['SAGELET', 'TOKENIBBLE', 'BLITZR', 'NULLBEETLE'][i] ?? '?', moveName: (m: string) => m.toUpperCase() };
const intent = (actor: number, target: number): Intent => ({ actor, moveId: 'token-burst', target, cardId: 'x' });

describe('foe intents are hidden unless revealed', () => {
  it('a revealIntents field the player put on a foe reveals that foe only', () => {
    expect(revealedFoes([field('revealIntents', 0, 2)], sideOf)).toEqual(new Set([2]));
    // Saliency Map: one field per foe.
    expect(revealedFoes([field('revealIntents', 1, 2), field('revealIntents', 1, 3)], sideOf)).toEqual(new Set([2, 3]));
  });

  it("the foe's own reveals, other field kinds and fields on the player's side reveal nothing to the player", () => {
    expect(revealedFoes([field('revealIntents', 2, 0)], sideOf).size).toBe(0);
    expect(revealedFoes([field('revealTopDeckCard', 0, 2), field('junkPerRound', 0, 2)], sideOf).size).toBe(0);
  });

  it("the player's own subagents always show; a foe shows ? until revealed", () => {
    expect(intentLine(intent(1, 2), ictx, sideOf, new Set(), 30)).toBe('TOKEN-BURST → BLITZR');
    expect(intentLine(intent(2, 0), ictx, sideOf, new Set(), 30)).toBe(HIDDEN_INTENT);
    expect(intentLine(intent(2, 0), ictx, sideOf, new Set([2]), 30)).toBe('TOKEN-BURST → SAGELET');
  });

  it("Socratic Method reveals the foe's move for the round it lands in, and the next preview is hidden again", () => {
    const base = rivalBattle('sagelet', 0);
    const def: BattleDef = {
      ...base,
      setup: { ...base.setup, a: { ...base.setup.a, orchestrator: { ...base.setup.a.orchestrator, id: 'you.hallucinat', species: 'hallucinat', moves: ['socratic-method', 'confident-citation'] } } },
    };
    const s = BattleSession.start(def);
    expect(s.revealedFoes().size).toBe(0);
    const r = s.submit({ temperature: 2, moveId: 'socratic-method', target: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'Revealed', actor: 0, target: 1, what: 'nextIntent' }));
    expect(s.revealedFoes().size).toBe(0);
  });
});
