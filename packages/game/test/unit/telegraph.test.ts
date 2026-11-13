import { moveDef, type BattleEvent } from '@latentia/engine';
import { describe, expect, it } from 'vitest';
import { plansFor, type FoePlan } from '../../src/battle/plans.js';
import { BattleSession } from '../../src/battle/session.js';
import { classifyMove, estimate, telegraph, telegraphLine, type IntentCategory } from '../../src/battle/telegraph.js';
import { rivalBattle, trainerBattle, wildBattle, type BattleDef } from '../../src/content/battles.js';
import { TOKENIBBLE_PRESETS } from '../../src/content/trainers.js';
import { STARTERS } from '../../src/flow/flow.js';

// The foe telegraph (ruling V11; Review Focus 3): the category comes from the move's data, "Attack" only for a move
// the engine says deals damage, and "~N" is the midpoint of the engine's own damage range. The probe plays 300+
// random rounds of the v0.1 fights and checks every telegraphed attack against the damage the engine then rolled.

const move = (id: string) => {
  const d = moveDef(id);
  if (d === null) throw new Error(`no move ${id}`);
  return d;
};

describe('classifyMove: every move a v0.1 foe can telegraph', () => {
  const EXPECTED: Readonly<Record<string, IntentCategory>> = {
    'token-burst': 'attack',
    'token-nibble': 'attack',
    'chain-of-thought': 'attack',
    'swarm-of-fine-tunes': 'attack',
    'merge-conflict': 'attack',
    'accept-all': 'attack',
    segfault: 'attack',
    compact: 'special',
    clear: 'special',
    guardrail: 'guard',
    'low-latency': 'buff',
    'step-back-prompt': 'buff',
    'hype-train': 'buff',
    'community-patch': 'buff',
    'early-exit': 'attack',
  };
  it.each(Object.entries(EXPECTED))('%s is %s', (id, category) => {
    const d = move(id);
    expect(classifyMove(d, d.power !== null)).toBe(category);
  });

  it('a move with power is not an attack when the engine previews no damage (a charge round, a self-aimed move)', () => {
    expect(classifyMove(move('ship-it'), false)).not.toBe('attack');
  });
});

describe('the telegraph line', () => {
  const base = { move: move('token-burst'), preview: { min: 5, max: 7 }, selfAimed: false, targetName: 'SAGELET' };
  it('shows the category, ~N (the rounded midpoint) and the target; a reveal shows the exact move', () => {
    expect(telegraphLine(telegraph({ ...base, revealed: false }))).toBe('ATTACK ~6 → SAGELET');
    expect(telegraphLine(telegraph({ ...base, revealed: true }))).toBe('TOKEN BURST ~6 → SAGELET');
    expect(estimate({ min: 4, max: 7 })).toBe(6);
    expect(telegraphLine(telegraph({ ...base, move: move('compact'), preview: null, selfAimed: true, revealed: false }))).toBe('SPECIAL');
    expect(telegraphLine(telegraph({ ...base, move: move('guardrail'), preview: null, selfAimed: true, revealed: false }))).toBe('GUARD');
  });
  it('never shows a "?"', () => {
    expect(telegraphLine(telegraph({ ...base, revealed: false }))).not.toContain('?');
  });
});

/** Seeded choice, so the probe is the same every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    return s / 2 ** 32;
  };
}

const FIGHTS: BattleDef[] = STARTERS.flatMap((s) => [
  rivalBattle(s, 0),
  rivalBattle(s, 1),
  wildBattle(s, 0),
  wildBattle(s, 1),
  ...TOKENIBBLE_PRESETS.map((p) => trainerBattle(s, 'spinUp', p.id, 0)),
  trainerBattle(s, 'graft', null, 0),
]);

/** Events that change what the foe's hit reads, on the attacker or its target, before the attacker acts. */
const DISTURBS = new Set(['StageChanged', 'StatusApplied', 'StatusExpired', 'StatusCured', 'StageStolen', 'Swapped']);

function disturbedBefore(events: readonly BattleEvent[], actor: number, target: number): boolean {
  for (const e of events) {
    if (e.type === 'MoveUsed' && e.actor === actor) return false;
    if (DISTURBS.has(e.type) && 'target' in e && (e.target === actor || e.target === target)) return true;
  }
  return false;
}

describe('the honesty probe (Review Focus 3): 300+ random rounds of the v0.1 fights', () => {
  const next = rng(0x51ca);
  let checked = 0;
  let attacks = 0;
  const failures: string[] = [];
  for (let f = 0; checked < 300 && f < 400; f++) {
    const def = FIGHTS[f % FIGHTS.length] as BattleDef;
    const s = BattleSession.start({ ...def, seed: `${def.seed.slice(0, 28)}${(f * 7919).toString(16).padStart(4, '0').slice(-4)}` });
    for (let round = 0; round < 40 && !s.ended; round++) {
      const plans = plansFor(s).filter((p): p is FoePlan => p.kind === 'foe');
      const pass = s.passReason();
      const options = s.moveOptions();
      const pickMove = options[Math.floor(next() * options.length)];
      const r = pass !== null || pickMove === undefined ? s.pass(2) : s.submit({ temperature: 2, moveId: pickMove.moveId, target: s.targetsFor(pickMove.moveId)[0] ?? 0 });
      if (!r.ok) throw new Error(r.error.message);
      for (const p of plans) {
        const used = r.events.find((e) => e.type === 'MoveUsed' && e.actor === p.actor);
        const t = p.telegraph;
        const planned = r.events.find((e) => e.type === 'IntentsPlanned');
        const plannedMove = planned?.type === 'IntentsPlanned' ? planned.intents.find((i) => i.actor === p.actor) : undefined;
        if (used?.type !== 'MoveUsed' || plannedMove === undefined || used.moveId !== plannedMove.moveId || used.target !== plannedMove.target) continue;
        const dealt = r.events.reduce((n, e) => n + (e.type === 'Damage' && e.actor === p.actor && e.target === used.target ? e.amount : 0), 0);
        checked++;
        if (t.category !== 'attack') {
          if (dealt !== 0) failures.push(`${def.id} r${round}: ${p.line} but dealt ${dealt}`);
          continue;
        }
        const clean = !r.events.some((e) => (e.type === 'Crit' || e.type === 'Missed' || e.type === 'GuardResolved') && e.actor === p.actor) && !r.events.some((e) => e.type === 'ShieldAbsorbed') && !disturbedBefore(r.events, p.actor, used.target);
        if (!clean || t.range === null || t.estimate === null) continue;
        attacks++;
        if (t.estimate < t.range.min || t.estimate > t.range.max) failures.push(`${p.line}: ~${t.estimate} outside ${t.range.min}-${t.range.max}`);
        if (dealt < t.range.min || dealt > t.range.max) failures.push(`${def.id} ${def.setup.a.orchestrator.species} r${round}: ${p.detail} but rolled ${dealt}`);
      }
    }
  }

  it('checks at least 300 telegraphed rounds, at least 150 of them clean attacks', () => {
    expect(checked).toBeGreaterThanOrEqual(300);
    expect(attacks).toBeGreaterThanOrEqual(150);
  });

  it('every clean attack landed inside the telegraphed range, and no non-attack dealt damage', () => {
    expect(failures).toEqual([]);
  });
});
