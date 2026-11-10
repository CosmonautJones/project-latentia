import { activeCardCount, moveDef, SPECIES, SPECIES_IDS, type Card, type Condition, type Deck, type GridLayout, type PlacedPiece, type SpeciesId, type Subject, type TargetSelector, type Temperature } from '@latentia/engine';
import { ALWAYS, archetype, card, cooldown, deck, FULL, OPENER, orchestrator, subagent, versionFor, WEAK_TO_MOVE } from './archetypes/build.js';
import { ARCHETYPES, mirrorOf, starterGrid, type StarterId } from './archetypes/index.js';
import type { Archetype } from './types.js';

// The balance targets' own setups (spec §9 table, Rulings 133–134). Ruling 130's 1 + 2 + 1 team rule is for ARCHETYPES
// and does not apply here; every setup still passes validateSetup, and each has a "setup is live" test
// (target-setups.test.ts). Every creature is L8 (v2) except the diagnostic spun-up subagent (graft vs spin-up's S),
// which joins at L5 (Ruling 145) with 1 active Example Card (Ruling 147). Decks are built by role from move data,
// never by move index.

const LEVEL = 8;
/** A freshly spun-up subagent's active Example Card slots (Ruling 147): more come through level, a Clean distill and grid expansion. */
export const SPIN_UP_CARDS = 1;
/**
 * The spun-up subagent's level in graft vs spin-up (Ruling 145): a spun-up subagent joins at the level of the wild
 * model it was distilled from, not the orchestrator's; L5 is a mid-Deprecated-Forest wild level.
 */
export const SPIN_UP_LEVEL = 5;
const STARTERS: readonly StarterId[] = ['sagelet', 'blitzr', 'forkling'];
/** Every template-built Autopilot runs at the engine's default temperature, the middle of the dial. */
const TEMPLATE_TEMPERATURE: Temperature = 2;
/** Every template-built subagent: Stable, trained at the default temperature. */
const SUBAGENT_TRAINING = { generalization: 55, trainedTemperature: 2 as Temperature };

/** A card's selector for its move: self and no-target moves aim at the actor, ally moves at the lowest-HP ally, the rest at `foe`. */
function aim(move: string, foe: TargetSelector): TargetSelector {
  const t = moveDef(move)?.target;
  if (t === undefined) throw new Error(`unknown move ${move}`);
  return t === 'self' || t === 'none' ? 'self' : t === 'ally' ? 'lowestHpAlly' : foe;
}

const aimed = (id: string, subject: Subject, condition: Condition, move: string, foe: TargetSelector): Card => card(id, subject, condition, move, aim(move, foe));

// --- role templates (Ruling 134) --------------------------------------------------------------------------------

/**
 * A creature's moves by role, read off the move data so no creature gets a hand-picked deck:
 * - `power`: its strongest damaging move (power × accuracy; ties go to the earlier move in species order);
 * - `affordable`: its strongest damaging move among those of the lowest cost (the Default card's move);
 * - `setup`: its first self-buff move (a self-target move raising one of its own stages), else `power`;
 * - `sig`: its signature.
 */
export type Roles = { power: string; affordable: string; setup: string; sig: string };

const strength = (m: string): number => {
  const d = moveDef(m);
  return d === null || d.power === null || d.power === undefined ? -1 : d.power * (d.accuracy ?? 100);
};
const costOf = (m: string): number => moveDef(m)?.cost ?? Infinity;
const strongest = (ms: readonly string[]): string | undefined => ms.reduce<string | undefined>((best, m) => (best === undefined || strength(m) > strength(best) ? m : best), undefined);
const isBuff = (m: string): boolean => {
  const d = moveDef(m);
  return d !== null && d.target === 'self' && d.effects.some((e) => e.kind === 'stage' && e.who === 'self' && e.op === 'add' && e.delta > 0);
};

export function rolesOf(species: SpeciesId): Roles {
  return rolesAmong(species, SPECIES[species].moves);
}

