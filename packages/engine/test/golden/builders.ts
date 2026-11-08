import type { BattleSetup, CreatureSetup, SideSetup } from '../../src/battle/setup.js';
import type { SideId, Temperature } from '../../src/battle/state.js';
import { SPECIES } from '../../src/content/species.js';
import { fnv1a64Hex } from '../../src/events/fnv.js';
import type { SeedHex } from '../../src/rng/seed.js';
import { buildGrid, GRID_TEMPLATES } from '../helpers/arbitraries.js';
import type { Aim, SideScript, Step } from './script.js';

// Builders for the golden scenarios (scenarios.ts, deck-scenarios.ts).

export type GoldenScenario = { name: string; seed: SeedHex; setup: BattleSetup; scripts: { a?: SideScript; b?: SideScript } };

/** 32 lowercase hex characters from FNV-1a of the label (two halves), never all zero. */
export function seedFor(label: string): SeedHex {
  const enc = new TextEncoder();
  const hex = fnv1a64Hex(enc.encode(label)) + fnv1a64Hex(enc.encode(`${label}#2`));
  return /[1-9a-f]/.test(hex) ? hex : `${hex.slice(0, 31)}1`;
}

export const movesOf = (species: string): string[] => [...(SPECIES[species as keyof typeof SPECIES]?.moves ?? [])];

/** A creature knowing `moves` (default: its species' four, in Dex order). A subagent's default intent is its first allowed move. */
export const mon = (id: string, species: string, level: number, moves: string[] = movesOf(species)): CreatureSetup => ({ id, species, level, version: 'v1', moves });

export type SideSpec = { orch: CreatureSetup; active?: CreatureSetup[]; bench?: CreatureSetup[] };

export function side(tag: SideId, spec: SideSpec): SideSetup {
  return { orchestrator: spec.orch, active: spec.active ?? [], bench: spec.bench ?? [], grid: null, opponentId: tag === 'a' ? 'trainer-b' : 'trainer-a' };
}

/** A gridded side from one of the shared grid templates (its orchestrator lists no moves). */
export function gridded(tag: SideId, template: number, orch: CreatureSetup, active: CreatureSetup[], bench: CreatureSetup[] = [], pick = 0): SideSetup {
  const t = GRID_TEMPLATES[template];
  if (t === undefined) throw new Error(`no grid template ${template}`);
  return { ...side(tag, { orch: { ...orch, moves: [] }, active, bench }), grid: buildGrid(t, orch.species, active.map((c) => c.id), pick) };
}

export const setup = (a: SideSetup, b: SideSetup, kind: BattleSetup['kind'] = 'trainer'): BattleSetup => ({ a, b, kind });

/** The steps in turn (a bare move id is a move step aimed by `aim`), at the given temperatures in turn. */
export const cycle = (steps: readonly (string | Step)[], temps: readonly Temperature[] = [2], aim?: Aim): SideScript => ({
  temps,
  steps: steps.map((m) => (m === 'none' || typeof m !== 'string' ? m : aim === undefined ? { move: m } : { move: m, aim })),
});

/** Opening steps, then the cycle. */
export const opened = (opening: readonly Step[], script: SideScript): SideScript => ({ ...script, opening });

export const scenario = (name: string, s: BattleSetup, scripts: GoldenScenario['scripts']): GoldenScenario => ({ name, seed: seedFor(`golden:${name}`), setup: s, scripts });
