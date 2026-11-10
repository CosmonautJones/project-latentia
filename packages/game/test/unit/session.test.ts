import { describe, expect, it } from 'vitest';
import { rivalBattle, trainerBattle, wildBattle, type BattleDef } from '../../src/content/battles.js';
import { BattleSession } from '../../src/battle/session.js';
import { kipDeck } from '../../src/content/trainers.js';

/** First affordable damaging move at the first foe, else Compact. */
function autoPlay(s: BattleSession, maxRounds = 60): void {
  for (let i = 0; i < maxRounds && !s.ended; i++) {
    if (s.passReason() !== null) {
      const r = s.pass(2);
      if (!r.ok) throw new Error(r.error.message);
      continue;
    }
    const pick = s.moveOptions().find((m) => m.power !== null && m.affordable) ?? s.moveOptions().find((m) => m.moveId === 'compact');
    if (!pick) throw new Error('no move');
    const [target] = s.targetsFor(pick.moveId);
    if (target === undefined) throw new Error('no target');
    const r = s.submit({ temperature: 2, moveId: pick.moveId, target });
    if (!r.ok) throw new Error(r.error.message);
  }
}

describe('BattleSession', () => {
  it('starts from a BattleDef: names, levels, HP and context come from the engine state', () => {
    const s = BattleSession.start(rivalBattle('sagelet', 0));
    const [me, kip] = s.creatures();
    expect(me).toMatchObject({ index: 0, side: 0, name: 'Sagelet', shortName: 'SAGELET', level: 5, isOrchestrator: true, onField: true, fainted: false, ctxUsed: 0, ctxWindow: 12, drift: 0 });
    expect(kip).toMatchObject({ index: 1, side: 1, name: "Kip's Blitzr", shortName: 'BLITZR', level: 5 });
    expect(me?.hp).toBe(me?.maxHp);
    expect(s.round).toBe(0);
    expect(s.ended).toBe(false);
    expect(s.outcome).toBeNull();
  });

  it('knows which side each creature is on', () => {
    const s = BattleSession.start(trainerBattle('sagelet', 'spinUp', 'tutorial.a', 0));
    expect([0, 1, 2].map((i) => s.sideOf(i))).toEqual([0, 0, 1]);
  });

  it('a wild creature is named as wild', () => {
    expect(BattleSession.start(wildBattle('forkling', 0)).name(1)).toBe('Wild Tokenibble');
  });

  it('refuses a setup the engine rejects, with the validation errors in the message', () => {
    const def = rivalBattle('sagelet', 0);
    const bad: BattleDef = { ...def, setup: { ...def.setup, a: { ...def.setup.a, orchestrator: { ...def.setup.a.orchestrator, level: 0 } } } };
    expect(() => BattleSession.start(bad)).toThrow(/a\.orchestrator\.level/);
  });

  it('previews the foe intents before a command', () => {
    const s = BattleSession.start(rivalBattle('sagelet', 0));
    const intents = s.intents();
    expect(intents.map((i) => i.actor)).toEqual([1]);
    expect(['compact', 'token-burst']).toContain(intents[0]?.moveId);
  });

  it("lists the orchestrator's moves with context costs and greys out what will not fit", () => {
    const s = BattleSession.start(rivalBattle('sagelet', 0));
    const moves = s.moveOptions();
    expect(moves.map((m) => m.moveId)).toEqual(['happy-to-help', 'chain-of-thought', 'step-back-prompt', 'proof-by-contradiction', 'compact', 'clear', 'guardrail']);
    expect(moves[0]).toMatchObject({ name: 'Happy to Help', cost: 3, free: 12, affordable: true, power: 70 });
    expect(moves.every((m) => m.affordable)).toBe(true);
    // Fill the window with Happy to Help until it no longer fits.
    for (let i = 0; i < 4 && !s.ended; i++) s.submit({ temperature: 2, moveId: 'happy-to-help', target: 1 });
    if (!s.ended) {
      const opt = s.moveOptions()[0];
      expect(opt?.free).toBeLessThan(3);
      expect(opt?.affordable).toBe(false);
    }
  });

  it('targets: a foe move aims at living foes, a self move at the user', () => {
    const s = BattleSession.start(trainerBattle('forkling', 'spinUp', 'tutorial.a', 0));
    expect(s.targetsFor('hard-fork')).toEqual([2]);
    expect(s.targetsFor('compact')).toEqual([0]);
    // Community Patch is an ally move: the orchestrator or its subagent.
    expect(s.targetsFor('community-patch')).toEqual([0, 1]);
  });

  it('submits a round and returns its events; the read methods never change the engine state', () => {
    const s = BattleSession.start(rivalBattle('blitzr', 0));
    const before = s.fingerprint();
    s.creatures();
    s.intents();
    s.moveOptions();
    s.targetsFor('ship-it');
    s.revealedFoes();
    s.explainLatestTraces();
    expect(s.fingerprint()).toBe(before);
    const r = s.submit({ temperature: 3, moveId: 'ship-it', target: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events[0]).toMatchObject({ type: 'RoundStart', round: 1 });
    expect(s.round).toBe(1);
    expect(s.fingerprint()).not.toBe(before);
  });

  it('a rejected command changes nothing and says why', () => {
    const s = BattleSession.start(rivalBattle('blitzr', 0));
    const before = s.fingerprint();
    const r = s.submit({ temperature: 2, moveId: 'ship-it', target: 0 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe('illegalTarget');
    expect(s.fingerprint()).toBe(before);
  });

  it('keeps every CardTrace for the why popup and knows each deck-driven creature’s deck', () => {
    const s = BattleSession.start(rivalBattle('sagelet', 0));
    expect(s.lastTrace()).toBeNull();
    s.submit({ temperature: 2, moveId: 'guardrail', target: 0 });
    expect(s.lastTrace()?.actor).toBe(1);
    expect(s.traces().length).toBe(1);
    expect(s.deckOf(1)).toEqual(kipDeck('blitzr'));
    expect(s.deckOf(0)).toBeNull();
    expect(s.explainLatestTraces()).toEqual([expect.stringMatching(/^Kip's Blitzr (fired|fell back)/)]);
    // Only the player's teammates count as fired cards; Kip's Autopilot traces do not.
    expect(s.report('lose', null)).toMatchObject({ battle: 'rival', cardsFired: 0, kept: [] });
  });

  it('WHY? only ever explains actions already taken: no trace before the first round, none from a future round', () => {
    const s = BattleSession.start(rivalBattle('forkling', 1));
    expect(s.explainLatestTraces()).toEqual([]);
    for (let i = 0; i < 3 && !s.ended; i++) {
      s.submit({ temperature: 2, moveId: 'compact', target: 0 });
      for (const t of s.traces()) expect(t.round).toBeLessThanOrEqual(s.round);
    }
  });

  it('plays every v0 battle to a result', () => {
    for (const def of [rivalBattle('sagelet', 0), rivalBattle('blitzr', 3), wildBattle('forkling', 0), trainerBattle('sagelet', 'spinUp', 'tutorial.b', 0)]) {
      const s = BattleSession.start(def);
      autoPlay(s);
      expect(s.ended).toBe(true);
      expect(['win', 'lose', 'draw']).toContain(s.outcome);
      expect(s.intents()).toEqual([]);
    }
  });

  it('passes a headless player (orchestrator KO’d, subagent still up) with no command', () => {
    // A frail L1 orchestrator beside a sturdy subagent, against a foe that hits the lowest-HP target.
    const base = trainerBattle('sagelet', 'spinUp', 'tutorial.a', 0);
    const tok = base.setup.a.active[0];
    if (!tok) throw new Error('no subagent');
    const def: BattleDef = {
      ...base,
      setup: {
        ...base.setup,
        a: { ...base.setup.a, orchestrator: { ...base.setup.a.orchestrator, level: 1 }, active: [{ ...tok, level: 20 }] },
        b: {
          ...base.setup.b,
          orchestrator: { ...base.setup.b.orchestrator, level: 20 },
          autopilot: { temperature: 2, deck: { cards: [], default: { id: 'default', subject: 'self', condition: { category: 'turn', op: 'atLeast', round: 1 }, move: 'merge-conflict', target: 'lowestHpFoe' } } },
        },
      },
    };
    const s = BattleSession.start(def);
    for (let i = 0; i < 30 && !s.ended && s.passReason() !== 'headless'; i++) {
      const r = s.passReason() === 'charging' ? s.pass(2) : s.submit({ temperature: 2, moveId: 'compact', target: 0 });
      expect(r.ok).toBe(true);
    }
    expect(s.passReason()).toBe('headless');
    expect(s.pass(2).ok).toBe(true);
  });
});
