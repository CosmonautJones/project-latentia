import type { TypeId } from './ids.js';
import type { MoveId } from './moves.js';
import { deepFreeze, type Passive } from './primitives.js';

export interface SpeciesDef {
  readonly id: string;
  readonly name: string;
  readonly types: readonly TypeId[];
  readonly base: { readonly hp: number; readonly compute: number; readonly robustness: number; readonly latency: number };
  /** Own context window (10–16, default 12). */
  readonly ctx: number;
  /**
   * Four moves: the signature plus three launch moves. The bible's spin-up rule (a spun-up subagent keeps only the
   * three, its signature becoming a passive echo) belongs to distillation (bible milestone 8). The engine does not
   * enforce it: a subagent setup may list any of its species' four moves.
   */
  readonly moves: readonly MoveId[];
  readonly signature: MoveId;
  /** Species passives, in firing order for a shared trigger; empty when none. */
  readonly passives: readonly Passive[];
  /** Graft piece cells as [x, y] offsets: 3–4 orthogonally connected cells. */
  readonly graftShape: readonly (readonly [number, number])[];
}

// The 17 species marked S in the bible's ModelDex (rows 1–17), in Dex order.
// Every `base` and `ctx` is a placeholder — tuned in sub-project 4.
const DATA = {
  sagelet: {
    id: 'sagelet', name: 'Sagelet', types: ['reasoning'],
    base: { hp: 60, compute: 70, robustness: 55, latency: 55 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['happy-to-help', 'chain-of-thought', 'step-back-prompt', 'proof-by-contradiction'], signature: 'happy-to-help',
    // Disclaimer: blocks the first status each fight.
    passives: [{ kind: 'passive', trigger: 'battleStart', effects: [{ kind: 'shield', who: 'self', against: 'status', count: 1 }] }],
    graftShape: [[0, 0], [1, 0], [2, 0]],
  },
  blitzr: {
    id: 'blitzr', name: 'Blitzr', types: ['speed'],
    base: { hp: 50, compute: 65, robustness: 45, latency: 80 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['ship-it', 'token-burst', 'low-latency', 'distilled-strike'], signature: 'ship-it',
    // Move Fast: +1 priority on its first move; 15% it "ships with a known issue" (10% recoil).
    passives: [
      { kind: 'passive', trigger: 'battleStart', effects: [{ kind: 'nextActionModifier', who: 'self', modifier: { kind: 'priority', delta: 1 } }] },
      { kind: 'passive', trigger: 'afterFirstAction', effects: [{ kind: 'damage', who: 'self', pctOfDealt: 10, chance: { pct: 15, slot: 'r2hi' } }] },
    ],
    graftShape: [[0, 0], [1, 0], [1, 1]],
  },
  forkling: {
    id: 'forkling', name: 'Forkling', types: ['open'],
    base: { hp: 65, compute: 60, robustness: 60, latency: 55 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['hard-fork', 'community-patch', 'swarm-of-fine-tunes', 'leaderboard-flex'], signature: 'hard-fork',
    // Once per battle, a forked decoy absorbs one hit (v1: one-hit shield, spec §3).
    passives: [{ kind: 'passive', trigger: 'battleStart', effects: [{ kind: 'shield', who: 'self', against: 'hit', count: 1 }] }],
    graftShape: [[0, 0], [1, 0], [2, 0], [1, 1]],
  },
  tokenibble: {
    id: 'tokenibble', name: 'Tokenibble', types: ['speed'],
    base: { hp: 45, compute: 50, robustness: 40, latency: 75 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['token-nibble', 'token-burst', 'early-exit', 'low-latency'], signature: 'token-nibble',
    passives: [],
    graftShape: [[0, 0], [0, 1], [1, 1]],
  },
  stochastiparrot: {
    id: 'stochastiparrot', name: 'Stochastiparrot', types: ['voice'],
    base: { hp: 55, compute: 55, robustness: 50, latency: 60 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['stochastic-repeat', 'hype-train', 'flattery', 'hot-take'], signature: 'stochastic-repeat',
    passives: [],
    graftShape: [[0, 0], [1, 0], [1, 1], [2, 1]],
  },
  nullbeetle: {
    id: 'nullbeetle', name: 'Nullbeetle', types: ['code'],
    base: { hp: 50, compute: 60, robustness: 55, latency: 45 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['null-chomp', 'segfault', 'infinite-loop', 'unit-test'], signature: 'null-chomp',
    passives: [],
    graftShape: [[0, 0], [0, 1], [0, 2]],
  },
  'off-by-wasp': {
    id: 'off-by-wasp', name: 'Off-By-Wasp', types: ['code'],
    base: { hp: 45, compute: 65, robustness: 40, latency: 70 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['off-by-one', 'stack-trace', 'token-burst', 'unit-test'], signature: 'off-by-one',
    passives: [],
    graftShape: [[1, 0], [0, 1], [1, 1]],
  },
  heisenmoth: {
    id: 'heisenmoth', name: 'Heisenmoth', types: ['code'],
    base: { hp: 45, compute: 50, robustness: 45, latency: 75 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['observer-effect', 'refactor', 'bounding-box', 'flash-inference'], signature: 'observer-effect',
    passives: [],
    graftShape: [[0, 0], [0, 1], [1, 1], [1, 2]],
  },
  embeddingo: {
    id: 'embeddingo', name: 'Embeddingo', types: ['search'],
    base: { hp: 60, compute: 65, robustness: 55, latency: 55 }, ctx: 14, // placeholder — tuned in sub-project 4
    moves: ['cosine-sniff', 'citation-needed', 'retrieval-strike', 'ground-truth'], signature: 'cosine-sniff',
    passives: [],
    graftShape: [[0, 0], [1, 0], [2, 0], [2, 1]],
  },
  slopling: {
    id: 'slopling', name: 'Slopling', types: ['open', 'vision'],
    base: { hp: 60, compute: 55, robustness: 55, latency: 45 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['six-fingers', 'swarm-of-fine-tunes', 'adversarial-patch', 'weights-dump'], signature: 'six-fingers',
    // Multiplies each turn it isn't KO'd (v1: a stacking buff, spec §3).
    passives: [{ kind: 'passive', trigger: 'notKoThisRound', effects: [{ kind: 'stage', who: 'self', op: 'add', stat: 'compute', delta: 1 }] }],
    graftShape: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  hallucinat: {
    id: 'hallucinat', name: 'Hallucinat', types: ['reasoning', 'vision'],
    base: { hp: 55, compute: 75, robustness: 50, latency: 60 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['confident-citation', 'proof-by-contradiction', 'adversarial-patch', 'socratic-method'], signature: 'confident-citation',
    passives: [],
    graftShape: [[0, 0], [1, 0], [2, 0], [0, 1]],
  },
  deprecatter: {
    id: 'deprecatter', name: 'Deprecatter', types: ['memory'],
    base: { hp: 50, compute: 45, robustness: 45, latency: 40 }, ctx: 10, // placeholder — tuned in sub-project 4
    moves: ['nostalgia-trip', 'long-term-recall', 'save-state', 'episodic-replay'], signature: 'nostalgia-trip',
    passives: [],
    graftShape: [[0, 0], [1, 0], [0, 1]],
  },
  cobolt: {
    id: 'cobolt', name: 'Cobolt', types: ['code'],
    base: { hp: 90, compute: 70, robustness: 75, latency: 40 }, ctx: 10, // placeholder — tuned in sub-project 4
    moves: ['batch-job', 'refactor', 'hotfix', 'long-term-recall'], signature: 'batch-job',
    passives: [],
    graftShape: [[0, 0], [1, 0], [2, 0], [3, 0]],
  },
  scrapion: {
    id: 'scrapion', name: 'Scrapion', types: ['search', 'code'],
    base: { hp: 55, compute: 70, robustness: 55, latency: 65 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['scrape', 'fact-check', 'merge-conflict', 'retrieval-strike'], signature: 'scrape',
    passives: [],
    graftShape: [[1, 0], [0, 1], [1, 1], [2, 1]],
  },
  vibrat: {
    id: 'vibrat', name: 'Vibrat', types: ['code'],
    base: { hp: 55, compute: 80, robustness: 45, latency: 60 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['accept-all', 'merge-conflict', 'segfault', 'hype-train'], signature: 'accept-all',
    passives: [],
    graftShape: [[0, 0], [1, 0], [1, 1], [1, 2]],
  },
  spaghettopus: {
    id: 'spaghettopus', name: 'Spaghettopus', types: ['code'],
    base: { hp: 70, compute: 65, robustness: 70, latency: 45 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['tangle', 'infinite-loop', 'merge-conflict', 'memory-leak'], signature: 'tangle',
    passives: [],
    graftShape: [[1, 0], [2, 0], [0, 1], [1, 1]],
  },
  agentoad: {
    id: 'agentoad', name: 'Agentoad', types: ['code', 'speed'],
    base: { hp: 65, compute: 70, robustness: 55, latency: 70 }, ctx: 12, // placeholder — tuned in sub-project 4
    moves: ['tool-call', 'token-burst', 'stack-trace', 'rerank'], signature: 'tool-call',
    passives: [],
    graftShape: [[0, 0], [0, 1], [1, 1], [0, 2]],
  },
} satisfies Record<string, SpeciesDef>;

export type SpeciesId = keyof typeof DATA;

export const SPECIES: Readonly<Record<SpeciesId, SpeciesDef>> = deepFreeze(DATA);

export const SPECIES_IDS: readonly SpeciesId[] = deepFreeze(Object.keys(DATA) as SpeciesId[]);
