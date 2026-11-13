// The v0 journey as a pure state machine (plan "The v0 player journey"). No Phaser, no storage: scenes send
// events, `transition` answers with the next state or a rejection, and the controller does the side effects.
// The core loop (plan step 8): a trainer result goes to the `debrief`, which offers a rematch (with a swapped card on
// the spin-up path, or as is) and, once Bootcamp Grad has been beaten, the way on to the end card.

import { blankFight, NO_TELEMETRY, withFight, type FightReport, type Telemetry } from './telemetry.js';

export const STEPS = ['title', 'lab', 'rival', 'walk', 'wild', 'distill', 'cardTutorial', 'forest', 'trainer', 'debrief', 'end'] as const;
export type Step = (typeof STEPS)[number];

/**
 * The steps played on the overworld map: `lab` (the professor and the starter pick, in the lab), `walk` (lab to the
 * trailhead, the wild patch live), `cardTutorial` (a panel over the trailhead) and `forest` (after the distill, on to
 * Bootcamp Grad, whose sight starts the trainer battle).
 */
export const OVERWORLD_STEPS = ['lab', 'walk', 'cardTutorial', 'forest'] as const satisfies readonly Step[];
export type OverworldStep = (typeof OVERWORLD_STEPS)[number];
export const isOverworldStep = (step: Step): step is OverworldStep => (OVERWORLD_STEPS as readonly Step[]).includes(step);

export const BATTLE_STEPS = ['rival', 'wild', 'trainer'] as const satisfies readonly Step[];
export type BattleStep = (typeof BATTLE_STEPS)[number];

export const STARTERS = ['sagelet', 'blitzr', 'forkling'] as const;
export type StarterId = (typeof STARTERS)[number];

export const DISTILL_CHOICES = ['spinUp', 'graft'] as const;
export type DistillChoice = (typeof DISTILL_CHOICES)[number];

/** What a save stores: the step to resume at and the choices made so far. */
export interface Progress {
  readonly step: Step;
  readonly starter: StarterId | null;
  readonly distill: DistillChoice | null;
  /** The example-card preset taught to Tokenibble (spin-up path only); a debrief swap replaces it. */
  readonly tutorialCardId: string | null;
  /** Bootcamp Grad has been beaten at least once (the end card is open). */
  readonly trainerBeaten: boolean;
  /** The latest trainer fight, for the debrief. */
  readonly lastFight: FightReport | null;
  readonly telemetry: Telemetry;
}

export interface FlowState extends Progress {
  /**
   * Which run of the current battle this is (its seed); a new value restarts the battle scene. Not saved: a rival or
   * wild battle resumes at 0, a trainer fight at its rematch count.
   */
  readonly attempt: number;
}

export type FlowEvent =
  | { readonly type: 'newGame' }
  | { readonly type: 'continue'; readonly progress: Progress }
  | { readonly type: 'starterPicked'; readonly starter: StarterId }
  /** A battle's result, with the fight when the battle scene reports one (the dev hook may leave it out). */
  | { readonly type: 'battleWon'; readonly fight?: FightReport }
  | { readonly type: 'battleLost'; readonly fight?: FightReport }
  | { readonly type: 'reachedTrailhead' }
  | { readonly type: 'distillChosen'; readonly choice: DistillChoice }
  | { readonly type: 'cardChosen'; readonly cardId: string }
  /** Bootcamp Grad spotted the player (or was talked to) on the forest walk. */
  | { readonly type: 'trainerEngaged' }
  /** From the debrief: fight Bootcamp Grad again, teaching Tokenibble `cardId` first (null keeps the card). */
  | { readonly type: 'rematch'; readonly cardId: string | null }
  /** From the debrief, once the Grad is beaten: on to the end card. */
  | { readonly type: 'finish' }
  | { readonly type: 'backToTitle' };

export type TransitionResult = { readonly ok: true; readonly state: FlowState } | { readonly ok: false; readonly error: string };

export type SceneKey = 'Title' | 'Overworld' | 'Battle' | 'Distill' | 'Debrief' | 'End';

const SCENE_FOR_STEP: Readonly<Record<Step, SceneKey>> = {
  title: 'Title',
  // The professor and the starter pick happen in the lab, on the map.
  lab: 'Overworld',
  rival: 'Battle',
  walk: 'Overworld',
  wild: 'Battle',
  distill: 'Distill',
  // The card tutorial is a panel over the trailhead, before the forest trainer.
  cardTutorial: 'Overworld',
  forest: 'Overworld',
  trainer: 'Battle',
  debrief: 'Debrief',
  end: 'End',
};

export const sceneForStep = (step: Step): SceneKey => SCENE_FOR_STEP[step];

export const isBattleStep = (step: Step): step is BattleStep => (BATTLE_STEPS as readonly Step[]).includes(step);

export function initialFlow(): FlowState {
  return { step: 'title', starter: null, distill: null, tutorialCardId: null, trainerBeaten: false, lastFight: null, telemetry: NO_TELEMETRY, attempt: 0 };
}

export function toProgress(s: FlowState): Progress {
  return { step: s.step, starter: s.starter, distill: s.distill, tutorialCardId: s.tutorialCardId, trainerBeaten: s.trainerBeaten, lastFight: s.lastFight, telemetry: s.telemetry };
}

