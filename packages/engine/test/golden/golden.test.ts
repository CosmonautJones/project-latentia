import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, type BattleLog } from '../../src/battle/log.js';
import { replay } from '../../src/battle/replay.js';
import { ROBUST_MIN_GENERALIZATION } from '../../src/battle/resolve.js';
import { createBattle, UNIVERSAL_MOVES } from '../../src/battle/setup.js';
import { simulate, type BattleResult } from '../../src/battle/simulate.js';
import type { Outcome } from '../../src/battle/state.js';
import { STATUS_IDS, type StatusId } from '../../src/content/ids.js';
import { moveDef, MOVES } from '../../src/content/moves.js';
import type { Effect } from '../../src/content/primitives.js';
import { SPECIES } from '../../src/content/species.js';
import { HANDOFF_MAX_BP, HANDOFF_STEP_BP } from '../../src/battle/handoff.js';
import type { BattleEventType, CardSkipReason } from '../../src/events/types.js';
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
 * Moves a battle can only reach through a deck (none: every species move is also usable by a gridless
 * orchestrator of that species, so commands reach them all).
 */
const DECK_ONLY_MOVES: readonly string[] = [];

/** Every move a Phase A creature can know: each slice species' four moves (signature included) and the universal moves. */
function reachableMoves(): string[] {
  const moves = new Set<string>(UNIVERSAL_MOVES);
  for (const s of Object.values(SPECIES)) for (const m of s.moves) moves.add(m);
  return [...moves].filter((m) => !DECK_ONLY_MOVES.includes(m)).sort();
}

/**
 * Registry moves no legal battle can use, so no golden can (Ruling 110): no slice species knows them. A creature may
 * list only its species' moves (validateSetup moveNotKnown), a gridded orchestrator may graft only species signatures,
 * deck and Policy Update cards fire only moves their creature knows, and hallucination, Drift, copies and Prompt
 * Injected all pick from the user's own moveset. They are the bible's launch moves outside the slice's 17 species;
 * the coverage test checks this list is exactly the registry moves no slice species knows.
 */
const UNLEARNABLE_MOVES: readonly string[] = [
  'captcha-wall', 'deep-research', 'deepfake-call', 'deliberate', 'earnest-apology', 'embedding-cache', 'filibuster', 'fork', 'permissive-license',
  'pixel-peep', 'red-team', 'refusal', 'saliency-map', 'screenshot', 'speculative-decoding', 'temperature-spike', 'throttle', 'tree-search',
];

/** The lever ids (Ruling 90: Directive and Policy Update also emit MoveUsed with these ids; Swap and none do not). */
const LEVER_IDS = { directive: 'directive', policyUpdate: 'policy-update', swap: 'swap', none: 'none' } as const;

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

/** Every reason a card can be skipped, so the list below is checked complete by the type checker. */
const SKIP_REASONS: Record<CardSkipReason, true> = { conditionFalse: true, insufficientContext: true, moveDisabled: true, notActive: true, disobeyed: true };

/** The golden named `name` and its replayed events. */
function goldenNamed(name: string): { golden: Golden; events: BattleResult['events'] } {
  const at = GOLDENS.findIndex((g) => g.file === name);
  const golden = GOLDENS[at]?.golden;
  if (golden === undefined) throw new Error(`missing golden ${name}`);
  return { golden, events: replays()[at]?.events ?? [] };
}

