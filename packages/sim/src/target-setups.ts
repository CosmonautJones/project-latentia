import { moveDef, SPECIES, SPECIES_IDS, type Card, type Condition, type Deck, type GridLayout, type PlacedPiece, type SpeciesId, type Subject, type TargetSelector, type Temperature } from '@latentia/engine';
import { ALWAYS, archetype, BUFFED, card, COIN, cooldown, deck, FULL, OPENER, orchestrator, subagent, WEAK, WEAK_TO_MOVE } from './archetypes/build.js';
import { ARCHETYPES, mirrorOf, starterGrid, type StarterId } from './archetypes/index.js';
import { STARTER_SKILLS } from './archetypes/starter-grids.js';
import type { Archetype } from './types.js';

// The balance targets' own setups (spec §9 table, Ruling 133). Ruling 130's 1 + 2 + 1 team rule is for ARCHETYPES
// and does not apply here; every setup still passes validateSetup (targets.test.ts). All creatures are L8 (v2).

const LEVEL = 8;
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

/** The moves an Autopilot template is instantiated with: the signature, the three Skills, and the coin card's move. */
export type TemplateMoves = { sig: string; K: string; M: string; L: string; coin: string };

/**
 * The one fixed 8-card Autopilot template every target orchestrator plays (Ruling 133), so no starter gets a
 * hand-tuned edge: the Default card is the signature; then L to open, M to finish a weak foe, the signature where it
 * is super effective, L again on a cooldown, K to punish a buff, Guardrail when weak, Compact when full, and a coin
 * card. The coin card holds K, except in graft-vs-spin-up variant G, where it aims the graft.
 */
export function autopilotTemplate(m: TemplateMoves): Deck {
  return deck(
    aimed('default', 'self', ALWAYS, m.sig, 'lowestHpFoe'),
    aimed('opener', 'self', OPENER, m.L, 'highestAtkFoe'),
    aimed('finish', 'foe', WEAK, m.M, 'lowestHpFoe'),
    aimed('weak', 'foe', WEAK_TO_MOVE, m.sig, 'foeWeakToMove'),
    aimed('ramp', 'self', cooldown(3), m.L, 'highestAtkFoe'),
    aimed('punish', 'foe', BUFFED, m.K, 'highestAtkFoe'),
    aimed('guard', 'self', WEAK, 'guardrail', 'self'),
    aimed('tidy', 'self', FULL, 'compact', 'self'),
    aimed('coin', 'self', COIN, m.coin, 'randomFoe'),
  );
}

const starterMoves = (s: StarterId, coin?: string): TemplateMoves => {
  const k = STARTER_SKILLS[s];
  return { sig: SPECIES[s].signature, K: k.K, M: k.M, L: k.L, coin: coin ?? k.K };
};

/**
 * The one fixed subagent deck template (3 cards, the active-card count of the starter grid's slot at v2): the Default
 * card is the signature; then its second move on a weak foe, its third to open, its fourth on a cooldown.
 */
export function subagentTemplate(species: SpeciesId): Deck {
  const [sig, m1, m2, m3] = SPECIES[species].moves as readonly [string, string, string, string];
  return deck(
    aimed('default', 'self', ALWAYS, sig, 'lowestHpFoe'),
    aimed('finish', 'foe', WEAK, m1, 'lowestHpFoe'),
    aimed('opener', 'self', OPENER, m2, 'randomFoe'),
    aimed('ramp', 'self', cooldown(3), m3, 'highestAtkFoe'),
  );
}

// --- starter triangle -------------------------------------------------------------------------------------------

/** [favoured, beaten]: Speed > Reasoning > Open > Speed (bible "starter triangle"), each starter vs the one it beats. */
export const TRIANGLE: readonly (readonly [StarterId, StarterId])[] = Object.freeze([
  Object.freeze(['blitzr', 'sagelet'] as const),
  Object.freeze(['sagelet', 'forkling'] as const),
  Object.freeze(['forkling', 'blitzr'] as const),
]);

/** A starter at L8 on its standard grid with Tokenibble L8 in its slot, both on the templates. */
export function starterSide(s: StarterId): Archetype {
  return archetype(`starter-${s}`, {
    orchestrator: orchestrator(s, s, LEVEL),
    active: [subagent('tokenibble', 'tokenibble', LEVEL, { deck: subagentTemplate('tokenibble'), ...SUBAGENT_TRAINING })],
    grid: starterGrid(s, LEVEL, 'tokenibble'),
    autopilot: autopilotTemplate(starterMoves(s)),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

// --- graft vs spin-up -------------------------------------------------------------------------------------------

/** The starter both graft-vs-spin-up variants are built on. */
export const GRAFT_STARTER: StarterId = 'sagelet';

/** Whether a graft shape (unrotated) fits the starter grid's 2×2 Subagent Slot footprint. */
const fitsSlot = (shape: readonly (readonly [number, number])[]): boolean => shape.every(([x, y]) => x <= 1 && y <= 1);

/** The first three non-starter slice species (SPECIES_IDS order) whose graft shape fits where the slot sits. */
export const GRAFT_SPECIES: readonly SpeciesId[] = Object.freeze(
  SPECIES_IDS.filter((s) => !(STARTERS as readonly string[]).includes(s) && fitsSlot(SPECIES[s].graftShape)).slice(0, 3),
);

/**
 * Variant S (spin up): the starter on its standard grid with `species` L8 as its one subagent, in the 2×2 slot with its
 * three Example Cards, on the subagent template.
 */
export function spinUpVariant(species: SpeciesId): Archetype {
  return archetype(`graft-${species}-s`, {
    orchestrator: orchestrator(GRAFT_STARTER, GRAFT_STARTER, LEVEL),
    active: [subagent(species, species, LEVEL, { deck: subagentTemplate(species), ...SUBAGENT_TRAINING })],
    grid: starterGrid(GRAFT_STARTER, LEVEL, species),
    autopilot: autopilotTemplate(starterMoves(GRAFT_STARTER)),
    temperature: TEMPLATE_TEMPERATURE,
  });
}

/**
 * Variant G (graft): the same grid with the slot and its three Example Cards (the spin-up's space, bible "Graft or
 * spin up") replaced by `species`' signature as a graft piece in the slot's place (its graftShape, unrotated, at the
 * slot's anchor and compaction position); no subagent; the Autopilot's coin card aims the graft instead of K.
 */
export function graftVariant(species: SpeciesId): Archetype {
  const base = starterGrid(GRAFT_STARTER, LEVEL, species);
  const sig = SPECIES[species].signature;
  const pieces = base.pieces.flatMap((p): PlacedPiece[] => {
    if (p.kind === 'exampleCard') return [];
    if (p.kind !== 'subagentSlot') return [p];
    return [{ id: `graft:${sig}`, kind: 'graft', moveId: sig, shape: SPECIES[species].graftShape, anchor: p.anchor, rotation: 0 }];
  });
  const grid: GridLayout = { ...base, pieces };
  return archetype(`graft-${species}-g`, {
    orchestrator: orchestrator(GRAFT_STARTER, GRAFT_STARTER, LEVEL),
    active: [],
    grid,
    autopilot: autopilotTemplate(starterMoves(GRAFT_STARTER, sig)),
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

/** The first `mixed-*` archetype (ARCHETYPES order) at Autopilot temperature 0, and its mirror at 4. */
export function temperatureSides(): [Archetype, Archetype] {
  const a = ARCHETYPES.find((x) => x.id.startsWith('mixed-'));
  if (a === undefined) throw new Error('no mixed archetype');
  return [atTemperature(a, 0), atTemperature(mirrorOf(a, 't4'), 4)];
}
