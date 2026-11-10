// Reading a saved Progress back from untrusted JSON: every field checked, nothing thrown. A record that parses but
// could not have come from playing (flow isConsistentProgress) is rejected too.

import { BATTLE_STEPS, DISTILL_CHOICES, isConsistentProgress, STARTERS, STEPS, type Progress } from '../flow/flow.js';
import { FIGHT_LOG_CAP, type FightRecord, type FightReport, type Telemetry } from '../flow/telemetry.js';

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const oneOf = <T extends string>(values: readonly T[], v: unknown): v is T => typeof v === 'string' && (values as readonly string[]).includes(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const OUTCOMES = ['win', 'lose', 'draw'] as const;

function parseRecord(v: unknown): FightRecord | null {
  if (!isRecord(v)) return null;
  const { battle, outcome, rounds, moves, cardsFired, cardId } = v;
  if (!oneOf(BATTLE_STEPS, battle) || !oneOf(OUTCOMES, outcome)) return null;
  if (!count(rounds) || !count(moves) || !count(cardsFired)) return null;
  if (cardId !== null && typeof cardId !== 'string') return null;
  return { battle, outcome, rounds, moves, cardsFired, cardId };
}

function parseReport(v: unknown): FightReport | null {
  const record = parseRecord(v);
  if (record === null || !isRecord(v)) return null;
  const kept = v['kept'];
  if (!Array.isArray(kept) || !kept.every((l) => typeof l === 'string')) return null;
  return { ...record, kept: [...(kept as string[])] };
}

function parseTelemetry(v: unknown): Telemetry | null {
  if (!isRecord(v)) return null;
  const { losses, swaps, rematches, turns, moves, cardsFired, fights } = v;
  if (![losses, swaps, rematches, turns, moves, cardsFired].every(count)) return null;
  if (!Array.isArray(fights) || fights.length > FIGHT_LOG_CAP) return null;
  const log = fights.map(parseRecord);
  if (log.some((f) => f === null)) return null;
  return {
    losses: losses as number,
    swaps: swaps as number,
    rematches: rematches as number,
    turns: turns as number,
    moves: moves as number,
    cardsFired: cardsFired as number,
    fights: log as FightRecord[],
  };
}

export function parseProgress(v: unknown): Progress | null {
  if (!isRecord(v)) return null;
  const { step, starter, distill, tutorialCardId, trainerBeaten } = v;
  if (!oneOf(STEPS, step)) return null;
  if (starter !== null && !oneOf(STARTERS, starter)) return null;
  if (distill !== null && !oneOf(DISTILL_CHOICES, distill)) return null;
  if (tutorialCardId !== null && typeof tutorialCardId !== 'string') return null;
  if (typeof trainerBeaten !== 'boolean') return null;
  const lastFight = v['lastFight'] === null ? null : parseReport(v['lastFight']);
  if (v['lastFight'] !== null && lastFight === null) return null;
  const telemetry = parseTelemetry(v['telemetry']);
  if (telemetry === null) return null;
  const progress: Progress = { step, starter, distill, tutorialCardId, trainerBeaten, lastFight, telemetry };
  return isConsistentProgress(progress) ? progress : null;
}