describe('golden coverage', () => {
  it('golden coverage includes every move and every lever: every MoveUsed id and lever that took effect, against the move registry (Ruling 110)', () => {
    // Directive and Policy Update count by their MoveUsed (emitted only when the lever resolves); a Swap only when its
    // Swapped event follows the orchestrator's ActionStarted with the commanded creatures (Ruling 115); `none` by command.
    const used = new Set(replays().flatMap((r) => r.events.flatMap((e) => (e.type === 'MoveUsed' ? [e.moveId] : []))));
    GOLDENS.forEach(({ golden }, g) => {
      const events = replays()[g]?.events ?? [];
      const orch = (side: 'a' | 'b'): number => createBattle(golden.log.setup, golden.log.seed).creatures.find((c) => c.side === side && c.isOrchestrator)?.index ?? -1;
      golden.log.rounds.forEach((cmd, i) => {
        for (const side of ['a', 'b'] as const) {
          const action = cmd[side]?.action;
          if (action?.kind === 'none') used.add(LEVER_IDS.none);
          if (action?.kind !== 'swap') continue;
          const at = events.findIndex((e) => e.type === 'ActionStarted' && e.round === i + 1 && e.actor === orch(side));
          const next = events[at + 1];
          if (at >= 0 && next?.type === 'Swapped' && next.outIndex === action.out && next.inIndex === action.in) used.add(LEVER_IDS.swap);
        }
      });
    });
    expect(Object.values(LEVER_IDS).filter((id) => !used.has(id))).toEqual([]);
    const registry = Object.keys(MOVES).sort();
    expect(registry.filter((m) => !used.has(m))).toEqual([...UNLEARNABLE_MOVES]);
    const learnable = new Set(reachableMoves());
    expect(registry.filter((m) => !learnable.has(m) && !Object.values(LEVER_IDS).includes(m as never))).toEqual([...UNLEARNABLE_MOVES]);
  });

  it('handoff-chain-high-damage: 3-hit chains whose 2nd and 3rd hits are large enough to pin 11500 and 13000 (Ruling 97)', () => {
    expect([HANDOFF_STEP_BP, HANDOFF_MAX_BP]).toEqual([1500, 13000]);
    const { events } = goldenNamed('handoff-chain-high-damage');
    const chains = events.flatMap((e, i) => (e.type === 'HandoffChain' && e.chain.length === 3 ? [i] : []));
    expect(chains.length).toBeGreaterThan(0);
    for (const at of chains) {
      // The chain's hits, in order: the Damage event just before each of its HandoffChain events.
      const chain = events[at];
      if (chain?.type !== 'HandoffChain') throw new Error('not a chain');
      const hits = chain.chain.map((actor) => events.slice(0, at + 1).reverse().find((e) => e.type === 'Damage' && e.actor === actor && e.round === chain.round));
      expect(new Set(hits.map((h) => (h?.type === 'Damage' ? h.target : -1))).size).toBe(1);
      // A hit's damage is about x·m/10000 for its pre-Handoff damage x. Ruling 39's 11000 / 12000 would differ from
      // 11500 / 13000 by x/20 and x/10, so neither can floor to the same amount once x ≥ 20 — i.e. a 2nd hit of 24+.
      for (const h of hits.slice(1)) expect(h?.type === 'Damage' ? h.amount : 0).toBeGreaterThanOrEqual(24);
    }
  });

  it('default-disabled-fallback: a status disables the Default card — it is traced moveDisabled once and the default intent acts (Ruling 86)', () => {
    const { golden, events } = goldenNamed('default-disabled-fallback');
    const deck = golden.log.setup.a.active[0]?.deck;
    if (deck === undefined) throw new Error('no deck');
    const traces = events.filter((e) => e.type === 'CardTrace' && e.skipped.some((k) => k.cardId === deck.default.id && k.reason === 'moveDisabled'));
    expect(traces.length).toBeGreaterThan(0);
    for (const t of traces) {
      if (t.type !== 'CardTrace') continue;
      expect(t.firedCardId).toBe(deck.default.id);
      expect(t.skipped.filter((k) => k.cardId === deck.default.id)).toEqual([{ cardId: deck.default.id, reason: 'moveDisabled' }]);
      const used = events.find((e) => e.type === 'MoveUsed' && e.round === t.round && e.actor === t.actor);
      expect(used?.type === 'MoveUsed' ? used.moveId : null).not.toBe(deck.default.move);
    }
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

  it('every event type occurs in some golden battle', () => {
    const seen = new Set(replays().flatMap((r) => r.events.map((e) => e.type)));
    expect((Object.keys(EVENT_TYPES) as BattleEventType[]).filter((t) => !seen.has(t))).toEqual([]);
  });

  it('deck battles trace every skip reason, and IntentsPlanned names deck cards (B2)', () => {
    const events = replays().flatMap((r) => r.events);
    const traced = new Set(events.flatMap((e) => (e.type === 'CardTrace' ? e.skipped.map((s) => s.reason) : [])));
    expect((Object.keys(SKIP_REASONS) as CardSkipReason[]).filter((r) => !traced.has(r))).toEqual([]);
    expect(events.some((e) => e.type === 'IntentsPlanned' && e.intents.some((i) => i.cardId !== null))).toBe(true);
  });

  it('policy-update-and-directive: the policy is in force for rounds 1-3 only; the first Directive is spent, the second lands (B3)', () => {
    const at = GOLDENS.findIndex((g) => g.file === 'policy-update-and-directive');
    const golden = GOLDENS[at]?.golden;
    const events = replays()[at]?.events ?? [];
    if (golden === undefined) throw new Error('missing golden');
    const policy = golden.log.rounds[0]?.a?.action;
    if (policy?.kind !== 'policyUpdate') throw new Error('round 1 is not a Policy Update');
    const traced = events.flatMap((e) => (e.type === 'CardTrace' && (e.firedCardId === policy.card.id || e.skipped.some((k) => k.cardId === policy.card.id)) ? [e.round] : []));
    expect([...new Set(traced)]).toEqual([1, 2, 3]);
    expect(events.some((e) => e.type === 'CardTrace' && e.round === 1 && e.firedCardId === policy.card.id)).toBe(true);
    // A Directive landed when the directed subagent used the directed move that round, not from its deck.
    const landed = golden.log.rounds.flatMap((cmd, i) => {
      const a = cmd.a?.action;
      if (a?.kind !== 'directive') return [];
      const mine = events.filter((e) => e.round === i + 1 && 'actor' in e && e.actor === a.subagent);
      return [mine.some((e) => e.type === 'MoveUsed' && e.moveId === a.moveId) && !mine.some((e) => e.type === 'CardTrace')];
    });
    expect(landed).toEqual([false, true]);
  });

  it('autopilot-both-sides: every round is {}, and both orchestrators are listed in IntentsPlanned and traced (B4)', () => {
    const at = GOLDENS.findIndex((g) => g.file === 'autopilot-both-sides');
    const golden = GOLDENS[at]?.golden;
    const events = replays()[at]?.events ?? [];
    if (golden === undefined) throw new Error('missing golden');
    expect(golden.log.rounds.every((cmd) => Object.keys(cmd).length === 0)).toBe(true);
    const orchs = createBattle(golden.log.setup, golden.log.seed).creatures.filter((c) => c.isOrchestrator).map((c) => c.index);
    for (const o of orchs) {
      expect(events.some((e) => e.type === 'IntentsPlanned' && e.intents.some((i) => i.actor === o && i.cardId !== null))).toBe(true);
      expect(new Set(events.flatMap((e) => (e.type === 'CardTrace' && e.actor === o ? [e.firedCardId] : []))).size).toBeGreaterThan(1);
    }
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

  it('the logs pull every lever at every temperature, and the outcomes include a cap and a draw', () => {
    const commands = GOLDENS.flatMap((g) => g.golden.log.rounds);
    const sides = commands.flatMap((c) => [c.a, c.b]);
    const given = sides.flatMap((sc) => (sc === undefined ? [] : [sc]));
    expect(new Set(given.map((sc) => sc.action.kind))).toEqual(new Set(['move', 'swap', 'directive', 'policyUpdate', 'none']));
    expect(given.some((sc) => sc.action.kind === 'move' && sc.action.injection !== undefined)).toBe(true);
    expect(sides.some((sc) => sc === undefined)).toBe(true);
    expect(new Set(given.map((sc) => sc.temperature))).toEqual(new Set([0, 1, 2, 3, 4]));
    expect(GOLDENS.some((g) => g.golden.log.setup.a.grid !== null || g.golden.log.setup.b.grid !== null)).toBe(true);
    expect(new Set(GOLDENS.map((g) => g.golden.winner))).toEqual(new Set(['a', 'b', 'draw']));
    expect(GOLDENS.some((g) => g.golden.rounds === 50)).toBe(true);
  });
});
