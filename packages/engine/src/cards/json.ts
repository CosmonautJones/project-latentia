// Shared type-level checks for untrusted JSON (Ruling 75): the leaf helpers battle/setup-shape.ts, battle/replay.ts
// and cards/deck-shape.ts build their shape errors with. Every error here has code `shape`; messages never print the
// value. It lives in cards/ so that generalization/ can check decks without importing battle/ (Ruling 107).

/** One problem at a path; the same shape as ValidationError (battle/setup.ts) and GridError. */
export interface ShapeError {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export type Rec = Record<string, unknown>;

export const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number';

export function shape(errors: ShapeError[], path: string, message: string): void {
  errors.push({ code: 'shape', path, message });
}

/** `path.key`; '' on either side is the root, so it adds nothing. */
export const join = (path: string, key: string): string => (path === '' ? key : key === '' ? path : `${path}.${key}`);

/** A `shape` error at `path.key` unless `r[key]` passes `ok`. */
export function field(r: Rec, key: string, path: string, ok: (v: unknown) => boolean, what: string, errors: ShapeError[]): void {
  if (!ok(r[key])) shape(errors, join(path, key), `${key} must be ${what}`);
}
