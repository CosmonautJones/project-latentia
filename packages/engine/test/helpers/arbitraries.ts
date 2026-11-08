import fc from 'fast-check';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import { VERSIONS, type SideId, type Temperature } from '../../src/battle/state.js';
import { SIGNATURE_MOVE_IDS } from '../../src/content/moves.js';
import { SPECIES, type SpeciesDef } from '../../src/content/species.js';
import type { Deck } from '../../src/cards/model.js';
import type { GridLayout, PlacedPiece } from '../../src/grid/model.js';
import type { SeedHex } from '../../src/rng/seed.js';
import { arbDeck } from './decks.js';

// fast-check arbitraries for the property and fuzz suites. Every value they produce is LEGAL:
// setups pass validateSetup and seeds pass parseSeed, so the properties exercise battles rather than
// validation. The scripted-command arbitraries live in commands.ts.

export const SPECIES_IDS = Object.keys(SPECIES);
const HEX = '0123456789abcdef';

const speciesDef = (id: string): SpeciesDef => SPECIES[id as keyof typeof SPECIES] as SpeciesDef;

/** 32 lowercase hex characters, never all zero. */
export const arbSeed: fc.Arbitrary<SeedHex> = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 32, maxLength: 32 })
  .map((nibbles) => nibbles.map((n) => HEX.charAt(n)).join(''))
  .filter((s) => /[1-9a-f]/.test(s));

/** A deterministic, legal seed for battle `i` (fixed seed lists for the statistical and fuzz suites). */
export function seedAt(i: number): SeedHex {
  let x = (Math.imul(i + 1, 0x9e3779b1) ^ 0x5bd1e995) >>> 0;
  let out = '';
  for (let w = 0; w < 4; w++) {
    x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x6a09e667) >>> 0;
    out += ((x | 1) >>> 0).toString(16).padStart(8, '0');
  }
  return out;
}

// --- creatures ---------------------------------------------------------------------------------

type Draft = { species: string; level: number; version: CreatureSetup['version']; moves: string[] };

const arbVersion = fc.constantFrom(...VERSIONS);

/** A subagent (or gridless orchestrator): 1-4 distinct moves its species knows. */
const arbDraft = (minLevel: number, maxLevel: number): fc.Arbitrary<Draft> =>
  fc.constantFrom(...SPECIES_IDS).chain((species) =>
    fc.record({
      species: fc.constant(species),
      level: fc.integer({ min: minLevel, max: maxLevel }),
      version: arbVersion,
      moves: fc.subarray([...speciesDef(species).moves], { minLength: 1, maxLength: 4 }),
    }),
  );

const named = (id: string, d: Draft): CreatureSetup => ({ id, species: d.species, level: d.level, version: d.version, moves: d.moves });

/**
 * A subagent's training (Ruling 77), each part present or absent: trainedTemperature 0-4, generalization
 * 0-100, `foeMask`, which picks its recordedFoes from opponent ids once the side exists (bit i = the i-th of
 * recordedFoeCandidates; see withRecordedFoes), and a deck (added by arbSubDraft).
 */
type Training = { trainedTemperature: Temperature | undefined; generalization: number | undefined; foeMask: number | undefined; deck?: Deck | undefined };
type SubDraft = Draft & { training: Training };

const arbTraining: fc.Arbitrary<Training> = fc.record({
  trainedTemperature: fc.option(fc.constantFrom<Temperature>(0, 1, 2, 3, 4), { nil: undefined }),
  generalization: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  foeMask: fc.option(fc.integer({ min: 0, max: 0x7 }), { nil: undefined }),
});

/** A subagent draft with its training, and sometimes a deck over its moves (B2). */
const arbSubDraft = (minLevel: number, maxLevel: number): fc.Arbitrary<SubDraft> =>
  fc
    .tuple(arbDraft(minLevel, maxLevel), arbTraining)
    .chain(([d, training]) => fc.option(arbDeck(d.moves), { nil: undefined }).map((deck) => ({ ...d, training: { ...training, deck } })));

/** A subagent with its trainedTemperature and generalization; its recordedFoes come later (withRecordedFoes). */
function subagent(id: string, d: SubDraft): CreatureSetup {
  const c = named(id, d);
  if (d.training.trainedTemperature !== undefined) c.trainedTemperature = d.training.trainedTemperature;
  if (d.training.generalization !== undefined) c.generalization = d.training.generalization;
  if (d.training.deck !== undefined) c.deck = d.training.deck;
  return c;
}

/** Each subagent's foeMask by creature id, carried from the drafts to withRecordedFoes. */
type FoeMasks = Map<string, number>;

