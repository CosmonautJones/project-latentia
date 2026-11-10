// Runs the pure flow: applies events, saves at each journey step, and switches to the step's scene.
// Phaser-free (the scene switch is injected), so it is unit-tested with a fake switcher and storage.

import { initialFlow, sceneForStep, toProgress, transition, type FlowEvent, type FlowState, type SceneKey } from './flow.js';
import { writeSave, type KeyValueStorage } from '../save/save.js';

export type SceneSwitcher = (scene: SceneKey, state: FlowState) => void;
export type FlowListener = (state: FlowState) => void;

export class FlowController {
  private current: FlowState = initialFlow();
  private listeners: FlowListener[] = [];

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
    this.enter(r.state);
    return true;
  }

  private enter(state: FlowState): void {
    this.current = state;
    // The title is never a resume point; every journey step is (Continue resumes at the step's start).
    if (state.step !== 'title') writeSave(this.storage, toProgress(state));
    for (const l of this.listeners) l(state);
    this.switchScene(sceneForStep(state.step), state);
  }
}
