import type { ValidationError } from './setup.js';

// Shared type-level checks for untrusted JSON (Ruling 75): the leaf helpers setup-shape.ts, validate-deck.ts and
// replay.ts build their shape errors with. Every error here has code `shape`; messages never print the value.

export type Rec = Record<string, unknown>;

export const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isNum = (v: unknown): v is number => typeof v === 'number';

export function shape(errors: ValidationError[], path: string, message: string): void {
  errors.push({ code: 'shape', path, message });
}

/** `path.key`; '' on either side is the root, so it adds nothing. */
export const join = (path: string, key: string): string => (path === '' ? key : key === '' ? path : `${path}.${key}`);

/** A `shape` error at `path.key` unless `r[key]` passes `ok`. */
export function field(r: Rec, key: string, path: string, ok: (v: unknown) => boolean, what: string, errors: ValidationError[]): void {
  if (!ok(r[key])) shape(errors, join(path, key), `${key} must be ${what}`);
}
