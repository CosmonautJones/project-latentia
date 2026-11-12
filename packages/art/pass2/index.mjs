// Every pass-2 asset, in sheet order. Each module's default export is its drawn frames.
export const ASSETS = [
  { name: 'tokenibble', type: 'battle', load: () => import('./battle/tokenibble.mjs') },
  { name: 'vibrat', type: 'battle', load: () => import('./battle/vibrat.mjs') },
  { name: 'sagelet', type: 'battle', load: () => import('./battle/sagelet.mjs') },
  { name: 'blitzr', type: 'battle', load: () => import('./battle/blitzr.mjs') },
];
