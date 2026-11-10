// The three v0 battles as engine BattleSetups (plan "The v0 player journey"; Ruling 146 for the rival). The player is
// always side A and commands its orchestrator; every opponent is side B on Autopilot. Each setup passes
// validateSetup (test/unit/battles.test.ts). Sides are gridless in v0, so an orchestrator lists its species' moves.

import { fnv1a64Hex, SPECIES, type BattleSetup, type CreatureSetup, type SeedHex, type SideSetup, type Version } from '@latentia/engine';
import type { DistillChoice, FlowState, StarterId } from '../flow/flow.js';
import { BOOTCAMP_GRAD_DECK, kipDeck, tokenibbleDeck, WILD_TOKENIBBLE_DECK } from './trainers.js';

export type BattleId = 'rival' | 'wild' | 'trainer';

export interface BattleDef {
  readonly id: BattleId;
  /** The trainer's name for "Kip's Blitzr"; null for a wild model. */
  readonly opponent: string | null;
  /** The line the battle opens with. */
  readonly intro: string;
  /** What is said after a win and after a loss (a loss restarts the fight). */
  readonly win: string;
  readonly lose: string;
  readonly setup: BattleSetup;
  readonly seed: SeedHex;
}

const RIVAL_LEVEL = 5;
const WILD_LEVEL = 3;
const GRAD_LEVEL = 6;

/** Speed > Reasoning > Open > Speed: the starter that beats each one. */
const COUNTER: Readonly<Record<StarterId, StarterId>> = { sagelet: 'blitzr', blitzr: 'forkling', forkling: 'sagelet' };
export const counterStarter = (s: StarterId): StarterId => COUNTER[s];

/** The engine's version ladder at the v0 levels (v2 from L6). */
const versionAt = (level: number): Version => (level >= 6 ? 'v2' : 'v1');

type Species = keyof typeof SPECIES;

function creature(id: string, species: Species, level: number, extra: Partial<CreatureSetup> = {}): CreatureSetup {
  return { id, species, level, version: versionAt(level), moves: [...SPECIES[species].moves], ...extra };
}

/** A spun-up subagent's moves (bible "spin-up": it keeps the three launch moves; its signature stays behind). */
const spunUpMoves = (species: Species): string[] => SPECIES[species].moves.filter((m) => m !== SPECIES[species].signature);

const side = (orchestrator: CreatureSetup, opponentId: string, extra: Partial<SideSetup> = {}): SideSetup => ({
  orchestrator,
  active: [],
  bench: [],
  grid: null,
  opponentId,
  ...extra,
});

/** A seed per battle and attempt, so a rematch rolls differently but the same attempt always replays the same. */
export function seedFor(id: BattleId, attempt: number): SeedHex {
  const bytes = (s: string) => new TextEncoder().encode(s);
  return fnv1a64Hex(bytes(`latentia.v0.${id}.${attempt}`)) + fnv1a64Hex(bytes(`latentia.v0.${id}.${attempt}.lo`));
}

const PLAYER_ID = 'player';

export function rivalBattle(starter: StarterId, attempt: number): BattleDef {
  const kip = counterStarter(starter);
  return {
    id: 'rival',
    opponent: 'Kip',
    intro: `KIP: I picked ${SPECIES[kip].name}. It beats yours on paper. Paper is all the benchmarks are, anyway.`,
    win: "KIP: That run doesn't count. My context window was full of screenshots. Rematch at the next checkpoint!",
    lose: 'KIP: Benchmarks never lie! ...Okay, sometimes. Run it back? (Losing just restarts the fight.)',
    setup: {
      kind: 'trainer',
      a: side(creature(`you.${starter}`, starter, RIVAL_LEVEL), 'kip'),
      b: side(creature(`kip.${kip}`, kip, RIVAL_LEVEL), PLAYER_ID, { autopilot: { deck: kipDeck(kip), temperature: 2 } }),
    },
    seed: seedFor('rival', attempt),
  };
}

export function wildBattle(starter: StarterId, attempt: number): BattleDef {
  return {
    id: 'wild',
    opponent: null,
    intro: "A wild TOKENIBBLE crawls out of the cache, chewing on somebody's prompt.",
    win: 'The wild Tokenibble powers down, still nibbling. It looks... distillable.',
    lose: 'Tokenibble ate your whole context window. It wanders off, then wanders right back. Try again.',
    setup: {
      kind: 'wild',
      a: side(creature(`you.${starter}`, starter, RIVAL_LEVEL), 'wild.tokenibble'),
      b: side(creature('wild.tokenibble', 'tokenibble', WILD_LEVEL), PLAYER_ID, { autopilot: { deck: WILD_TOKENIBBLE_DECK, temperature: 2 } }),
    },
    seed: seedFor('wild', attempt),
  };
}

/**
 * The Bootcamp Grad. On the spin-up path Tokenibble fights beside the starter from its taught deck (one card above
 * Default), with its three non-signature moves. The graft path's grid, with Token Nibble grafted onto the orchestrator, is P4's; until then a grafting
 * player brings the starter alone.
 */
export function trainerBattle(starter: StarterId, distill: DistillChoice | null, tutorialCardId: string | null, attempt: number): BattleDef {
  const active =
    distill === 'spinUp'
      ? [creature('you.tokenibble', 'tokenibble', WILD_LEVEL, { moves: spunUpMoves('tokenibble'), deck: tokenibbleDeck(tutorialCardId), generalization: 55, trainedTemperature: 2 })]
      : [];
  return {
    id: 'trainer',
    opponent: 'Bootcamp Grad',
    intro: 'BOOTCAMP GRAD: Twelve weeks of bootcamp and my Vibrat accepts every suggestion. Every. Single. One.',
    win: 'BOOTCAMP GRAD: My Vibrat... accepted defeat. That was not in the curriculum.',
    lose: 'BOOTCAMP GRAD: Accept all, ship it, never look back!',
    setup: {
      kind: 'trainer',
      a: side(creature(`you.${starter}`, starter, RIVAL_LEVEL), 'bootcamp-grad', { active }),
      b: side(creature('grad.vibrat', 'vibrat', GRAD_LEVEL), PLAYER_ID, { autopilot: { deck: BOOTCAMP_GRAD_DECK, temperature: 2 } }),
    },
    seed: seedFor('trainer', attempt),
  };
}

/** The battle a flow step plays, or null for a step that is not a battle (or a battle with no starter yet). */
export function battleForStep(s: FlowState): BattleDef | null {
  if (s.starter === null) return null;
  switch (s.step) {
    case 'rival':
      return rivalBattle(s.starter, s.attempt);
    case 'wild':
      return wildBattle(s.starter, s.attempt);
    case 'trainer':
      return trainerBattle(s.starter, s.distill, s.tutorialCardId, s.attempt);
    default:
      return null;
  }
}