const ORDER: Readonly<Record<Step, number>> = Object.fromEntries(STEPS.map((s, i) => [s, i])) as Record<Step, number>;
const atOrAfter = (step: Step, mark: Step): boolean => ORDER[step] >= ORDER[mark];

/** Whether a progress record could have come from playing: the choices present are exactly those already made. */
export function isConsistentProgress(p: Progress): boolean {
  if (p.step === 'title') return false;
  if (atOrAfter(p.step, 'rival') !== (p.starter !== null)) return false;
  if (atOrAfter(p.step, 'cardTutorial') !== (p.distill !== null)) return false;
  if (p.step === 'cardTutorial' && p.distill !== 'spinUp') return false;
  const cardDue = p.distill === 'spinUp' && atOrAfter(p.step, 'forest');
  if (cardDue !== (p.tutorialCardId !== null)) return false;
  // Bootcamp Grad's results exist only from the trainer on; the debrief shows one, and the end card follows a win.
  if (p.trainerBeaten && !atOrAfter(p.step, 'trainer')) return false;
  if (p.lastFight !== null && !atOrAfter(p.step, 'trainer')) return false;
  if (p.step === 'debrief' && p.lastFight === null) return false;
  return p.step !== 'end' || p.trainerBeaten;
}

const reject = (s: FlowState, e: FlowEvent): TransitionResult => ({ ok: false, error: `${e.type} is not valid at ${s.step}` });
const go = (s: FlowState, patch: Partial<FlowState>): TransitionResult => ({ ok: true, state: { ...s, attempt: 0, ...patch } });

/** A battle result: the fight joins the telemetry; a trainer result opens the debrief, others move on or restart. */
function result(s: FlowState, won: boolean, fight: FightReport | undefined): TransitionResult {
  const telemetry = fight === undefined ? s.telemetry : withFight(s.telemetry, fight);
  if (s.step === 'trainer') {
    const lastFight = fight ?? blankFight(won ? 'win' : 'lose', s.tutorialCardId);
    if (won) return go(s, { step: 'debrief', trainerBeaten: true, lastFight, telemetry });
    return go(s, { step: 'debrief', lastFight, telemetry: { ...telemetry, losses: telemetry.losses + 1 } });
  }
  // No game over: a lost rival or wild battle starts again.
  if (!won) return { ok: true, state: { ...s, telemetry, attempt: s.attempt + 1 } };
  if (s.step === 'rival') return go(s, { step: 'walk', telemetry });
  return go(s, { step: 'distill', telemetry });
}

/** Back into the trainer fight from the debrief; a different card on the spin-up path is a swap. */
function rematch(s: FlowState, cardId: string | null): TransitionResult {
  if (s.distill === 'graft' && cardId !== null) return { ok: false, error: 'rematch: the graft path has no card to swap' };
  const swapped = cardId !== null && cardId !== s.tutorialCardId;
  const t = s.telemetry;
  const telemetry = { ...t, rematches: t.rematches + 1, swaps: t.swaps + (swapped ? 1 : 0) };
  return go(s, { step: 'trainer', tutorialCardId: cardId ?? s.tutorialCardId, telemetry, attempt: telemetry.rematches });
}

export function transition(s: FlowState, e: FlowEvent): TransitionResult {
  switch (e.type) {
    case 'newGame':
      return s.step === 'title' ? go(initialFlow(), { step: 'lab' }) : reject(s, e);
    case 'continue':
      if (s.step !== 'title') return reject(s, e);
      if (!isConsistentProgress(e.progress)) return { ok: false, error: 'continue: inconsistent progress' };
      // A trainer fight resumes on the seed it had reached, so Continue never replays an old rematch.
      return go(initialFlow(), { ...e.progress, attempt: e.progress.step === 'trainer' ? e.progress.telemetry.rematches : 0 });
    case 'starterPicked':
      return s.step === 'lab' ? go(s, { step: 'rival', starter: e.starter }) : reject(s, e);
    case 'battleWon':
    case 'battleLost':
      return isBattleStep(s.step) ? result(s, e.type === 'battleWon', e.fight) : reject(s, e);
    // The trailhead's wild patch: live only on the first walk, so the encounter fires once.
    case 'reachedTrailhead':
      return s.step === 'walk' ? go(s, { step: 'wild' }) : reject(s, e);
    case 'distillChosen':
      if (s.step !== 'distill') return reject(s, e);
      return go(s, { step: e.choice === 'spinUp' ? 'cardTutorial' : 'forest', distill: e.choice });
    case 'cardChosen':
      return s.step === 'cardTutorial' ? go(s, { step: 'forest', tutorialCardId: e.cardId }) : reject(s, e);
    case 'trainerEngaged':
      return s.step === 'forest' ? go(s, { step: 'trainer' }) : reject(s, e);
    case 'rematch':
      return s.step === 'debrief' ? rematch(s, e.cardId) : reject(s, e);
    case 'finish':
      return s.step === 'debrief' && s.trainerBeaten ? go(s, { step: 'end' }) : reject(s, e);
    case 'backToTitle':
      // From the end card, or quitting mid-journey: the save stays, so Continue picks it up.
      return s.step !== 'title' ? go(s, { step: 'title' }) : reject(s, e);
  }
}
