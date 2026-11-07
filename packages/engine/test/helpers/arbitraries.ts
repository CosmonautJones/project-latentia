import fc from 'fast-check';
import { validateCommand } from '../../src/battle/errors.js';
import type { OrchestratorAction, RoundCommand } from '../../src/battle/log.js';
import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { CommandSource } from '../../src/battle/simulate.js';
import { VERSIONS, type BattleState, type SideId, type Temperature } from '../../src/battle/state.js';
import { moveDef, SIGNATURE_MOVE_IDS } from '../../src/content/moves.js';
import { SPECIES, type SpeciesDef } from '../../src/content/species.js';
import type { GridLayout, PlacedPiece } from '../../src/grid/model.js';
import type { SeedHex } from '../../src/rng/seed.js';

// fast-check arbitraries for the property and fuzz suites. Every value they produce is LEGAL:
// setups pass validateSetup, seeds pass parseSeed, scripted commands pass validateCommand, so the
// properties exercise battles rather than validation.

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

const arbBench = arbDraft(1, 100);

/** A gridless side: orchestrator at any level, 1-2 active, 0-3 bench. */
const arbGridless = (tag: SideId): fc.Arbitrary<SideSetup> =>
  fc
    .record({
      orch: arbDraft(1, 100),
      active: fc.array(arbDraft(1, 100), { minLength: 1, maxLength: 2 }),
      bench: fc.array(arbBench, { maxLength: 3 }),
    })
    .map(({ orch, active, bench }) => ({
      orchestrator: named(`${tag}-orch`, orch),
      active: active.map((d, i) => named(`${tag}-act${i}`, d)),
      bench: bench.map((d, i) => named(`${tag}-b${i}`, d)),
      grid: null,
      opponentId: tag === 'a' ? 'b' : 'a',
    }));

/** A gridded side: a template for its orchestrator's level, its moves from the grid. */
const arbGridded = (tag: SideId): fc.Arbitrary<SideSetup> =>
  fc
    .record({
      template: fc.constantFrom(...GRID_TEMPLATES),
      orch: arbDraft(1, 1),
      levelPick: fc.nat(),
      pick: fc.nat(),
      active: fc.array(arbDraft(1, 100), { minLength: 1, maxLength: 2 }),
      bench: fc.array(arbBench, { maxLength: 3 }),
    })
    .map(({ template, orch, levelPick, pick, active, bench }) => {
      const level = template.minLevel + (levelPick % (template.maxLevel - template.minLevel + 1));
      const actives = active.map((d, i) => named(`${tag}-act${i}`, d));
      return {
        orchestrator: { ...named(`${tag}-orch`, orch), level, moves: [] },
        active: actives,
        bench: bench.map((d, i) => named(`${tag}-b${i}`, d)),
        grid: buildGrid(template, orch.species, actives.map((c) => c.id), pick),
        opponentId: tag === 'a' ? 'b' : 'a',
      };
    });

/** Mostly gridless sides (1 in 3 gridded). */
const arbSide = (tag: SideId): fc.Arbitrary<SideSetup> =>
  fc.oneof({ arbitrary: arbGridless(tag), weight: 2 }, { arbitrary: arbGridded(tag), weight: 1 });

/** A legal setup from the slice species (validateSetup passes). */
export const arbLegalSetup: fc.Arbitrary<BattleSetup> = fc.record({
  a: arbSide('a'),
  b: arbSide('b'),
  kind: fc.constantFrom('trainer' as const, 'wild' as const, 'ghost' as const),
});

// --- commands ----------------------------------------------------------------------------------

/** Choices per round: temperature and action pick for each side. */
const PER_ROUND = 4;
const ROUNDS = 50;

/** Every legal `move` action for a side's orchestrator (a self/none move once, aimed at the user). */
export function legalMoveActions(state: BattleState, side: SideId): OrchestratorAction[] {
  const orch = state.creatures.find((c) => c.side === side && c.isOrchestrator);
  if (orch === undefined) return [];
  const out: OrchestratorAction[] = [];
  for (const moveId of orch.moves) {
    const def = moveDef(moveId);
    if (def === null) continue;
    const targets = def.target === 'self' || def.target === 'none' ? [orch.index] : state.creatures.map((c) => c.index);
    for (const target of targets) {
      const action: OrchestratorAction = { kind: 'move', moveId, target };
      if (validateCommand(state, { [side]: { temperature: 2, action } }) === null) out.push(action);
    }
  }
  return out;
}

/**
 * A scripted source from precomputed choices: each round, for each side, a temperature and one legal
 * orchestrator move with a legal target picked from the current state (`none` when there is none, e.g.
 * while charging or headless). `next` is a pure function of the state, so the same source replays the same
 * battle every time it is simulated.
 */
export function scriptedFrom(choices: readonly number[]): CommandSource {
  const choice = (round: number, k: number): number => choices[(round * PER_ROUND + k) % choices.length] ?? 0;
  return {
    kind: 'scripted',
    next: (state: BattleState): RoundCommand => {
      const cmd: RoundCommand = {};
      (['a', 'b'] as const).forEach((side, s) => {
        const actions = legalMoveActions(state, side);
        const temperature = (choice(state.round, s * 2) % 5) as Temperature;
        const action = actions[choice(state.round, s * 2 + 1) % Math.max(1, actions.length)] ?? { kind: 'none' };
        cmd[side] = { temperature, action };
      });
      return cmd;
    },
  };
}

/** A scripted command source built from fast-check's seeded random choices. */
export const arbScriptedCommands: fc.Arbitrary<CommandSource> = fc
  .array(fc.integer({ min: 0, max: 0xffff }), { minLength: ROUNDS * PER_ROUND, maxLength: ROUNDS * PER_ROUND })
  .map(scriptedFrom);
