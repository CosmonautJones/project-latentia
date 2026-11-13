// The battle menu's data for the current round and screen geometry: the moves, their targets, the log, and how the
// band lays them out (columns, pages, direct mode). Rebuilt on every input and every relayout, never cached, so a
// rotation always pages the list for the new grid (review I-2).

import type { BattleGeometry } from '../battle-ui/stage-layout.js';
import type { MenuData } from './battle-menu.js';
import type { BattleSession } from './session.js';

export function menuDataFor(
  session: Pick<BattleSession, 'moveOptions' | 'targetsFor' | 'shortName'>,
  g: Pick<BattleGeometry, 'rows' | 'columns' | 'direct'>,
  log: readonly string[],
  tempUnlocked: boolean,
): MenuData {
  const moves = session.moveOptions();
  const slots = g.rows * g.columns;
  return {
    moves,
    targets: (id) => session.targetsFor(id),
    targetName: (i) => session.shortName(i),
    log,
    tempUnlocked,
    columns: g.columns,
    direct: g.direct,
    // The last slot of a page is MORE.
    ...(moves.length > slots ? { pageSize: slots - 1 } : {}),
  };
}