/** The roles read off `moves` (some of `species`' moves); `sig` stays the species' signature. */
function rolesAmong(species: SpeciesId, moves: readonly string[]): Roles {
  const damaging = moves.filter((m) => strength(m) >= 0);
  const power = strongest(damaging);
  if (power === undefined) throw new Error(`${species} has no damaging move`);
  const cheapest = Math.min(...damaging.map(costOf));
  const affordable = strongest(damaging.filter((m) => costOf(m) === cheapest)) as string;
  return { power, affordable, setup: moves.find(isBuff) ?? power, sig: SPECIES[species].signature };
}

/**
 * The one Autopilot role template every target orchestrator plays (Rulings 133–134): its setup move on turn 1, its
 * signature where it is super effective, then (G only) the graft every other round, its strongest damaging move every
 * round, Compact when context is 75% full (the strongest move is then skipped for want of room), and Default its
 * strongest affordable damaging move.
 */
export function autopilotTemplate(r: Roles, graft?: string): Deck {
  return deck(
    aimed('default', 'self', ALWAYS, r.affordable, 'lowestHpFoe'),
    aimed('setup', 'self', OPENER, r.setup, 'highestAtkFoe'),
    aimed('sig', 'foe', WEAK_TO_MOVE, r.sig, 'foeWeakToMove'),
    ...(graft === undefined ? [] : [aimed('graft', 'self', cooldown(1), graft, 'lowestHpFoe')]),
    aimed('power', 'self', ALWAYS, r.power, 'lowestHpFoe'),
    aimed('tidy', 'self', FULL, 'compact', 'self'),
  );
}

/** The subagent role template: setup on turn 1, signature where super effective, strongest move, Default affordable — cut to the slot's `activeCards`. */
export function subagentTemplate(species: SpeciesId, activeCards: number): Deck {
  const r = rolesOf(species);
  const cards = [aimed('setup', 'self', OPENER, r.setup, 'highestAtkFoe'), aimed('sig', 'foe', WEAK_TO_MOVE, r.sig, 'foeWeakToMove'), aimed('power', 'self', ALWAYS, r.power, 'lowestHpFoe')];
  return deck(aimed('default', 'self', ALWAYS, r.affordable, 'lowestHpFoe'), ...cards.slice(0, activeCards));
}

/** A spun-up subagent's three moves (bible:250): its species' moves without the signature. */
export const spunUpMoves = (species: SpeciesId): string[] => SPECIES[species].moves.filter((m) => m !== SPECIES[species].signature);

/** The subagent template on the spun-up moves alone: setup on turn 1, strongest move, Default affordable — no signature card. */
export function spunUpTemplate(species: SpeciesId, activeCards: number): Deck {
  const r = rolesAmong(species, spunUpMoves(species));
  const cards = [aimed('setup', 'self', OPENER, r.setup, 'highestAtkFoe'), aimed('power', 'self', ALWAYS, r.power, 'lowestHpFoe')];
  return deck(aimed('default', 'self', ALWAYS, r.affordable, 'lowestHpFoe'), ...cards.slice(0, activeCards));
}

/** Tokenibble L8, the base team's subagent (the first wild model, spun up), on the subagent template for the starter grid's slot (3 active cards at v2). */
const intern = () => subagent('tokenibble', 'tokenibble', LEVEL, { deck: subagentTemplate('tokenibble', 3), ...SUBAGENT_TRAINING });

// --- starter triangle -------------------------------------------------------------------------------------------

/** [favoured, beaten]: Speed > Reasoning > Open > Speed (bible "starter triangle"), each starter vs the one it beats. */
export const TRIANGLE: readonly (readonly [StarterId, StarterId])[] = Object.freeze([
  Object.freeze(['blitzr', 'sagelet'] as const),
  Object.freeze(['sagelet', 'forkling'] as const),
  Object.freeze(['forkling', 'blitzr'] as const),
]);

/**
 * The official starter-triangle side (Ruling 146): the starter alone, orchestrator only, at L8 on its standard grid
 * with the Subagent Slot left empty (headroom unchanged), on the role-based Autopilot template every starter shares.
 */
