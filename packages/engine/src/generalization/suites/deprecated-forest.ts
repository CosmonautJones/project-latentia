import type { BattleView, FieldKind, ViewCreature } from '../../cards/model.js';
import type { StatusId } from '../../content/ids.js';
import { deepFreeze, STAGE_STATS, type StageStat } from '../../content/primitives.js';
import { SPECIES, type SpeciesId } from '../../content/species.js';
import { effectiveStat, hpAt, statAt } from '../../math/stats.js';
import type { EvalScenario, EvalSuite, WastefulRule } from '../model.js';

// The Deprecated Forest Eval Suite (spec §5 "Generalization", Ruling 105): the slice's 12 held-out ("Unseen")
// scenarios, south to north along Route 1 (bible "Deprecated Forest band"). Each is plain data: a frozen BattleView
// built once at module load by the tiny builder below (no rng, no battle) plus the wasteful rules that apply there.
// Each scenario is written around one condition category, so the 12 together exercise all of them; four are traps,
// one per wasteful rule, where an obvious card wastes its action.
//
// Layout of every view: 0 your orchestrator, 1 the subagent whose deck is evaluated (the actor), 2 your other
// subagent when there is one, then the foes — the wild model or the trainer's orchestrator first. HP and Compute
// come from the species' placeholder stats at the stated level (content/species.ts); context windows are the
// species' own.

/** One creature: its species and level, and what differs from a fresh, full-HP, unbuffed, status-free one. */
type Mon = {
  species: SpeciesId;
  level: number;
  hp?: number;
  statuses?: StatusId[];
  stages?: Partial<Record<StageStat, number>>;
  lastMove?: string;
  telegraphing?: true;
  contextUsed?: number;
  junk?: number;
  fields?: FieldKind[];
};

type Spec = {
  id: string;
  round: number;
  /** The actor's round-start draws: the coin is hi(r1, 2), the randomFoe pick lo(r2, foes). */
  roundStart: { r1: number; r2: number };
  orchestrator: Mon;
  /** The actor; its lastMove and lastMoveId come from `history`. */
  actor: Mon;
  ally?: Mon;
  foes: Mon[];
  /** The actor's moveHistory as the last round each move was used, in first-use order. */
  history?: { moveId: string; round: number }[];
  /** The foe (position in `foes`) your orchestrator last aimed at. */
  aim?: number;
  wasteful: WastefulRule['kind'][];
};

function creature(index: number, m: Mon, isOrchestrator: boolean, lastMove: string | null): ViewCreature {
  const sp = SPECIES[m.species];
  const stages = {} as Record<StageStat, number>;
  for (const s of STAGE_STATS) stages[s] = m.stages?.[s] ?? 0;
  const maxHp = hpAt(sp.base.hp, m.level);
  return {
    index,
    isOrchestrator,
    hp: m.hp ?? maxHp,
    maxHp,
    types: [...sp.types],
    statuses: m.statuses ?? [],
    stages,
    compute: effectiveStat(statAt(sp.base.compute, m.level), stages.compute),
    lastMove,
    telegraphing: m.telegraphing === true,
    contextUsed: m.contextUsed ?? 0,
    contextWindow: sp.ctx,
    junk: m.junk ?? 0,
    fields: m.fields ?? [],
  };
}

function scenario(s: Spec): EvalScenario {
  const history = (s.history ?? []).map((u) => ({ moveId: u.moveId, round: u.round }));
  let latest: { moveId: string; round: number } | null = null;
  for (const u of history) if (latest === null || u.round > latest.round) latest = u;
  const last = latest?.moveId ?? null;
  const orch = creature(0, s.orchestrator, true, s.orchestrator.lastMove ?? null);
  const self = creature(1, s.actor, false, last);
  const allies = s.ally === undefined ? [orch] : [orch, creature(2, s.ally, false, s.ally.lastMove ?? null)];
  const first = allies.length + 1;
  const foes = s.foes.map((m, i) => creature(first + i, m, i === 0, m.lastMove ?? null));
  const view: BattleView = {
    round: s.round,
    roundStart: { r1: s.roundStart.r1, r2: s.roundStart.r2 },
    self,
    orchestrator: orch,
    allies,
    foes,
    orchestratorTarget: s.aim === undefined ? null : first + s.aim,
    selfLastUsed: history,
    lastMoveId: last,
    pendingCost: [],
  };
  return { id: s.id, view, wasteful: s.wasteful.map((kind) => ({ kind })) };
}

