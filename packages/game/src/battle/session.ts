// One battle, driven only through the engine's public API: validateSetup → createBattle → getIntents → submitRound.
// The session holds the latest engine state and reads it into plain view data; it never writes to it. The player is
// side A; side B (and any side A subagent) is driven by its deck.

import {
  createBattle,
  getIntents,
  moveDef,
  SPECIES,
  submitRound,
  validateSetup,
  type BattleEvent,
  type BattleState,
  type CardTrace,
  type CommandError,
  type CreatureState,
  type Deck,
  type Intent,
  type Temperature,
  type TypeId,
} from '@latentia/engine';
import type { BattleDef } from '../content/battles.js';
import { explainTrace, summarizeTraces, type TraceContext } from './card-text.js';

export interface CreatureView {
  readonly index: number;
  /** 0 = the player's side, 1 = the opponent's. */
  readonly side: 0 | 1;
  readonly speciesId: string;
  /** "Kip's Blitzr", for messages. */
  readonly name: string;
  /** "BLITZR", for panels and intents. */
  readonly shortName: string;
  readonly types: readonly TypeId[];
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly ctxUsed: number;
  readonly ctxWindow: number;
  readonly drift: number;
  readonly statuses: readonly { readonly id: string; readonly remaining: number }[];
  readonly isOrchestrator: boolean;
  readonly onField: boolean;
  readonly fainted: boolean;
}

export interface MoveOption {
  readonly moveId: string;
  readonly name: string;
  readonly type: string;
  readonly power: number | null;
  readonly accuracy: number | null;
  /** Cells this move costs now (pending Token Nibble-style modifiers and Quantized applied). */
  readonly cost: number;
  /** Free context cells. */
  readonly free: number;
  /** False when the cost overflows the free cells: it still works, but the overflow becomes Drift. */
  readonly affordable: boolean;
}

export interface PlayerChoice {
  readonly temperature: Temperature;
  readonly moveId: string;
  readonly target: number;
}

export type RoundResult = { readonly ok: true; readonly events: readonly BattleEvent[] } | { readonly ok: false; readonly error: CommandError };

export type Outcome = 'win' | 'lose' | 'draw';

/** Why the player has no command to give this round. */
export type PassReason = 'headless' | 'charging';

const speciesName = (id: string): string => SPECIES[id as keyof typeof SPECIES]?.name ?? id;
const moveName = (id: string): string => moveDef(id)?.name ?? id;

/** The cells a move costs `c` now: the engine's pending-cost rule (costSet wins, then each costAdd), then Quantized −1. */
function effectiveCost(c: CreatureState, base: number): number {
  let cells = base;
  for (const m of c.nextActionMods) if (m.kind === 'costSet') cells = m.cells;
  for (const m of c.nextActionMods) if (m.kind === 'costAdd') cells += m.cells;
  if (c.statuses.some((s) => s.id === 'quantized')) cells -= 1;
  return Math.max(0, cells);
}

export class BattleSession {
  private current: BattleState;
  private readonly allTraces: CardTrace[] = [];

  private constructor(readonly def: BattleDef) {
    this.current = createBattle(def.setup, def.seed);
  }

