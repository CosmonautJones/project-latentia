// Every pass-2 asset, in sheet order. Each module's default export is its drawn frames.
export const ASSETS = [
  { name: 'tokenibble', type: 'battle', load: () => import('./battle/tokenibble.mjs') },
  { name: 'vibrat', type: 'battle', load: () => import('./battle/vibrat.mjs') },
  { name: 'sagelet', type: 'battle', load: () => import('./battle/sagelet.mjs') },
  { name: 'blitzr', type: 'battle', load: () => import('./battle/blitzr.mjs') },
  { name: 'forkling', type: 'battle', load: () => import('./battle/forkling.mjs') },
  { name: 'tiles', type: 'tiles', load: () => import('./tiles.mjs') },
  { name: 'player', type: 'char', load: () => import('./chars/all.mjs').then((m) => ({ default: m.player })) },
  { name: 'kip', type: 'char', load: () => import('./chars/all.mjs').then((m) => ({ default: m.kip })) },
  { name: 'professor', type: 'char', load: () => import('./chars/all.mjs').then((m) => ({ default: m.professor })) },
  { name: 'grad', type: 'char', load: () => import('./chars/all.mjs').then((m) => ({ default: m.grad })) },
  { name: 'farmer', type: 'char', load: () => import('./chars/all.mjs').then((m) => ({ default: m.farmer })) },
];
