// The v0 overworld: Professor Epoch's lab, then Localhost, a short path, and the Deprecated Forest trailhead, west to
// east (plan task P3). Authored as typed character grids read through the legend in overworld/map.ts:
//
//   W wall   K server rack   _ floor   D door (a warp)   R roof   . grass   , path   # tree   % autumn tree
//   S sign   " unindexed data (the wild patch)
//
// The exterior is 48x13 tiles (2.4 screens wide). The patch is the only way into the trailhead clearing, so the
// scripted wild Tokenibble can't be skipped; Bootcamp Grad stands in the one-tile gap east of the clearing and
// faces back down it (sight 4). test/unit/overworld-map.test.ts validates all of this.

import { parseWorld, type World, type WorldSource } from '../../overworld/map.js';

const LAB = [
  'WWWWWWWWWWWW',
  'WKKWWWWWWKKW',
  'W__________W',
  'W__________W',
  'W__________W',
  'W__________W',
  'W__________W',
  'WWWWWDWWWWWW',
];

// Localhost x0-17 | the path x18-29 | the trailhead x30-47.
const OUTSIDE = [
  '##############################%%%%%%%%%%%%%%%%%%',
  '#.RRRRRRR...#.....############%%%%%....%%%%%%%%%',
  '#.RRRRRRR.........###########%S"""".....%%%%%%%%',
  '#.WWWDWWW.........####,,,,,,,,.""""......%%%%%%%',
  '#....,..........######,,,,,,,,.""""......%%%%%%%',
  '#....,..........######,,######%"""".....%%%%%%%%',
  '#....,,,,,,,,,,,,,,,,,,,######%%%%%....,,,,,,,,,',
  '#..#.....#..,,,,,,,,,,,,######%%%%%.....%%%%%%%%',
  '#.....#.........##############%%%%%%....%%%%%%%%',
  '#..#.........#..##############%%%%%%%..%%%%%%%%%',
  '#.......#.......##############%%%%%%%%%%%%%%%%%%',
  '##..#.......#..###############%%%%%%%%%%%%%%%%%%',
  '##############################%%%%%%%%%%%%%%%%%%',
];

export const LOCALHOST_SOURCE: WorldSource = {
  areas: {
    lab: { name: "Prof. Epoch's lab", rows: LAB },
    outside: { name: 'Localhost', rows: OUTSIDE, regions: [{ fromX: 30, name: 'Deprecated Forest — Trailhead' }] },
  },
  signs: [{ at: { area: 'outside', x: 30, y: 2 }, text: 'Deprecated Forest. Models here were sunset, not deleted.' }],
  npcs: [
    {
      id: 'professor',
      at: { area: 'lab', x: 5, y: 2, facing: 'down' },
      line: "PROF. EPOCH: The Deprecated Forest is east of town. Beat a wild model there, then distill it. We don't 'catch' them. Legal was very clear.",
      lines: { forest: 'PROF. EPOCH: A distilled model already! They grow up so fast. Then they get deprecated.' },
    },
    {
      // The rival, who picked the starter that beats yours, waits by the racks.
      id: 'kip',
      at: { area: 'lab', x: 8, y: 3, facing: 'left' },
      line: "KIP: One loss is a sample size of one. I'm not retraining over a sample size of one.",
      lines: { forest: "KIP: You distilled one already? I'm still reading its license. All forty pages." },
    },
    {
      id: 'farmer',
      at: { area: 'outside', x: 13, y: 5, facing: 'down' },
      line: "FARMER: My irrigation feeds the cooling towers now. The corn's thirsty, but the PR bot says we're water-positive. By 2040. Projected.",
    },
  ],
  trainer: {
    id: 'bootcamp-grad',
    at: { area: 'outside', x: 39, y: 6, facing: 'left' },
    sight: 4,
    line: 'BOOTCAMP GRAD: No distilled model, no battle. Twelve weeks of bootcamp taught me that much.',
    engage: 'BOOTCAMP GRAD: I finished a 12-week bootcamp. That makes me senior now. Battle me!',
  },
  warps: [
    { from: { area: 'lab', x: 5, y: 7 }, to: { area: 'outside', x: 5, y: 4, facing: 'down' } },
    { from: { area: 'outside', x: 5, y: 3 }, to: { area: 'lab', x: 5, y: 6, facing: 'up' } },
  ],
  encounter: { area: 'outside', lurk: { x: 32, y: 3 } },
  spawns: {
    // The start of the journey: facing Prof. Epoch, for his intro and the starter pick.
    lab: { area: 'lab', x: 5, y: 3, facing: 'up' },
    // After the rival fight: in the lab, a step from the professor, turned for the door.
    walk: { area: 'lab', x: 5, y: 4, facing: 'down' },
    // After the distill: where Tokenibble was, at the patch's east edge, facing the clearing.
    cardTutorial: { area: 'outside', x: 34, y: 4, facing: 'right' },
    forest: { area: 'outside', x: 34, y: 4, facing: 'right' },
  },
};

export const LOCALHOST: World = parseWorld(LOCALHOST_SOURCE);
