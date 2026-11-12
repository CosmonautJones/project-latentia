// Runs the pure flow: applies events, saves at each journey step, and switches to the step's scene.
// Phaser-free (the scene switch is injected), so it is unit-tested with a fake switcher and storage.

import { initialFlow, sceneForStep, toProgress, transition, type FlowEvent, type FlowState, type SceneKey } from './flow.js';
import { loadSave, NO_UNLOCKS, writeSave, type KeyValueStorage, type Unlocks } from '../save/save.js';

export type SceneSwitcher = (scene: SceneKey, state: FlowState) => void;
export type FlowListener = (state: FlowState) => void;

export class FlowController {
  private current: FlowState = initialFlow();
  private listeners: FlowListener[] = [];
  /** One-time hints already shown in this playthrough; saved alongside the progress. */
  private hints: readonly string[] = [];
  /** What the save has unlocked (the temperature dial, V12); kept across a new game, since it belongs to the player. */
  private unlocked: Unlocks = NO_UNLOCKS;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly switchScene: SceneSwitcher,
  ) {}

  get state(): FlowState {
    return this.current;
  }

  onChange(listener: FlowListener): () => void {
    this.listeners = [...this.listeners, listener];
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /** Boot into the title screen. */
  start(): void {
    this.enter(initialFlow());
  }

  /** Apply an event. Returns false, changing nothing, when the flow rejects it. */
  send(event: FlowEvent): boolean {
    const r = transition(this.current, event);
    if (!r.ok) return false;
    if (event.type === 'newGame') this.hints = [];
    if (event.type === 'continue') {
      const saved = loadSave(this.storage);
      this.hints = saved.status === 'ok' ? saved.save.hintsSeen : [];
      this.unlocked = saved.status === 'ok' ? saved.save.unlocks : NO_UNLOCKS;
    }
    this.enter(r.state);
    return true;
  }

  get unlocks(): Unlocks {
    return this.unlocked;
  }

  hasSeenHint(id: string): boolean {
    return this.hints.includes(id);
  }

  /** Remember a shown hint and save it now, without leaving the scene (outside the title). */
  markHintSeen(id: string): void {
    if (this.hints.includes(id)) return;
    this.hints = [...this.hints, id];
    if (this.current.step !== 'title') writeSave(this.storage, toProgress(this.current), this.hints, this.unlocked);
  }

  private enter(state: FlowState): void {
    this.current = state;
    // The title is never a resume point; every journey step is (Continue resumes at the step's start).
    if (state.step !== 'title') writeSave(this.storage, toProgress(state), this.hints, this.unlocked);
    for (const l of this.listeners) l(state);
    this.switchScene(sceneForStep(state.step), state);
  }
}
