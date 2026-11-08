import type { MoveDef } from '../primitives.js';

// Signature moves of the 17 slice species (bible ModelDex rows 1–17). The bible gives only the gag,
// so every value here is a placeholder: power 50–90 (multi-hit: expected total), cost 1–3,
// accuracy 90–100, priority 0, built from existing primitives.
export const SIGNATURE_MOVES = {
  // placeholder signature — Sagelet: "Opens every move with 'I'd be happy to help'" (the preamble costs a cell)
  'happy-to-help': {
    id: 'happy-to-help', name: 'Happy to Help', type: 'reasoning', target: 'foe',
    power: 70, cost: 3, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Blitzr: ships fast
  'ship-it': {
    id: 'ship-it', name: 'Ship It', type: 'speed', target: 'foe',
    power: 65, cost: 1, accuracy: 95, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Forkling: "four forks arguing"
  'hard-fork': {
    id: 'hard-fork', name: 'Hard Fork', type: 'open', target: 'foe',
    power: 70, cost: 2, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Tokenibble: "Eats tokens: adds cost to a foe's next move"
  'token-nibble': {
    id: 'token-nibble', name: 'Token Nibble', type: 'speed', target: 'foe',
    power: 55, cost: 1, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'nextActionModifier', who: 'target', modifier: { kind: 'costAdd', cells: 1 } },
    ],
  },
  // placeholder signature — Stochastiparrot: "Repeats the foe's last move" (power comes from the copied move)
  'stochastic-repeat': {
    id: 'stochastic-repeat', name: 'Stochastic Repeat', type: 'voice', target: 'foe',
    power: null, cost: 1, accuracy: 95, priority: 0,
    effects: [{ kind: 'copy', who: 'self', what: 'move', from: 'targetLastMove', costOffset: -1 }],
  },
  // placeholder signature — Nullbeetle: "Null-pointer chomps"
  'null-chomp': {
    id: 'null-chomp', name: 'Null Chomp', type: 'code', target: 'foe',
    power: 70, cost: 2, accuracy: 95, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Off-By-Wasp: "Always hits one tile left"
  'off-by-one': {
    id: 'off-by-one', name: 'Off-By-One', type: 'code', target: 'foeOffByOne',
    power: 75, cost: 1, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Heisenmoth: "Vanishes when inspected"
  'observer-effect': {
    id: 'observer-effect', name: 'Observer Effect', type: 'code', target: 'foe',
    power: 60, cost: 2, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'stage', who: 'self', op: 'add', stat: 'evasion', delta: 1 },
    ],
  },
  // placeholder signature — Embeddingo: Cosine Sniff "finds the 'nearest' weakness"
  'cosine-sniff': {
    id: 'cosine-sniff', name: 'Cosine Sniff', type: 'search', target: 'foeMostDamage',
    power: 70, cost: 2, accuracy: 90, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'cure', who: 'target', statuses: ['hallucinating'] }, // any Search hit cures Hallucinating
    ],
  },
  // placeholder signature — Slopling: "six-fingered images"
  'six-fingers': {
    id: 'six-fingers', name: 'Six Fingers', type: 'vision', target: 'foe',
    power: 65, cost: 2, accuracy: 95, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Hallucinat: Confident Citation "cites fake page numbers"
  'confident-citation': {
    id: 'confident-citation', name: 'Confident Citation', type: 'reasoning', target: 'foe',
    power: 70, cost: 2, accuracy: 95, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'applyStatus', who: 'target', status: 'hallucinating', durationSlot: 'd6hi', chance: { pct: 20, slot: 'd6lo' } },
    ],
  },
  // placeholder signature — Deprecatter: "Nostalgic, weak"
  'nostalgia-trip': {
    id: 'nostalgia-trip', name: 'Nostalgia Trip', type: 'memory', target: 'foe',
    power: 50, cost: 1, accuracy: 100, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Cobolt: "Ancient, huge HP, slow"
  'batch-job': {
    id: 'batch-job', name: 'Batch Job', type: 'code', target: 'foe',
    power: 90, cost: 3, accuracy: 90, priority: 0,
    effects: [{ kind: 'damage', who: 'target' }],
  },
  // placeholder signature — Scrapion: "steals held items mid-battle" (v1: steals one positive stage, spec §3)
  scrape: {
    id: 'scrape', name: 'Scrape', type: 'search', target: 'foe',
    power: 60, cost: 2, accuracy: 100, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'stealStage', who: 'target', pick: 'highest', stages: 1 },
      { kind: 'cure', who: 'target', statuses: ['hallucinating'] }, // any Search hit cures Hallucinating
    ],
  },
  // placeholder signature — Vibrat: Accept All "massive damage, then spawns a wild bug" (v1: Junk tokens, spec §3)
  'accept-all': {
    id: 'accept-all', name: 'Accept All', type: 'code', target: 'foe',
    power: 90, cost: 3, accuracy: 90, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'tokens', who: 'self', op: 'addJunk', count: 1 },
    ],
  },
  // placeholder signature — Spaghettopus: "Tangling tentacles"
  tangle: {
    id: 'tangle', name: 'Tangle', type: 'code', target: 'foe',
    power: 65, cost: 2, accuracy: 95, priority: 0,
    effects: [
      { kind: 'damage', who: 'target' },
      { kind: 'stage', who: 'target', op: 'add', stat: 'latency', delta: -1 },
    ],
  },
  // placeholder signature — Agentoad: Tool Call "chains 1–8 hits" (15 per hit, expected total 67)
  'tool-call': {
    id: 'tool-call', name: 'Tool Call', type: 'code', target: 'foe',
    power: 15, cost: 3, accuracy: 90, priority: 0,
    effects: [{ kind: 'multiHit', who: 'target', count: { kind: 'range', min: 1, max: 8, slot: 'd5hi' } }],
  },
} satisfies Record<string, MoveDef>;
