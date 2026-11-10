// The v0 journey as a pure state machine (plan "The v0 player journey"). No Phaser, no storage: scenes send
// events, `transition` answers with the next state or a rejection, and the controller does the side effects.

export const STEPS = ['title', 'lab', 'rival', 'walk', 'wild', 'distill', 'cardTutorial', 'trainer', 'end'] as const;
export type Step = (typeof STEPS)[number];

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
  /** The example-card preset taught to Tokenibble in the card tutorial (spin-up path only). */
  readonly tutorialCardId: string | null;
}

export interface FlowState extends Progress {
  /** How many times the current battle has been lost; a new value restarts the battle scene. Not saved. */
  readonly attempt: number;
}

export type FlowEvent =
  | { readonly type: 'newGame' }
  | { readonly type: 'continue'; readonly progress: Progress }
  | { readonly type: 'starterPicked'; readonly starter: StarterId }
  | { readonly type: 'battleWon' }
  | { readonly type: 'battleLost' }
  | { readonly type: 'reachedTrailhead' }
  | { readonly type: 'distillChosen'; readonly choice: DistillChoice }
  | { readonly type: 'cardChosen'; readonly cardId: string }
  | { readonly type: 'backToTitle' };

export type TransitionResult = { readonly ok: true; readonly state: FlowState } | { readonly ok: false; readonly error: string };

export type SceneKey = 'Title' | 'Lab' | 'Overworld' | 'Battle' | 'End';

const SCENE_FOR_STEP: Readonly<Record<Step, SceneKey>> = {
  title: 'Title',
  lab: 'Lab',
  rival: 'Battle',
  walk: 'Overworld',
  wild: 'Battle',
  // The distill choice is made on the wild battle's result screen.
  distill: 'Battle',
  // The card tutorial is a menu over the trailhead, before the forest trainer.
  cardTutorial: 'Overworld',
  trainer: 'Battle',
  end: 'End',
};

export const sceneForStep = (step: Step): SceneKey => SCENE_FOR_STEP[step];

export const isBattleStep = (step: Step): step is BattleStep => (BATTLE_STEPS as readonly Step[]).includes(step);

export function initialFlow(): FlowState {
  return { step: 'title', starter: null, distill: null, tutorialCardId: null, attempt: 0 };
}

export function toProgress(s: FlowState): Progress {
  return { step: s.step, starter: s.starter, distill: s.distill, tutorialCardId: s.tutorialCardId };
}

const ORDER: Readonly<Record<Step, number>> = Object.fromEntries(STEPS.map((s, i) => [s, i])) as Record<Step, number>;
const atOrAfter = (step: Step, mark: Step): boolean => ORDER[step] >= ORDER[mark];

/** Whether a progress record could have come from playing: the choices present are exactly those already made. */
export function isConsistentProgress(p: Progress): boolean {
  if (p.step === 'title') return false;
  if (atOrAfter(p.step, 'rival') !== (p.starter !== null)) return false;
  if (atOrAfter(p.step, 'cardTutorial') !== (p.distill !== null)) return false;
  if (p.step === 'cardTutorial' && p.distill !== 'spinUp') return false;
  const cardDue = p.distill === 'spinUp' && atOrAfter(p.step, 'trainer');
  return cardDue === (p.tutorialCardId !== null);
}

const reject = (s: FlowState, e: FlowEvent): TransitionResult => ({ ok: false, error: `${e.type} is not valid at ${s.step}` });
const go = (s: FlowState, patch: Partial<FlowState>): TransitionResult => ({ ok: true, state: { ...s, attempt: 0, ...patch } });

export function transition(s: FlowState, e: FlowEvent): TransitionResult {
  switch (e.type) {
    case 'newGame':
      return s.step === 'title' ? go(initialFlow(), { step: 'lab' }) : reject(s, e);
    case 'continue':
      if (s.step !== 'title') return reject(s, e);
      if (!isConsistentProgress(e.progress)) return { ok: false, error: 'continue: inconsistent progress' };
      return go(initialFlow(), toProgress({ ...e.progress, attempt: 0 }));
    case 'starterPicked':
      return s.step === 'lab' ? go(s, { step: 'rival', starter: e.starter }) : reject(s, e);
    case 'battleWon':
      if (s.step === 'rival') return go(s, { step: 'walk' });
      if (s.step === 'wild') return go(s, { step: 'distill' });
      if (s.step === 'trainer') return go(s, { step: 'end' });
      return reject(s, e);
    case 'battleLost':
      // No game over: the same battle starts again.
      return isBattleStep(s.step) ? { ok: true, state: { ...s, attempt: s.attempt + 1 } } : reject(s, e);
    case 'reachedTrailhead':
      return s.step === 'walk' ? go(s, { step: 'wild' }) : reject(s, e);
    case 'distillChosen':
      if (s.step !== 'distill') return reject(s, e);
      return go(s, { step: e.choice === 'spinUp' ? 'cardTutorial' : 'trainer', distill: e.choice });
    case 'cardChosen':
      return s.step === 'cardTutorial' ? go(s, { step: 'trainer', tutorialCardId: e.cardId }) : reject(s, e);
    case 'backToTitle':
      // From the end card, or quitting mid-journey: the save stays, so Continue picks it up.
      return s.step !== 'title' ? go(s, { step: 'title' }) : reject(s, e);
  }
}
