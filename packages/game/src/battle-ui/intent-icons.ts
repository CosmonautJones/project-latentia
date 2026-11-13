// The telegraph's category icons (ruling V11), 7x7 pixel drawings in one colour each, so the category reads from its
// shape and its word as well as its colour: a sword for Attack, a shield for Guard, an up arrow for Buff, a down arrow
// for Debuff and a spark for Special.

import type Phaser from 'phaser';
import type { IntentCategory } from '../battle/telegraph.js';
import { COLOR } from '../ui/palette.js';

const ICONS: Readonly<Record<IntentCategory, readonly string[]>> = {
  attack: ['.....##', '....###', '...###.', '#.###..', '.###...', '.##....', '#.#....'],
  guard: ['#######', '#.....#', '#.###.#', '#.###.#', '.#.#.#.', '..#.#..', '...#...'],
  buff: ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...', '...#...'],
  debuff: ['...#...', '...#...', '...#...', '...#...', '.#####.', '..###..', '...#...'],
  special: ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
};

export const CATEGORY_COLOR: Readonly<Record<IntentCategory, number>> = {
  attack: COLOR.red,
  guard: COLOR.cyan,
  buff: COLOR.green,
  debuff: COLOR.magenta,
  special: COLOR.lemon,
};

/** Draw the category's icon with its top-left corner at (x, y). */
export function drawIntentIcon(g: Phaser.GameObjects.Graphics, category: IntentCategory, x: number, y: number): void {
  g.fillStyle(CATEGORY_COLOR[category]);
  ICONS[category].forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === '#') g.fillRect(x + dx, y + dy, 1, 1);
  });
}