function masksOf(tagged: readonly [string, SubDraft][]): FoeMasks {
  const out: FoeMasks = new Map();
  for (const [id, d] of tagged) if (d.training.foeMask !== undefined) out.set(id, d.training.foeMask);
  return out;
}

// --- grids -------------------------------------------------------------------------------------

const SP: [number, number][] = [[0, 0], [1, 0], [2, 0]];
const SKILL: [number, number][] = [[0, 0], [1, 0]];
const ONE: [number, number][] = [[0, 0]];
const SLOT: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
const ELL: [number, number][] = [[0, 0], [0, 1], [1, 1]];

type Spot = { kind: 'slot' | 'skill' | 'graft' | 'tool' | 'cache' | 'exampleCard'; at: [number, number]; rotation?: PlacedPiece['rotation'] };
/** A hand-made layout for one grid size: the System Prompt always sits at (0, 0). */
type Template = { minLevel: number; maxLevel: number; width: number; height: number; spots: Spot[] };

/** Two templates per grid size (spec §5 grid sizes by level); every one has 2 slot spots and passes validateGrid. */
export const GRID_TEMPLATES: readonly Template[] = [
  { minLevel: 1, maxLevel: 3, width: 4, height: 4, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 1] }] },
  { minLevel: 1, maxLevel: 3, width: 4, height: 4, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 2] }, { kind: 'tool', at: [3, 0] }] },
  { minLevel: 4, maxLevel: 6, width: 5, height: 4, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 1] }, { kind: 'skill', at: [0, 3] }] },
  { minLevel: 4, maxLevel: 6, width: 5, height: 4, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [3, 1] }, { kind: 'skill', at: [3, 0] }, { kind: 'skill', at: [2, 3] }] },
  { minLevel: 7, maxLevel: 9, width: 5, height: 5, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 1] }, { kind: 'skill', at: [0, 3] }, { kind: 'skill', at: [2, 3] }] },
  { minLevel: 7, maxLevel: 9, width: 5, height: 5, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [3, 2] }, { kind: 'graft', at: [0, 3] }, { kind: 'skill', at: [3, 0] }] },
  { minLevel: 10, maxLevel: 12, width: 6, height: 5, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 1] }, { kind: 'skill', at: [0, 3] }, { kind: 'skill', at: [2, 3] }, { kind: 'graft', at: [4, 1] }] },
  { minLevel: 10, maxLevel: 12, width: 6, height: 5, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [4, 0] }, { kind: 'skill', at: [0, 3] }, { kind: 'tool', at: [3, 0] }, { kind: 'exampleCard', at: [2, 4] }] },
  { minLevel: 13, maxLevel: 20, width: 6, height: 6, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [2, 1] }, { kind: 'skill', at: [0, 3] }, { kind: 'skill', at: [2, 3] }, { kind: 'skill', at: [4, 0], rotation: 90 }, { kind: 'graft', at: [4, 2] }] },
  { minLevel: 13, maxLevel: 20, width: 6, height: 6, spots: [{ kind: 'slot', at: [0, 1] }, { kind: 'slot', at: [4, 4] }, { kind: 'skill', at: [0, 3] }, { kind: 'cache', at: [5, 0] }] },
];

/**
 * A template filled in for one orchestrator: slot spots bound to the active ids in order (spare slots stay
 * unnamed), skill spots take the species' non-signature moves in order, graft spots take another species'
 * signature (rotated by `pick`).
 */
export function buildGrid(t: Template, orchSpecies: string, activeIds: readonly string[], pick: number): GridLayout {
  const species = speciesDef(orchSpecies);
  const skills = species.moves.filter((m) => m !== species.signature);
  const grafts = SIGNATURE_MOVE_IDS.filter((m) => m !== species.signature);
  const pieces: PlacedPiece[] = [{ id: 'sp', kind: 'systemPrompt', shape: SP, anchor: [0, 0], rotation: 0 }];
  let slot = 0;
  let skill = 0;
  t.spots.forEach((s, i) => {
    const base = { id: `${s.kind}${i}`, anchor: s.at, rotation: s.rotation ?? (0 as const) };
    if (s.kind === 'slot') {
      const sub = activeIds[slot++];
      pieces.push({ ...base, kind: 'subagentSlot', shape: SLOT, ...(sub === undefined ? {} : { subagentId: sub }) });
    } else if (s.kind === 'skill') {
      const moveId = skills[skill++];
      if (moveId !== undefined) pieces.push({ ...base, kind: 'skill', shape: SKILL, moveId });
    } else if (s.kind === 'graft') {
      pieces.push({ ...base, kind: 'graft', shape: ELL, moveId: grafts[pick % grafts.length] as string });
    } else {
      pieces.push({ ...base, kind: s.kind, shape: ONE });
    }
  });
  return { width: t.width, height: t.height, pieces };
}

