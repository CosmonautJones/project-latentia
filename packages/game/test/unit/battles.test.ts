import { createBattle, simulate, SPECIES, typeMultiplierBp, validateSetup, type SideSetup } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { battleForStep, counterStarter, rivalBattle, seedFor, trainerBattle, wildBattle, type BattleDef } from '../../src/content/battles.js';
import { BOOTCAMP_GRAD, TOKENIBBLE_PRESETS } from '../../src/content/trainers.js';
import { initialFlow, STARTERS, type FlowState } from '../../src/flow/flow.js';

const allDefs = (): BattleDef[] =>
  STARTERS.flatMap((s) => [
    rivalBattle(s, 0),
    wildBattle(s, 0),
    ...TOKENIBBLE_PRESETS.map((p) => trainerBattle(s, 'spinUp', p.id, 0)),
    trainerBattle(s, 'graft', null, 0),
  ]);

const solo = (side: SideSetup) => side.active.length === 0 && side.bench.length === 0;
const typeOf = (species: string) => SPECIES[species as keyof typeof SPECIES].types;

describe('battle content', () => {
  it.each(allDefs().map((d) => [`${d.id} (${d.setup.a.orchestrator.species})`, d] as const))('%s passes validateSetup and starts', (_name, def) => {
    expect(validateSetup(def.setup)).toEqual({ ok: true, errors: [] });
    expect(() => createBattle(def.setup, def.seed)).not.toThrow();
  });

  it('every battle finishes under the engine round cap on autopilot', () => {
    for (const def of allDefs()) {
      const r = simulate(def.setup, def.seed, { kind: 'autopilot' });
      expect(r.rounds).toBeLessThanOrEqual(50);
    }
  });

  it('Kip counters the starter: Speed > Reasoning > Open > Speed', () => {
    expect(counterStarter('sagelet')).toBe('blitzr');
    expect(counterStarter('forkling')).toBe('sagelet');
    expect(counterStarter('blitzr')).toBe('forkling');
    for (const s of STARTERS) {
      const kip = counterStarter(s);
      const kipType = typeOf(kip)[0];
      if (kipType === undefined) throw new Error('typeless starter');
      expect(typeMultiplierBp(kipType, typeOf(s))).toBeGreaterThan(10000);
    }
  });

  it('the rival fight is L5 vs L5, solo on both sides, Kip on Autopilot and the player commanding', () => {
    for (const s of STARTERS) {
      const { setup, opponent } = rivalBattle(s, 0);
      expect(opponent).toBe('Kip');
      expect(setup.kind).toBe('trainer');
      expect(setup.a.orchestrator).toMatchObject({ species: s, level: 5 });
      expect(setup.b.orchestrator).toMatchObject({ species: counterStarter(s), level: 5 });
      expect(solo(setup.a) && solo(setup.b)).toBe(true);
      expect(setup.a.autopilot).toBeUndefined();
      expect(setup.b.autopilot?.deck.cards.length).toBeGreaterThan(0);
    }
  });

  it('the wild battle is a solo L3 Tokenibble on Autopilot', () => {
    const { setup, opponent } = wildBattle('blitzr', 0);
    expect(opponent).toBeNull();
    expect(setup.kind).toBe('wild');
    expect(setup.b.orchestrator).toMatchObject({ species: 'tokenibble', level: 3 });
    expect(solo(setup.b)).toBe(true);
    expect(setup.b.autopilot).toBeDefined();
  });

  it('the Bootcamp Grad is an Autopilot trainer at L7 against Sagelet and Blitzr and L6 against Forkling', () => {
    expect(BOOTCAMP_GRAD.level).toEqual({ sagelet: 7, blitzr: 7, forkling: 6 });
    for (const starter of STARTERS) {
      for (const distill of ['spinUp', 'graft'] as const) {
        const { setup, opponent } = trainerBattle(starter, distill, 'tutorial.a', 0);
        expect(opponent).toBe('Bootcamp Grad');
        expect(setup.b.orchestrator.level, `${starter} ${distill}`).toBe(BOOTCAMP_GRAD.level[starter]);
        expect(setup.b.autopilot).toBeDefined();
      }
    }
  });

  it('on spin-up against the Bootcamp Grad the player brings Tokenibble with a 1-card deck', () => {
    const preset = TOKENIBBLE_PRESETS[1];
    if (!preset) throw new Error('no preset');
    const { setup } = trainerBattle('forkling', 'spinUp', preset.id, 0);
    expect(setup.a.orchestrator).toMatchObject({ species: 'forkling', level: 5 });
    const [tok] = setup.a.active;
    expect(tok).toMatchObject({ species: 'tokenibble', level: 3 });
    expect(tok?.deck?.cards).toEqual([preset.card]);
    // Spun up, it keeps its three non-signature moves; Token Nibble does not come along (ruling V3).
    expect(tok?.moves).toEqual(['token-burst', 'early-exit', 'low-latency']);
  });

  it('on the graft path the starter fights alone on its preset grid, with Token Nibble grafted on, and the setup is legal', () => {
    for (const s of STARTERS) {
      const { setup } = trainerBattle(s, 'graft', null, 0);
      expect(validateSetup(setup)).toEqual({ ok: true, errors: [] });
      expect(setup.a.active).toEqual([]);
      expect(setup.a.orchestrator.moves).toEqual([]);
      expect(setup.a.grid?.pieces.find((p) => p.kind === 'graft')?.moveId).toBe('token-nibble');
      // A gridded orchestrator's moves are its signature, then its Skill and Graft pieces: Token Nibble is usable.
      expect(createBattle(setup, seedFor('trainer', 0)).creatures[0]?.moves).toContain('token-nibble');
    }
  });

  it('the three tutorial presets are a real choice: one good, one situational, one bad, none using Token Nibble', () => {
    expect(TOKENIBBLE_PRESETS.map((p) => p.verdict).sort()).toEqual(['bad', 'good', 'situational']);
    expect(TOKENIBBLE_PRESETS.map((p) => p.id)).toEqual(['tutorial.a', 'tutorial.b', 'tutorial.c']);
    for (const p of TOKENIBBLE_PRESETS) expect(p.card.move).not.toBe('token-nibble');
    // Measured: with the player only Compacting, how much damage Tokenibble's deck deals the Grad's Vibrat.
    const dealt = (presetId: string): number => {
      let total = 0;
      for (const s of STARTERS) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const def = trainerBattle(s, 'spinUp', presetId, attempt);
          const r = simulate(def.setup, def.seed, { kind: 'scripted', next: (st) => (st.creatures[0]?.fainted ? {} : { a: { temperature: 2, action: { kind: 'move', moveId: 'compact', target: 0 } } }) });
          for (const e of r.events) if (e.type === 'Damage' && e.actor === 1) total += e.amount;
        }
      }
      return total;
    };
    const by = (v: string) => TOKENIBBLE_PRESETS.find((p) => p.verdict === v)?.id ?? '';
    const [good, situational, bad] = [dealt(by('good')), dealt(by('situational')), dealt(by('bad'))];
    expect(good).toBeGreaterThan(situational);
    expect(situational).toBeGreaterThan(bad * 2);
  });

  it('a different attempt gets a different seed; the same attempt the same seed', () => {
    expect(rivalBattle('sagelet', 0).seed).toBe(rivalBattle('sagelet', 0).seed);
    expect(rivalBattle('sagelet', 1).seed).not.toBe(rivalBattle('sagelet', 0).seed);
    expect(wildBattle('sagelet', 0).seed).not.toBe(rivalBattle('sagelet', 0).seed);
  });

  it('battleForStep picks the battle of a flow step, and nothing outside the battles', () => {
    const at = (patch: Partial<FlowState>): FlowState => ({ ...initialFlow(), starter: 'sagelet', ...patch });
    expect(battleForStep(at({ step: 'rival' }))?.id).toBe('rival');
    expect(battleForStep(at({ step: 'wild', attempt: 2 }))?.seed).toBe(wildBattle('sagelet', 2).seed);
    expect(battleForStep(at({ step: 'trainer', distill: 'spinUp', tutorialCardId: 'tutorial.b' }))?.setup.a.active[0]?.deck?.cards[0]?.id).toBe('tutorial.b');
    expect(battleForStep(at({ step: 'distill' }))).toBeNull();
    expect(battleForStep(at({ step: 'walk' }))).toBeNull();
    expect(battleForStep({ ...initialFlow(), step: 'rival' })).toBeNull();
  });
});