export function starterSide(s: StarterId): Archetype {
  const standard = starterGrid(s, LEVEL, 'none');
  const unbind = (p: PlacedPiece): PlacedPiece => Object.fromEntries(Object.entries(p).filter(([k]) => k !== 'subagentId')) as PlacedPiece;
  return archetype(`starter-${s}`, {
    orchestrator: orchestrator(s, s, LEVEL),
    active: [],
    grid: { ...standard, pieces: standard.pieces.map(unbind) },
    autopilot: autopilotTemplate(rolesOf(s)),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

// --- graft worth taking, and graft vs spin-up (Rulings 134, 147) -------------------------------------------------

/** The starter every graft variant and the base team are built on. */
export const GRAFT_STARTER: StarterId = 'sagelet';

type XY = readonly [number, number];
const key = ([x, y]: XY): string => `${x},${y}`;
const turn = (cells: readonly XY[]): XY[] => cells.map(([x, y]): XY => [-y, x]);
const normalize = (cells: readonly XY[]): XY[] => {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]): XY => [x - mx, y - my]);
};

/** The base grid's occupied cells (its pieces are drawn unrotated, so a piece's cells are anchor + shape). */
function occupied(grid: GridLayout): Set<string> {
  const out = new Set<string>();
  for (const p of grid.pieces) {
    if (p.rotation !== 0) throw new Error(`piece ${p.id} is rotated`);
    for (const [x, y] of p.shape) out.add(key([p.anchor[0] + x, p.anchor[1] + y]));
  }
  return out;
}

/** The first placement (anchors in reading order, then quarter turns) of `shape` on free cells of `grid`, as drawn cells and anchor. */
function firstFit(grid: GridLayout, shape: readonly XY[]): { shape: XY[]; anchor: XY } | null {
  const taken = occupied(grid);
  const turns: XY[][] = [];
  for (let t = normalize(shape), i = 0; i < 4; i++, t = normalize(turn(t))) turns.push(t);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      for (const t of turns) {
        const cells = t.map(([dx, dy]): XY => [x + dx, y + dy]);
        if (cells.every(([cx, cy]) => cx < grid.width && cy < grid.height && !taken.has(key([cx, cy])))) return { shape: t, anchor: [x, y] };
      }
    }
  }
  return null;
}

/** Empty cells beyond the headroom floor (4): what a variant may add to the base grid. */
const spare = (grid: GridLayout): number => grid.width * grid.height - occupied(grid).size - 4;

/** Inserts `piece` after the base grid's Subagent Slot (the multi-cell pieces come first in compaction order, then the 1×1s). */
function withPiece(grid: GridLayout, piece: PlacedPiece): GridLayout {
  const at = grid.pieces.findIndex((p) => p.kind === 'subagentSlot') + 1;
  return { ...grid, pieces: [...grid.pieces.slice(0, at), piece, ...grid.pieces.slice(at)] };
}

/** The base team's grid: the starter's standard L8 grid with Tokenibble in its slot. */
const baseGrid = (): GridLayout => starterGrid(GRAFT_STARTER, LEVEL, 'tokenibble');

/** G's grid: the base grid plus `species`' signature as a graft piece, at its first legal fit (null when none fits). */
function graftGrid(species: SpeciesId): GridLayout | null {
  const base = baseGrid();
  const fit = firstFit(base, SPECIES[species].graftShape);
  if (fit === null || spare(base) < fit.shape.length) return null;
  const sig = SPECIES[species].signature;
  return withPiece(base, { id: `graft:${sig}`, kind: 'graft', moveId: sig, shape: fit.shape, anchor: fit.anchor, rotation: 0 });
}

const orth = ([x, y]: XY): XY[] => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];

/**
 * S's grid: the base grid plus a second 2×2 Subagent Slot for `species`, placed on free cells where exactly
 * SPIN_UP_CARDS Example Cards touch it (Ruling 147: 1 active card slot), at the first such place in reading order,
 * and no piece added. On the starter grid that is (3,0): the 2×2 touches only the Example Card at (2,1), which slot A
 * touches too; headroom stays at the floor of 4. (Slot B at (3,1) would touch two cards.)
 */
export function spinUpGrid(species: string): GridLayout {
  const base = baseGrid();
  const taken = occupied(base);
  const cards = base.pieces.filter((p) => p.kind === 'exampleCard').map((p) => key(p.anchor));
  for (let y = 0; y + 1 < base.height; y++) {
    for (let x = 0; x + 1 < base.width; x++) {
      const cells: XY[] = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
      if (cells.some((c) => taken.has(key(c)))) continue;
      if (new Set(cells.flatMap(orth).map(key).filter((k) => cards.includes(k))).size !== SPIN_UP_CARDS) continue;
      return withPiece(base, { id: 'slot-B', kind: 'subagentSlot', subagentId: species, shape: [[0, 0], [1, 0], [0, 1], [1, 1]], anchor: [x, y], rotation: 0 });
    }
  }
  throw new Error(`no room for a second Subagent Slot touching exactly ${SPIN_UP_CARDS} Example Card(s)`);
}