// --- sides and setups --------------------------------------------------------------------------

const arbActive = fc.array(arbSubDraft(1, 100), { maxLength: 2 });
const arbBench = fc.array(arbSubDraft(1, 100), { maxLength: 3 });

type DraftSide = { side: SideSetup; masks: FoeMasks };

/** The side's subagents, named in canonical order, with the foe masks their recordedFoes are picked by. */
function subagents(tag: SideId, active: readonly SubDraft[], bench: readonly SubDraft[]): { active: CreatureSetup[]; bench: CreatureSetup[]; masks: FoeMasks } {
  const a = active.map((d, i): [string, SubDraft] => [`${tag}-act${i}`, d]);
  const b = bench.map((d, i): [string, SubDraft] => [`${tag}-b${i}`, d]);
  return { active: a.map(([id, d]) => subagent(id, d)), bench: b.map(([id, d]) => subagent(id, d)), masks: masksOf([...a, ...b]) };
}

/** A gridless side: orchestrator at any level, 0-2 active (Ruling 77), 0-3 bench. */
const arbGridless = (tag: SideId): fc.Arbitrary<DraftSide> =>
  fc.record({ orch: arbDraft(1, 100), active: arbActive, bench: arbBench }).map(({ orch, active, bench }) => {
    const subs = subagents(tag, active, bench);
    return {
      side: { orchestrator: named(`${tag}-orch`, orch), active: subs.active, bench: subs.bench, grid: null, opponentId: tag === 'a' ? 'b' : 'a' },
      masks: subs.masks,
    };
  });

/** A gridded side: a template for its orchestrator's level, its moves from the grid; 0-2 active, 0-3 bench. */
const arbGridded = (tag: SideId): fc.Arbitrary<DraftSide> =>
  fc
    .record({ template: fc.constantFrom(...GRID_TEMPLATES), orch: arbDraft(1, 1), levelPick: fc.nat(), pick: fc.nat(), active: arbActive, bench: arbBench })
    .map(({ template, orch, levelPick, pick, active, bench }) => {
      const level = template.minLevel + (levelPick % (template.maxLevel - template.minLevel + 1));
      const subs = subagents(tag, active, bench);
      return {
        side: {
          orchestrator: { ...named(`${tag}-orch`, orch), level, moves: [] },
          active: subs.active,
          bench: subs.bench,
          grid: buildGrid(template, orch.species, subs.active.map((c) => c.id), pick),
          opponentId: tag === 'a' ? 'b' : 'a',
        },
        masks: subs.masks,
      };
    });

/** Mostly gridless sides (1 in 3 gridded). */
const arbSide = (tag: SideId): fc.Arbitrary<DraftSide> =>
  fc.oneof({ arbitrary: arbGridless(tag), weight: 2 }, { arbitrary: arbGridded(tag), weight: 1 });

/**
 * The opponent ids a subagent's recordedFoes are picked from (Ruling 80: opponent ids, not creature ids): the
 * opponent its side faces, so Robust's +5 is off, then two other opponents, which leave it on.
 */
export const recordedFoeCandidates = (side: SideSetup): string[] => [side.opponentId, 'ghost-1', 'ghost-2'];

/** Gives each masked subagent its recordedFoes: the candidate opponent ids whose bit is set in its mask (possibly none). */
function withRecordedFoes(own: DraftSide): SideSetup {
  const foes = recordedFoeCandidates(own.side);
  const pick = (c: CreatureSetup): CreatureSetup => {
    const mask = own.masks.get(c.id);
    return mask === undefined ? c : { ...c, recordedFoes: foes.filter((_, i) => (mask >>> i) & 1) };
  };
  return { ...own.side, active: own.side.active.map(pick), bench: own.side.bench.map(pick) };
}

/**
 * A legal setup from the slice species (validateSetup passes). Subagents carry trainedTemperature,
 * generalization and recordedFoes (subsets of recordedFoeCandidates), each sometimes absent, and a side
 * may have no active subagent (Ruling 77).
 */
export const arbLegalSetup: fc.Arbitrary<BattleSetup> = fc
  .record({ a: arbSide('a'), b: arbSide('b'), kind: fc.constantFrom('trainer' as const, 'wild' as const, 'ghost' as const) })
  .map(({ a, b, kind }) => ({ a: withRecordedFoes(a), b: withRecordedFoes(b), kind }));
