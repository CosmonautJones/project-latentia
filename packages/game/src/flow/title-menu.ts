// The title menu's decisions, Phaser-free so they are unit-tested with the real FlowController and storage.
// With a save present, NEW GAME never starts over on one tap or press: it asks first, and only START OVER (which is
// never the default) erases the run. CANCEL and B go back to the title with the save untouched.

export type TitlePick = 'continue' | 'newGame' | 'confirmNewGame';

export const TITLE_MENU_ID = 'title';
export const CONFIRM_MENU_ID = 'title-confirm';
export const CONFIRM_TITLE = 'START OVER?';
export const CONFIRM_BODY = 'Your saved run will be erased.';
/** START OVER first, CANCEL second: a second tap in the same place, or a second A, lands on CANCEL. */
export const CONFIRM_ITEMS = ['START OVER', 'CANCEL'] as const;
/** The cursor opens on CANCEL. */
export const CONFIRM_DEFAULT = 1;

export function titleItems(hasSave: boolean): readonly string[] {
  return hasSave ? ['CONTINUE', 'NEW GAME'] : ['NEW GAME'];
}

/** What picking `item` on the title does. NEW GAME over an existing save opens the confirm panel. */
export function titlePick(item: string | undefined, hasSave: boolean): TitlePick {
  if (item === 'CONTINUE' && hasSave) return 'continue';
  return hasSave ? 'confirmNewGame' : 'newGame';
}

/** What a pick on the confirm panel does: only START OVER starts over. */
export function confirmPick(index: number): 'startOver' | 'back' {
  return CONFIRM_ITEMS[index] === 'START OVER' ? 'startOver' : 'back';
}