  /** Validates the setup first, so a broken battle definition fails loudly with every engine error. */
  static start(def: BattleDef): BattleSession {
    const v = validateSetup(def.setup);
    if (!v.ok) throw new Error(`battle ${def.id} has an invalid setup: ${v.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
    return new BattleSession(def);
  }

  /** The latest engine state, read-only to every caller. */
  get state(): Readonly<BattleState> {
    return this.current;
  }

  get round(): number {
    return this.current.round;
  }

  get ended(): boolean {
    return this.current.ended;
  }

  get outcome(): Outcome | null {
    const r = this.current.result;
    return r === null ? null : r === 'draw' ? 'draw' : r === 'a' ? 'win' : 'lose';
  }

  /** The player's orchestrator's canonical index (always 0: side A's orchestrator comes first). */
  get playerIndex(): number {
    return 0;
  }

  name(index: number): string {
    const c = this.current.creatures[index];
    if (c === undefined) return '???';
    const species = speciesName(c.speciesId);
    if (c.side === 'a') return species;
    return this.def.opponent === null ? `Wild ${species}` : `${this.def.opponent}'s ${species}`;
  }

  shortName(index: number): string {
    const c = this.current.creatures[index];
    return c === undefined ? '???' : speciesName(c.speciesId).toUpperCase();
  }

  readonly moveName = moveName;

  creatures(): CreatureView[] {
    return this.current.creatures.map((c) => ({
      index: c.index,
      side: c.side === 'a' ? 0 : 1,
      speciesId: c.speciesId,
      name: this.name(c.index),
      shortName: this.shortName(c.index),
      types: SPECIES[c.speciesId as keyof typeof SPECIES]?.types ?? [],
      level: c.level,
      hp: c.hp,
      maxHp: c.maxHp,
      ctxUsed: c.context.tokens.length,
      ctxWindow: c.context.window,
      drift: c.context.drift,
      statuses: c.statuses.map((s) => ({ id: s.id, remaining: s.remaining })),
      isOrchestrator: c.isOrchestrator,
      onField: c.isOrchestrator || c.slot === 'active',
      fainted: c.fainted,
    }));
  }

  /** Every planned intent for the next round (both sides; the scene decides what to show). Empty once ended. */
  intents(): Intent[] {
    return getIntents(this.current);
  }

  /** The player orchestrator's moves, universals last, with what each costs against the free cells now. */
  moveOptions(): MoveOption[] {
    const me = this.current.creatures[this.playerIndex];
    if (me === undefined) return [];
    const free = Math.max(0, me.context.window - me.context.tokens.length);
    return me.moves.flatMap((id) => {
      const d = moveDef(id);
      if (d === null || d.orchestratorOnly === true) return [];
      const cost = effectiveCost(me, d.cost);
      return [{ moveId: id, name: d.name, type: d.type, power: d.power, accuracy: d.accuracy, cost, free, affordable: cost <= free }];
    });
  }

  /** Legal targets for the player's move, in canonical order (the engine re-checks on submit). */
  targetsFor(moveId: string): number[] {
    const d = moveDef(moveId);
    const me = this.current.creatures[this.playerIndex];
    if (d === null || me === undefined) return [];
    if (d.target === 'self' || d.target === 'none') return [me.index];
    const alive = this.current.creatures.filter((c) => !c.fainted && (c.isOrchestrator || c.slot === 'active'));
    if (d.target === 'ally') return alive.filter((c) => c.side === me.side).map((c) => c.index);
    if (d.target === 'other') return alive.filter((c) => c.index !== me.index).map((c) => c.index);
    return alive.filter((c) => c.side !== me.side).map((c) => c.index);
  }

  /** Non-null when the player cannot command this round: their orchestrator is KO'd, or busy releasing a charge. */
  passReason(): PassReason | null {
    if (this.current.ended) return null;
    if (this.current.sides.a.headless) return 'headless';
    return this.current.creatures[this.playerIndex]?.charging != null ? 'charging' : null;
  }

  submit(choice: PlayerChoice): RoundResult {
    return this.play({ a: { temperature: choice.temperature, action: { kind: 'move', moveId: choice.moveId, target: choice.target } } });
  }

  /** The round when the player has no choice to make: a charging orchestrator sends `none`; a headless side nothing. */
  pass(temperature: Temperature): RoundResult {
    return this.play(this.passReason() === 'charging' ? { a: { temperature, action: { kind: 'none' } } } : {});
  }

  private play(cmd: Parameters<typeof submitRound>[1]): RoundResult {
    const r = submitRound(this.current, cmd);
    if ('error' in r) return { ok: false, error: r.error };
    this.current = r.state;
    for (const e of r.events) if (e.type === 'CardTrace') this.allTraces.push(e);
    return { ok: true, events: r.events };
  }

  /** The deck a creature plays from: a subagent's own, an Autopilot orchestrator's side deck; null otherwise. */
  deckOf(index: number): Deck | null {
    const c = this.current.creatures[index];
    if (c === undefined) return null;
    if (!c.isOrchestrator) return c.deck;
    return this.current.sides[c.side].autopilot?.deck ?? null;
  }

  traces(): readonly CardTrace[] {
    return this.allTraces;
  }

  lastTrace(): CardTrace | null {
    return this.allTraces[this.allTraces.length - 1] ?? null;
  }

  private traceContext(): TraceContext {
    return { name: (i) => this.name(i), moveName, deckOf: (i) => this.deckOf(i) };
  }

  /** The last deck-driven action in plain words, or null before any. */
  explainLastTrace(): string | null {
    const t = this.lastTrace();
    return t === null ? null : explainTrace(t, this.traceContext());
  }

  /** The latest trace of each deck-driven creature, in plain words (the "why?" popup). */
  explainLatestTraces(): string[] {
    const latest = new Map<number, CardTrace>();
    for (const t of this.allTraces) latest.set(t.actor, t);
    return [...latest.values()].map((t) => explainTrace(t, this.traceContext()));
  }

  /** What each deck-driven creature (of one side, if given) kept doing all battle: the loss summary. */
  traceSummary(side: 0 | 1 | null = null): string[] {
    const sideId = side === null ? null : side === 0 ? 'a' : 'b';
    const traces = this.allTraces.filter((t) => sideId === null || this.current.creatures[t.actor]?.side === sideId);
    return summarizeTraces(traces, this.traceContext());
  }
}
