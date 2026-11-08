import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, type BattleLog } from '../../src/battle/log.js';
import { replay } from '../../src/battle/replay.js';
import { ROBUST_MIN_GENERALIZATION } from '../../src/battle/resolve.js';
import { createBattle, UNIVERSAL_MOVES } from '../../src/battle/setup.js';
import { simulate, type BattleResult } from '../../src/battle/simulate.js';
import type { Outcome } from '../../src/battle/state.js';
import { STATUS_IDS, type StatusId } from '../../src/content/ids.js';
import { moveDef } from '../../src/content/moves.js';
import type { Effect } from '../../src/content/primitives.js';
import { SPECIES } from '../../src/content/species.js';
import type { BattleEventType } from '../../src/events/types.js';
import { SCENARIOS } from './scenarios.js';
import { scriptedSource } from './script.js';

// The golden battles (spec §2 criteria 1-2, §8 "Golden files"): each test/golden/<name>.json holds a
// recorded battle's log and its expected event-stream hash. This file runs on Node and in the browser
// (Chromium, WebKit), so the same hashes are checked on every runtime. The JSON is loaded with
// import.meta.glob (no node:fs). Re-record with `pnpm golden:record --update` after an intended change.

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { eager: true; import: 'default' }): Record<string, T>;
  }
}

type Golden = { name: string; log: BattleLog; expectedHash: string; rounds: number; winner: Outcome };