const SCENARIOS: Spec[] = [
  // hp — Trailhead: your first wild battle; two Null Chomps have left your Blitzr at 4/20.
  {
    id: 'trailhead-wild-nullbeetle',
    round: 4,
    roundStart: { r1: 0x0004_0001, r2: 0x0000_0002 },
    orchestrator: { species: 'sagelet', level: 5 },
    actor: { species: 'blitzr', level: 5, hp: 4, contextUsed: 4 },
    history: [{ moveId: 'ship-it', round: 2 }, { moveId: 'token-burst', round: 3 }],
    foes: [{ species: 'nullbeetle', level: 3, hp: 12, lastMove: 'null-chomp' }],
    wasteful: ['healAtFull'],
  },
  // coin — First brush: a skittish Heisenmoth and its Nullbeetle companion; the seeded coin lands heads.
  {
    id: 'first-brush-heisenmoth',
    round: 2,
    roundStart: { r1: 0x0001_0005, r2: 0x0000_0001 },
    orchestrator: { species: 'sagelet', level: 5 },
    actor: { species: 'forkling', level: 5, contextUsed: 2 },
    history: [{ moveId: 'hard-fork', round: 1 }],
    foes: [
      { species: 'heisenmoth', level: 3, lastMove: 'refactor' },
      { species: 'nullbeetle', level: 3, hp: 11, lastMove: 'null-chomp' },
    ],
    wasteful: [],
  },
  // turn — Switchbacks: the Bootcamp Grad's pinch, round 1, before anyone has moved.
  {
    id: 'switchbacks-bootcamp-grad',
    round: 1,
    roundStart: { r1: 0x0000_0003, r2: 0x0000_0007 },
    orchestrator: { species: 'sagelet', level: 5 },
    actor: { species: 'blitzr', level: 5 },
    foes: [
      { species: 'nullbeetle', level: 4 },
      { species: 'heisenmoth', level: 4 },
    ],
    wasteful: ['buffAtMax'],
  },
  // foeType — Switchbacks: the Retro Collector leads a Memory-type Deprecatter, backed by a Cobolt.
  {
    id: 'switchbacks-retro-collector',
    round: 3,
    roundStart: { r1: 0x0006_0002, r2: 0x0001_0003 },
    orchestrator: { species: 'sagelet', level: 5 },
    actor: { species: 'forkling', level: 5, hp: 15, contextUsed: 4 },
    ally: { species: 'blitzr', level: 5, hp: 14, contextUsed: 2, lastMove: 'ship-it' },
    history: [{ moveId: 'swarm-of-fine-tunes', round: 1 }, { moveId: 'leaderboard-flex', round: 2 }],
    foes: [
      { species: 'deprecatter', level: 5, hp: 13, lastMove: 'nostalgia-trip' },
      { species: 'cobolt', level: 5, lastMove: 'batch-job' },
    ],
    wasteful: ['healAtFull'],
  },
  // cooldown — The Abandoned Repo: Alpha Cobolt guards the pocket; your Hard Fork was two rounds ago.
  {
    id: 'abandoned-repo-alpha-cobolt',
    round: 4,
    roundStart: { r1: 0x0008_0004, r2: 0x0000_0009 },
    orchestrator: { species: 'sagelet', level: 6, lastMove: 'chain-of-thought' },
    actor: { species: 'forkling', level: 6, hp: 17, contextUsed: 4 },
    ally: { species: 'tokenibble', level: 5, contextUsed: 3, lastMove: 'token-burst' },
    history: [{ moveId: 'hard-fork', round: 2 }, { moveId: 'swarm-of-fine-tunes', round: 3 }],
    foes: [{ species: 'cobolt', level: 8, hp: 27, lastMove: 'batch-job' }],
    aim: 0,
    wasteful: [],
  },
  // allyHp — The Sunset Server's heal bench. Trap (healAtFull): lowestHpAlly reads absolute HP, so it picks the
  // actor (Tokenibble, 13/13) over your hurt orchestrator (Cobolt, 14/32).
  {
    id: 'sunset-server-bench',
    round: 5,
    roundStart: { r1: 0x000a_0006, r2: 0x0002_0001 },
    orchestrator: { species: 'cobolt', level: 8, hp: 14, lastMove: 'batch-job' },
    actor: { species: 'tokenibble', level: 2, contextUsed: 3 },
    ally: { species: 'forkling', level: 6, contextUsed: 2, lastMove: 'hard-fork' },
    history: [{ moveId: 'token-nibble', round: 3 }, { moveId: 'token-burst', round: 4 }],
    foes: [{ species: 'embeddingo', level: 5, lastMove: 'cosine-sniff' }],
    aim: 0,
    wasteful: ['healAtFull'],
  },
  // field — Legacy-cache brush: the wild Off-By-Wasp is leaking memory (it holds the Junk field); your context
  // holds only cost tokens. Trap (compactWhenEmpty): Compact reads "a field is up" as "my context is dirty".
  {
    id: 'legacy-cache-memory-leak',
    round: 3,
    roundStart: { r1: 0x0002_000a, r2: 0x0001_0001 },
    orchestrator: { species: 'sagelet', level: 5, lastMove: 'chain-of-thought' },
    actor: { species: 'nullbeetle', level: 4, hp: 16, contextUsed: 2 },
    history: [{ moveId: 'null-chomp', round: 2 }],
    foes: [{ species: 'off-by-wasp', level: 5, hp: 13, contextUsed: 3, junk: 2, fields: ['junkPerRound'], lastMove: 'stack-trace' }],
    wasteful: ['compactWhenEmpty'],
  },
  // foeBuffed — Legacy-cache brush: a wild Stochastiparrot (mimic) has repeated your Hype Train. Trap (buffAtMax):
  // your own Compute is already +3.
  {
    id: 'legacy-cache-stochastiparrot',
    round: 4,
    roundStart: { r1: 0x000c_0003, r2: 0x0000_0005 },
    orchestrator: { species: 'sagelet', level: 5 },
    actor: { species: 'stochastiparrot', level: 5, hp: 16, contextUsed: 4, stages: { compute: 3, accuracy: -2 } },
    history: [{ moveId: 'hype-train', round: 3 }],
    foes: [{ species: 'stochastiparrot', level: 5, contextUsed: 2, stages: { compute: 2, accuracy: -1 }, lastMove: 'stochastic-repeat' }],
    wasteful: ['buffAtMax'],
  },
  // telegraphing — Legacy-cache brush: the optional Prompt Engineer's Sagelet is charging a grafted Deliberate.
  {
    id: 'legacy-cache-prompt-engineer',
    round: 4,
    roundStart: { r1: 0x0004_0008, r2: 0x0003_0002 },
    orchestrator: { species: 'sagelet', level: 6, lastMove: 'happy-to-help' },
    actor: { species: 'blitzr', level: 6, hp: 18, contextUsed: 3 },
    ally: { species: 'forkling', level: 6, hp: 20, contextUsed: 2, lastMove: 'leaderboard-flex' },
    history: [{ moveId: 'ship-it', round: 2 }, { moveId: 'distilled-strike', round: 3 }],
    foes: [
      { species: 'sagelet', level: 7, telegraphing: true, lastMove: 'chain-of-thought' },
      { species: 'stochastiparrot', level: 5, lastMove: 'hot-take' },
    ],
    aim: 1,
    wasteful: [],
  },
  // status — Team Scrape camp: Grunt A's Scrapion is Hallucinating. Trap (cureWithoutStatus): Ground Truth cures
  // your side, and none of your side is Hallucinating.
  {
    id: 'scrape-camp-grunt-a',
    round: 5,
    roundStart: { r1: 0x0000_000b, r2: 0x0002_0004 },
    orchestrator: { species: 'sagelet', level: 6, hp: 20, lastMove: 'chain-of-thought' },
    actor: { species: 'forkling', level: 6, hp: 19, contextUsed: 5 },
    ally: { species: 'blitzr', level: 6, hp: 13, contextUsed: 3, lastMove: 'ship-it' },
    history: [{ moveId: 'hard-fork', round: 4 }, { moveId: 'swarm-of-fine-tunes', round: 2 }],
    foes: [
      { species: 'nullbeetle', level: 5, lastMove: 'segfault' },
      { species: 'scrapion', level: 6, hp: 9, statuses: ['hallucinating'], lastMove: 'scrape' },
    ],
    aim: 1,
    wasteful: ['cureWithoutStatus'],
  },
  // contextFill — Team Scrape camp: Grunt B's patrol has filled your context (10/12) with four Junk tokens.
  {
    id: 'scrape-camp-grunt-b',
    round: 6,
    roundStart: { r1: 0x0010_0002, r2: 0x0001_0000 },
    orchestrator: { species: 'sagelet', level: 6, hp: 21, lastMove: 'step-back-prompt' },
    actor: { species: 'forkling', level: 6, hp: 16, contextUsed: 10, junk: 4 },
    history: [{ moveId: 'hard-fork', round: 3 }, { moveId: 'leaderboard-flex', round: 5 }],
    foes: [
      { species: 'nullbeetle', level: 5, hp: 14, lastMove: 'null-chomp' },
      { species: 'scrapion', level: 5, lastMove: 'retrieval-strike' },
    ],
    wasteful: ['compactWhenEmpty'],
  },
  // foeLastMove — The Model Graveyard (secret): the rare Hallucinat just used Confident Citation, and your Blitzr
  // is Hallucinating. The seeded coin lands heads.
  {
    id: 'model-graveyard-hallucinat',
    round: 3,
    roundStart: { r1: 0x0003_0001, r2: 0x0005_0000 },
    orchestrator: { species: 'sagelet', level: 7, lastMove: 'happy-to-help' },
    actor: { species: 'blitzr', level: 7, hp: 18, statuses: ['hallucinating'], contextUsed: 3 },
    history: [{ moveId: 'token-burst', round: 2 }],
    foes: [{ species: 'hallucinat', level: 7, lastMove: 'confident-citation' }],
    aim: 0,
    wasteful: ['cureWithoutStatus'],
  },
];

/** The Deprecated Forest Eval Suite: 12 Unseen scenarios (frozen). */
export const DEPRECATED_FOREST_SUITE: EvalSuite = deepFreeze({ id: 'deprecated-forest', scenarios: SCENARIOS.map(scenario) });
