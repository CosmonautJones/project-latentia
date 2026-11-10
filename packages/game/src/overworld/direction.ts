// The four grid directions, their tile deltas, and which held direction wins when several are down.

export const DIRS = ['down', 'up', 'left', 'right'] as const;
export type Dir = (typeof DIRS)[number];

export const DELTA: Readonly<Record<Dir, { readonly dx: number; readonly dy: number }>> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const isDir = (s: string): s is Dir => (DIRS as readonly string[]).includes(s);

export const OPPOSITE: Readonly<Record<Dir, Dir>> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Directions currently held, most recent last: the newest press steers, and releasing it falls back. */
export class HeldDirections {
  private held: Dir[] = [];

  press(d: Dir): void {
    this.held = [...this.held.filter((h) => h !== d), d];
  }

  release(d: Dir): void {
    this.held = this.held.filter((h) => h !== d);
  }

  clear(): void {
    this.held = [];
  }

  get current(): Dir | null {
    return this.held.at(-1) ?? null;
  }
}
