// Caller mistakes in computeGeneralization (Ruling 107), thrown in the style of SetupError: a typed error with a
// `code`. `activeSlots`: not an integer in 0..MAX_ACTIVE_SLOTS. `suiteSize`: the suite does not hold exactly
// EVAL_SUITE_SIZE scenarios. `deck`: the deck is malformed (not shaped like a deck, no Default card, a card id
// used twice, which would make a card read as the Default or two cards read as one, or a move id the content does
// not have, Ruling 119 m7).

export type GeneralizationErrorCode = 'activeSlots' | 'suiteSize' | 'deck';

export class GeneralizationError extends Error {
  readonly code: GeneralizationErrorCode;

  constructor(code: GeneralizationErrorCode, message: string) {
    super(`computeGeneralization ${code}: ${message}`);
    this.name = 'GeneralizationError';
    this.code = code;
  }
}
