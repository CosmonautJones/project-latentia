import { createBattle, simulate } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { naiveCommand } from '../../scripts/loop-balance.js';
import { trainerBattle } from '../../src/content/battles.js';
import { TOKENIBBLE_PRESETS } from '../../src/content/trainers.js';
import { initialFlow, transition, type FlowEvent, type FlowState } from '../../src/flow/flow.js';
import { NO_TELEMETRY, type FightReport } from '../../src/flow/telemetry.js';
import { debriefFor } from '../../src/journey/debrief.js';
import { fightReport } from '../../src/journey/fight-report.js';
import { endCardStats } from '../../src/journey/end-stats.js';

const fight = (patch: Partial<FightReport> = {}): FightReport => ({ battle: 'trainer', outcome: 'lose', rounds: 4, moves: 9, cardsFired: 4, cardId: 'tutorial.c', kept: ['Tokenibble kept using Low Latency: 4 of 4 turns.'], ...patch });
const at = (patch: Partial<FlowState>): FlowState => ({ ...initialFlow(), step: 'debrief', starter: 'blitzr', distill: 'spinUp', tutorialCardId: 'tutorial.c', lastFight: fight(), ...patch });

describe('fightReport', () => {
  it('counts the rounds, every move used, and the cards your team fired', () => {
    const def = trainerBattle('blitzr', 'spinUp', 'tutorial.c', 0);
    const r = simulate(def.setup, def.seed, { kind: 'scripted', next: naiveCommand });
    const sides = createBattle(def.setup, def.seed).creatures.map((c) => c.side);
    const report = fightReport({ battle: 'trainer', outcome: 'lose', rounds: r.rounds, events: r.events, cardId: 'tutorial.c', kept: ['x'], mine: (i) => sides[i] === 'a' });
    expect(report).toMatchObject({ battle: 'trainer', outcome: 'lose', rounds: r.rounds, cardId: 'tutorial.c', kept: ['x'] });
    expect(report.moves).toBe(r.events.filter((e) => e.type === 'MoveUsed').length);
    expect(report.cardsFired).toBe(r.events.filter((e) => e.type === 'CardTrace' && e.actor === 1).length);
    expect(report.cardsFired).toBeGreaterThan(0);
  });
});

describe('debriefFor: every result has a way forward, and every option is one the flow accepts', () => {
  const cases: Array<[string, FlowState]> = [
    ['spin-up loss', at({})],
    ['spin-up win', at({ trainerBeaten: true, lastFight: fight({ outcome: 'win' }) })],
    ['spin-up loss after an earlier win', at({ trainerBeaten: true })],
    ['graft loss', at({ distill: 'graft', tutorialCardId: null, lastFight: fight({ cardId: null }) })],
    ['graft win', at({ distill: 'graft', tutorialCardId: null, trainerBeaten: true, lastFight: fight({ outcome: 'win', cardId: null }) })],
    ['draw', at({ lastFight: fight({ outcome: 'draw' }) })],
  ];
  it.each(cases)('%s', (_name, state) => {
    const d = debriefFor(state, TOKENIBBLE_PRESETS);
    expect(d.options.length).toBeGreaterThan(0);
    for (const o of d.options) {
      const events: FlowEvent[] = o.kind === 'pickCard' ? d.cards.map((c) => ({ type: 'rematch', cardId: c.id })) : [o.event];
      for (const e of events) expect(transition(state, e).ok, `${o.label}: ${JSON.stringify(e)}`).toBe(true);
    }
  });

  it('a spin-up loss shows what Tokenibble kept doing, then offers a card swap first and a rematch as is', () => {
    const d = debriefFor(at({}), TOKENIBBLE_PRESETS);
    expect(d.title).toBe('TOKENIBBLE KEPT...');
    expect(d.lines).toEqual(fight().kept);
    expect(d.options.map((o) => o.label)).toEqual(['SWAP ITS CARD, THEN REMATCH', 'REMATCH AS IS']);
    // The swap offers the other presets, with the taught one marked.
    expect(d.cards.map((c) => c.id)).toEqual(TOKENIBBLE_PRESETS.map((p) => p.id));
    expect(d.cards.find((c) => c.id === 'tutorial.c')?.label).toMatch(/\(TAUGHT\)$/);
  });

  it('after a win the end comes first; "try a different card?" is optional', () => {
    const d = debriefFor(at({ trainerBeaten: true, lastFight: fight({ outcome: 'win' }) }), TOKENIBBLE_PRESETS);
    expect(d.options.map((o) => o.label)).toEqual(['ON TO THE END', 'TRY A DIFFERENT CARD?']);
    expect(d.options[0]).toMatchObject({ kind: 'event', event: { type: 'finish' } });
  });

  it('a graft loss gives the grafted-move hint and a rematch, with no card to swap', () => {
    const d = debriefFor(at({ distill: 'graft', tutorialCardId: null, lastFight: fight({ cardId: null, kept: ['You never used Token Nibble.', 'hint'] }) }), TOKENIBBLE_PRESETS);
    expect(d.lines).toEqual(['You never used Token Nibble.', 'hint']);
    expect(d.options.map((o) => o.label)).toEqual(['REMATCH']);
    expect(d.cards).toEqual([]);
  });
});

describe('endCardStats', () => {
  it('sums the run: turns, cards fired, the distill choice, the loop counts and the receipt', () => {
    const s = endCardStats({ ...at({ step: 'end', trainerBeaten: true }), telemetry: { ...NO_TELEMETRY, losses: 2, swaps: 1, rematches: 2, turns: 21, moves: 47, cardsFired: 9 } });
    expect(s.lines).toEqual(['Turns played: 21', 'Cards fired: 9', 'Distill: spin up (Tokenibble)', 'Bootcamp Grad: 2 losses -> 1 swap -> 2 rematches']);
    expect(s.receipt).toBe('This run used 11.4 L of virtual water and 0.044 kWh. Offsets purchased: 0.');
  });

  it('reads well with nothing to count, and names the graft', () => {
    const s = endCardStats({ ...at({ step: 'end', distill: 'graft', tutorialCardId: null, trainerBeaten: true }), telemetry: NO_TELEMETRY });
    expect(s.lines).toContain('Distill: graft (Token Nibble)');
    expect(s.lines).toContain('Bootcamp Grad: 0 losses -> 0 swaps -> 0 rematches');
  });
});