const GOLDENS: { file: string; golden: Golden }[] = Object.entries(import.meta.glob<Golden>('./*.json', { eager: true, import: 'default' }))
  .map(([path, golden]) => ({ file: path.replace(/^\.\//, '').replace(/\.json$/, ''), golden }))
  .sort((x, y) => (x.file < y.file ? -1 : x.file > y.file ? 1 : 0));

let replayed: BattleResult[] | null = null;
/** Every golden replayed once, shared by the coverage tests. */
function replays(): BattleResult[] {
  replayed ??= GOLDENS.map(({ file, golden }) => {
    const r = replay(golden.log);
    if ('error' in r) throw new Error(`${file}: replay failed (${r.error.code})`);
    return r;
  });
  return replayed;
}

describe('golden files', () => {
  it('there is exactly one golden per scenario, named after it', () => {
    expect(GOLDENS.map((g) => g.file)).toEqual(SCENARIOS.map((s) => s.name).sort());
    for (const { file, golden } of GOLDENS) expect(golden.name).toBe(file);
  });

  for (const { file, golden } of GOLDENS) {
    it(`${file}: replay reproduces the expected hash, rounds and winner`, () => {
      expect(golden.log.engineVersion).toBe(ENGINE_VERSION);
      const r = replay(golden.log);
      if ('error' in r) throw new Error(`replay failed (${r.error.code})`);
      expect(r.hash).toBe(golden.expectedHash);
      expect(r.rounds).toBe(golden.rounds);
      expect(r.winner).toBe(golden.winner);
    });
  }

  it('every scenario re-simulates to its recorded log and hash', () => {
    for (const s of SCENARIOS) {
      const golden = GOLDENS.find((g) => g.file === s.name)?.golden;
      const r = simulate(s.setup, s.seed, scriptedSource(s.scripts));
      expect({ name: s.name, log: r.log, hash: r.hash }).toEqual({ name: s.name, log: golden?.log, hash: golden?.expectedHash });
    }
  });
});

// --- coverage ----------------------------------------------------------------------------------

/**
 * Moves a Phase A battle can only reach through a deck (none: subagents use their default intent and every
 * species move is also usable by a gridless orchestrator of that species, so commands reach them all).
 */
const DECK_ONLY_MOVES: readonly string[] = [];

/** Every move a Phase A creature can know: each slice species' four moves (signature included) and the universal moves. */
function reachableMoves(): string[] {
  const moves = new Set<string>(UNIVERSAL_MOVES);
  for (const s of Object.values(SPECIES)) for (const m of s.moves) moves.add(m);
  return [...moves].filter((m) => !DECK_ONLY_MOVES.includes(m)).sort();
}

/**
 * Statuses no Phase A battle can apply, each for a stated reason. Anything not listed here must appear.
 * - promptInjected: only Deepfake Call applies it, and no slice species knows Deepfake Call.
 * - rateLimited: only Throttle applies it, and no slice species knows Throttle.
 * - deprecated, quantized: no move or passive applies them yet (they are cured by Hotfix / Refactor).
 */
const UNREACHABLE_STATUSES: readonly StatusId[] = ['promptInjected', 'rateLimited', 'deprecated', 'quantized'];

/** Statuses some reachable move (any temperature) or species passive applies, plus Drift (gained by context overflow). */
function reachableStatuses(): StatusId[] {
  const out = new Set<StatusId>(['drift']);
  const scan = (effects: readonly Effect[] | undefined): void => {
    for (const e of effects ?? []) {
      if (e.kind === 'applyStatus') out.add(e.status);
      if (e.kind === 'passive') scan(e.effects);
    }
  };
  for (const m of reachableMoves()) {
    const def = moveDef(m);
    scan(def?.effects);
    scan(def?.wild);
    scan(def?.wildT4);
  }
  for (const s of Object.values(SPECIES)) scan(s.passives);
  return STATUS_IDS.filter((s) => out.has(s));
}

/** Every event type, so the list below is checked complete by the type checker. */
const EVENT_TYPES: Record<BattleEventType, true> = {
  RoundStart: true, IntentsPlanned: true, ActionStarted: true, CardTrace: true, MoveUsed: true, Missed: true, Damage: true, Crit: true,
  TypeEffect: true, StatusApplied: true, StatusBlocked: true, StatusExpired: true, StatusCured: true, StageChanged: true, StageStolen: true,
  Healed: true, ActionSkipped: true, GuardResolved: true, ShieldAbsorbed: true, FieldEffectStarted: true, FieldEffectEnded: true,
  Revealed: true, ContextAdded: true, DriftChanged: true, Compacted: true, PieceCompacted: true, ObservationGained: true,
  HandoffChain: true, Swapped: true, Fainted: true, HeadlessMode: true, BrittleRepeat: true, RoundEnd: true, BattleEnd: true,
};

/** Event types the Phase A engine never emits: decks, intents and traces arrive in B2/B3, Brittle generalization in B5. */
const PHASE_B_EVENTS: readonly BattleEventType[] = ['IntentsPlanned', 'CardTrace', 'BrittleRepeat'];

describe('golden coverage', () => {
  it('every reachable move is used in some golden battle', () => {
    const used = new Set(replays().flatMap((r) => r.events.flatMap((e) => (e.type === 'MoveUsed' ? [e.moveId] : []))));
    expect(reachableMoves().filter((m) => !used.has(m))).toEqual([]);
  });

  it('every status id is applied in some golden battle, except the stated unreachable ones', () => {
    const reachable = reachableStatuses();
    expect([...reachable, ...UNREACHABLE_STATUSES].sort()).toEqual([...STATUS_IDS].sort());
    const applied = new Set<string>();
    for (const e of replays().flatMap((r) => r.events)) {
      if (e.type === 'StatusApplied') applied.add(e.status);
      if (e.type === 'DriftChanged' && e.drift > 0) applied.add('drift');
    }
    expect(reachable.filter((s) => !applied.has(s))).toEqual([]);
  });

  it('every event type the Phase A engine emits occurs in some golden battle', () => {
    const seen = new Set(replays().flatMap((r) => r.events.map((e) => e.type)));
    const expected = (Object.keys(EVENT_TYPES) as BattleEventType[]).filter((t) => !PHASE_B_EVENTS.includes(t));
    expect(expected.filter((t) => !seen.has(t))).toEqual([]);
  });

  it('a T4-trained subagent uses a move with a wildT4 list, a Robust subagent has recordedFoes, and a side starts with no active subagent (Ruling 77)', () => {
    let wildT4 = false;
    GOLDENS.forEach(({ golden }, g) => {
      const state = createBattle(golden.log.setup, golden.log.seed);
      const t4 = state.creatures.filter((c) => !c.isOrchestrator && c.trainedTemperature === 4).map((c) => c.index);
      const used = (replays()[g]?.events ?? []).filter((e) => e.type === 'MoveUsed' && t4.includes(e.actor));
      if (used.some((e) => e.type === 'MoveUsed' && moveDef(e.moveId)?.wildT4 !== undefined)) wildT4 = true;
    });
    expect(wildT4).toBe(true);
    const subagents = GOLDENS.flatMap((g) => [g.golden.log.setup.a, g.golden.log.setup.b]).flatMap((s) => [...s.active, ...s.bench]);
    expect(subagents.some((c) => (c.generalization ?? 0) >= ROBUST_MIN_GENERALIZATION && (c.recordedFoes ?? []).length > 0)).toBe(true);
    expect(GOLDENS.some((g) => g.golden.log.setup.a.active.length === 0 || g.golden.log.setup.b.active.length === 0)).toBe(true);
  });

  it('the logs pull every Phase A lever at every temperature, and the outcomes include a cap and a draw', () => {
    const commands = GOLDENS.flatMap((g) => g.golden.log.rounds);
    const sides = commands.flatMap((c) => [c.a, c.b]);
    const given = sides.flatMap((sc) => (sc === undefined ? [] : [sc]));
    // Policy Update is not covered: it has no effect until B3, which adds it (Ruling 72).
    expect(new Set(given.map((sc) => sc.action.kind))).toEqual(new Set(['move', 'swap', 'directive', 'none']));
    expect(given.some((sc) => sc.action.kind === 'move' && sc.action.injection !== undefined)).toBe(true);
    expect(sides.some((sc) => sc === undefined)).toBe(true);
    expect(new Set(given.map((sc) => sc.temperature))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(GOLDENS.some((g) => g.golden.log.setup.a.grid !== null || g.golden.log.setup.b.grid !== null)).toBe(true);
    expect(new Set(GOLDENS.map((g) => g.golden.winner))).toEqual(new Set(['a', 'b', 'draw']));
    expect(GOLDENS.some((g) => g.golden.rounds === 50)).toBe(true);
  });
});