/** The first three slice species, in SPECIES_IDS order, that are neither a starter nor the base team's Tokenibble and whose graft fits the base grid. */
export const GRAFT_SPECIES: readonly SpeciesId[] = Object.freeze(
  SPECIES_IDS.filter((s) => !(STARTERS as readonly string[]).includes(s) && s !== 'tokenibble' && graftGrid(s) !== null).slice(0, 3),
);

/** The Sagelet orchestrator both variants share. */
const graftOrchestrator = () => orchestrator(GRAFT_STARTER, GRAFT_STARTER, LEVEL);

/** The base team (Ruling 147): Sagelet L8 + Tokenibble L8 on the starter grid, no graft and no second subagent. A graft is worth taking when G beats it. */
export function baseTeam(): Archetype {
  return archetype('base-team', {
    orchestrator: graftOrchestrator(),
    active: [intern()],
    grid: baseGrid(),
    autopilot: autopilotTemplate(rolesOf(GRAFT_STARTER)),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

/** Variant G (graft): the base team (Sagelet + Tokenibble), its grid plus the graft; the Autopilot adds a graft card. */
export function graftVariant(species: SpeciesId): Archetype {
  const grid = graftGrid(species);
  if (grid === null) throw new Error(`${species}'s graft does not fit`);
  return archetype(`graft-${species}-g`, {
    orchestrator: graftOrchestrator(),
    active: [intern()],
    grid,
    autopilot: autopilotTemplate(rolesOf(GRAFT_STARTER), SPECIES[species].signature),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

/**
 * Variant S (spin up, diagnostic): the base team plus `species` as a second subagent in slot B, spun up as the bible
 * has it: at SPIN_UP_LEVEL, the defeated wild model's level (Ruling 145), with 1 active Example Card (Ruling 147), its
 * 3 moves and no signature (bible:250, Ruling 143), on the spun-up template cut to its one card.
 */
export function spinUpVariant(species: SpeciesId): Archetype {
  const grid = spinUpGrid(species);
  const active = activeCardCount(grid, 'slot-B', versionFor(SPIN_UP_LEVEL));
  const spun = { ...subagent(species, species, SPIN_UP_LEVEL, { deck: spunUpTemplate(species, active), ...SUBAGENT_TRAINING }), moves: spunUpMoves(species) };
  return archetype(`graft-${species}-s`, {
    orchestrator: graftOrchestrator(),
    active: [intern(), spun],
    grid,
    autopilot: autopilotTemplate(rolesOf(GRAFT_STARTER)),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

// --- temperature dial -------------------------------------------------------------------------------------------

/** A copy of `a` whose Autopilot runs at `t`. */
function atTemperature(a: Archetype, t: Temperature): Archetype {
  const ap = a.side.autopilot;
  if (ap === undefined) throw new Error(`${a.id} has no Autopilot`);
  return { id: a.id, side: { ...a.side, autopilot: { deck: ap.deck, temperature: t } } };
}

/** The temperature dial's pairing for `a` (Ruling 143 I2: every archetype takes part): `a` at Autopilot T0, and its mirror at T4. */
export function temperaturePair(a: Archetype): [Archetype, Archetype] {
  return [atTemperature(a, 0), atTemperature(mirrorOf(a, 't4'), 4)];
}

// --- every setup ------------------------------------------------------------------------------------------------

/** Every target setup object, for the reports' content fingerprint (Ruling 143 I5). */
export function targetSetups(): Record<string, unknown> {
  return {
    triangle: TRIANGLE,
    starters: STARTERS.map(starterSide),
    base: baseTeam(),
    graft: GRAFT_SPECIES.map((sp) => [graftVariant(sp), spinUpVariant(sp)]),
    temperature: ARCHETYPES.map(temperaturePair),
  };
}
