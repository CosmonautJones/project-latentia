import { COVERAGE_SCENARIOS } from './coverage-scenarios.js';
import { DECK_SCENARIOS } from './deck-scenarios.js';
import { cycle, gridded, mon, opened, scenario, setup, side, type GoldenScenario } from './builders.js';

// The golden battles (spec §8 "Golden files"): named, hand-designed setups with scripted commands that
// together use every move reachable in Phase A, apply every reachable status and pull every Phase A
// lever (move, move + injection, swap, directive, none, uncommanded sides, all five temperatures, grids),
// then the deck battles of Phase B (deck-scenarios.ts) and the B6 coverage battles (coverage-scenarios.ts).
// `pnpm golden:record` runs each through simulate and writes test/golden/<name>.json; golden.test.ts
// replays those logs. Changing a scenario changes its golden: re-record with --update.

export { seedFor, type GoldenScenario } from './builders.js';

// --- the scenarios -----------------------------------------------------------------------------

export const SCENARIOS: readonly GoldenScenario[] = [
  // One per slice species as a commanded orchestrator, cycling its four moves (together: every species
  // move). The showcased orchestrator out-levels the foes so it lives long enough to use them all.
  scenario(
    'sagelet-reasoning',
    setup(
      side('a', { orch: mon('a-sagelet', 'sagelet', 20), active: [mon('a-blitzr', 'blitzr', 12), mon('a-forkling', 'forkling', 12, ['community-patch', 'hard-fork'])], bench: [mon('a-tokenibble', 'tokenibble', 10)] }),
      side('b', { orch: mon('b-hallucinat', 'hallucinat', 14), active: [mon('b-parrot', 'stochastiparrot', 12, ['flattery', 'hot-take']), mon('b-nullbeetle', 'nullbeetle', 12, ['infinite-loop', 'null-chomp'])], bench: [mon('b-cobolt', 'cobolt', 12)] }),
    ),
    { a: cycle(['step-back-prompt', 'chain-of-thought', 'chain-of-thought', 'happy-to-help', 'proof-by-contradiction'], [2, 1]) },
  ),
  scenario(
    'blitzr-move-fast',
    setup(
      side('a', { orch: mon('a-blitzr', 'blitzr', 20), active: [mon('a-tokenibble', 'tokenibble', 12)], bench: [mon('a-sagelet', 'sagelet', 12)] }),
      side('b', { orch: mon('b-cobolt', 'cobolt', 16), active: [mon('b-nullbeetle', 'nullbeetle', 12, ['segfault', 'null-chomp']), mon('b-wasp', 'off-by-wasp', 12)], bench: [mon('b-heisenmoth', 'heisenmoth', 12)] }),
      'wild',
    ),
    { a: cycle(['low-latency', 'ship-it', 'distilled-strike', 'token-burst'], [3]), b: cycle(['long-term-recall', { move: 'hotfix', aim: 'ally' }, 'refactor', 'batch-job'], [0], 'foeSub') },
  ),
  scenario(
    'forkling-community-patch',
    setup(
      side('a', { orch: mon('a-forkling', 'forkling', 20), active: [mon('a-slopling', 'slopling', 12), mon('a-embeddingo', 'embeddingo', 12)] }),
      side('b', { orch: mon('b-spaghettopus', 'spaghettopus', 16), active: [mon('b-vibrat', 'vibrat', 12), mon('b-agentoad', 'agentoad', 12)], bench: [mon('b-deprecatter', 'deprecatter', 12)] }),
    ),
    { a: cycle([{ move: 'community-patch', aim: 'ally' }, 'hard-fork', 'swarm-of-fine-tunes', { move: 'leaderboard-flex', aim: 'foeOrch' }]), b: cycle(['memory-leak', 'tangle', 'infinite-loop', 'merge-conflict'], [1], 'foeSub') },
  ),
  scenario(
    'tokenibble-early-exit',
    setup(
      side('a', { orch: mon('a-tokenibble', 'tokenibble', 18), active: [mon('a-exit', 'tokenibble', 12, ['early-exit', 'token-nibble']), mon('a-deprecatter', 'deprecatter', 12)], bench: [mon('a-cobolt', 'cobolt', 12), mon('a-heisenmoth', 'heisenmoth', 12)] }),
      side('b', { orch: mon('b-sagelet', 'sagelet', 14), active: [mon('b-forkling', 'forkling', 12)], bench: [mon('b-blitzr', 'blitzr', 12)] }),
    ),
    { a: cycle(['early-exit', 'token-nibble', 'low-latency', 'token-burst']) },
  ),
  scenario(
    'stochastiparrot-glazed',
    setup(
      side('a', { orch: mon('a-parrot', 'stochastiparrot', 20), active: [mon('a-vibrat', 'vibrat', 12, ['hype-train', 'accept-all'])], bench: [mon('a-blitzr', 'blitzr', 12)] }),
      side('b', { orch: mon('b-embeddingo', 'embeddingo', 16), active: [mon('b-cobolt', 'cobolt', 12)], bench: [mon('b-tokenibble', 'tokenibble', 12)] }),
    ),
    { a: cycle(['flattery', 'hot-take', 'stochastic-repeat', 'hype-train'], [2], 'foeOrch'), b: cycle(['retrieval-strike', 'cosine-sniff', 'ground-truth', 'citation-needed'], [2], 'foeSub') },
  ),
  scenario(
    'nullbeetle-overfit',
    setup(
      side('a', { orch: mon('a-nullbeetle', 'nullbeetle', 20), active: [mon('a-wasp', 'off-by-wasp', 12, ['unit-test', 'off-by-one'])], bench: [mon('a-agentoad', 'agentoad', 12)] }),
      side('b', { orch: mon('b-blitzr', 'blitzr', 16), active: [mon('b-slopling', 'slopling', 12)], bench: [mon('b-scrapion', 'scrapion', 12)] }),
      'ghost',
    ),
    { a: cycle(['infinite-loop', 'segfault', 'unit-test', 'null-chomp'], [2], 'foeOrch'), b: cycle(['ship-it', 'ship-it', 'token-burst'], [2], 'foeSub') },
  ),
  scenario(
    'off-by-wasp-stack-trace',
    setup(
      side('a', { orch: mon('a-wasp', 'off-by-wasp', 20), active: [mon('a-agentoad', 'agentoad', 12)], bench: [mon('a-vibrat', 'vibrat', 12)] }),
      side('b', { orch: mon('b-heisenmoth', 'heisenmoth', 18), active: [mon('b-scrapion', 'scrapion', 12), mon('b-deprecatter', 'deprecatter', 12)] }),
    ),
    { a: cycle(['stack-trace', 'off-by-one', 'unit-test', 'token-burst'], [1]), b: cycle(['bounding-box', 'observer-effect', 'refactor', 'flash-inference'], [2], 'foeSub') },
  ),
  scenario(
    'embeddingo-hallucination-cures',
    setup(
      side('a', { orch: mon('a-embeddingo', 'embeddingo', 20), active: [mon('a-scrapion', 'scrapion', 12)], bench: [mon('a-sagelet', 'sagelet', 12)] }),
      side('b', { orch: mon('b-hallucinat', 'hallucinat', 18), active: [mon('b-slopling', 'slopling', 12, ['adversarial-patch', 'six-fingers'])], bench: [mon('b-hallucinat2', 'hallucinat', 12)] }),
    ),
    { a: cycle(['citation-needed', 'cosine-sniff', 'ground-truth', 'retrieval-strike']), b: cycle(['confident-citation', 'adversarial-patch', 'socratic-method', 'proof-by-contradiction'], [3, 4], 'foeSub') },
  ),
  scenario(
    'slopling-stacking',
    setup(
      side('a', { orch: mon('a-slopling', 'slopling', 20), active: [mon('a-slopling2', 'slopling', 12, ['swarm-of-fine-tunes', 'six-fingers'])], bench: [mon('a-cobolt', 'cobolt', 12)] }),
      side('b', { orch: mon('b-forkling', 'forkling', 16), active: [mon('b-sagelet', 'sagelet', 12)], bench: [mon('b-embeddingo', 'embeddingo', 12)] }),
    ),
    { a: cycle(['weights-dump', 'adversarial-patch', 'six-fingers', 'swarm-of-fine-tunes'], [2, 3]) },
  ),
  scenario(
    'hallucinat-socratic',
    setup(
      side('a', { orch: mon('a-hallucinat', 'hallucinat', 20), active: [mon('a-parrot', 'stochastiparrot', 12, ['stochastic-repeat', 'hype-train'])], bench: [mon('a-nullbeetle', 'nullbeetle', 12)] }),
      side('b', { orch: mon('b-agentoad', 'agentoad', 16), active: [mon('b-tokenibble', 'tokenibble', 12)], bench: [mon('b-forkling', 'forkling', 12)] }),
    ),
    { a: cycle(['socratic-method', 'confident-citation', 'adversarial-patch', 'proof-by-contradiction'], [2, 4], 'foeOrch'), b: cycle(['rerank', 'tool-call', 'stack-trace', 'token-burst'], [2], 'foeSub') },
  ),
  scenario(
    'deprecatter-save-state',
    setup(
      side('a', { orch: mon('a-deprecatter', 'deprecatter', 22), active: [mon('a-blitzr', 'blitzr', 12)], bench: [mon('a-forkling', 'forkling', 12)] }),
      side('b', { orch: mon('b-vibrat', 'vibrat', 16), active: [mon('b-spaghettopus', 'spaghettopus', 12)], bench: [mon('b-nullbeetle', 'nullbeetle', 12)] }),
    ),
    { a: cycle(['save-state', 'episodic-replay', 'nostalgia-trip', 'long-term-recall', 'long-term-recall']), b: cycle(['hype-train', 'accept-all', 'segfault', 'merge-conflict'], [2], 'foeOrch') },
  ),
  scenario(
    'cobolt-hotfix',
    setup(
      side('a', { orch: mon('a-cobolt', 'cobolt', 20), active: [mon('a-heisenmoth', 'heisenmoth', 12, ['refactor', 'observer-effect'])], bench: [mon('a-wasp', 'off-by-wasp', 12)] }),
      side('b', { orch: mon('b-scrapion', 'scrapion', 18), active: [mon('b-wasp', 'off-by-wasp', 12)], bench: [mon('b-blitzr', 'blitzr', 12)] }),
    ),
    { a: cycle(['refactor', 'batch-job', { move: 'hotfix', aim: 'ally' }, 'long-term-recall'], [0, 2]), b: cycle(['fact-check', 'scrape', 'merge-conflict', 'retrieval-strike'], [2], 'foeSub') },
  ),
  scenario(
    'scrapion-steals-buffs',
    setup(
      side('a', { orch: mon('a-scrapion', 'scrapion', 20), active: [mon('a-nullbeetle', 'nullbeetle', 12)], bench: [mon('a-sagelet', 'sagelet', 12)] }),
      side('b', { orch: mon('b-parrot', 'stochastiparrot', 16, ['hype-train', 'hot-take']), active: [mon('b-blitzr', 'blitzr', 12, ['low-latency', 'ship-it'])], bench: [mon('b-cobolt', 'cobolt', 12)] }),
    ),
    { a: cycle(['fact-check', 'scrape', 'merge-conflict', 'retrieval-strike'], [2], 'foeOrch') },
  ),
  scenario(
    'vibrat-accept-all',
    setup(
      side('a', { orch: mon('a-vibrat', 'vibrat', 20), active: [mon('a-cobolt', 'cobolt', 12)], bench: [mon('a-tokenibble', 'tokenibble', 12)] }),
      side('b', { orch: mon('b-off-by-wasp', 'off-by-wasp', 16), active: [mon('b-parrot', 'stochastiparrot', 12, ['hype-train', 'hot-take'])], bench: [mon('b-slopling', 'slopling', 12)] }),
    ),
    { a: cycle(['hype-train', 'accept-all', 'merge-conflict', 'segfault'], [2, 3]), b: cycle(['unit-test', 'off-by-one', 'stack-trace'], [2], 'foeSub') },
  ),
  scenario(
    'spaghettopus-memory-leak',
    setup(
      side('a', { orch: mon('a-spaghettopus', 'spaghettopus', 20), active: [mon('a-agentoad', 'agentoad', 12, ['tool-call', 'rerank'])], bench: [mon('a-blitzr', 'blitzr', 12)] }),
      side('b', { orch: mon('b-sagelet', 'sagelet', 16), active: [mon('b-embeddingo', 'embeddingo', 12)], bench: [mon('b-heisenmoth', 'heisenmoth', 12)] }),
    ),
    { a: cycle(['memory-leak', 'tangle', 'infinite-loop', 'merge-conflict'], [2], 'foeOrch') },
  ),
  scenario(
    'agentoad-rerank',
    setup(
      side('a', { orch: mon('a-agentoad', 'agentoad', 20), active: [mon('a-agentoad2', 'agentoad', 12), mon('a-blitzr', 'blitzr', 12)] }),
      side('b', { orch: mon('b-cobolt', 'cobolt', 16), active: [mon('b-tokenibble', 'tokenibble', 12)], bench: [mon('b-sagelet', 'sagelet', 12)] }),
    ),
    { a: cycle(['rerank', 'tool-call', 'stack-trace', 'token-burst'], [2, 1]) },
  ),

  // Context: overflow into Drift, Compact, /clear, Guardrail; Drift random moves and Wild effects at T3/T4.
  scenario(
    'context-compact-clear',
    setup(
      side('a', { orch: mon('a-cobolt', 'cobolt', 22), active: [mon('a-nullbeetle', 'nullbeetle', 12)], bench: [mon('a-forkling', 'forkling', 12)] }),
      side('b', { orch: mon('b-forkling', 'forkling', 22), active: [mon('b-slopling', 'slopling', 12)], bench: [mon('b-sagelet', 'sagelet', 12)] }),
    ),
    { a: cycle(['batch-job', 'batch-job', 'batch-job', 'batch-job', 'batch-job', 'compact', 'guardrail', 'clear'], [2], 'foeSub'), b: cycle(['hard-fork', 'guardrail', 'guardrail', 'compact'], [1], 'foeSub') },
  ),
  scenario(
    'drift-wild-t4',
    setup(
      side('a', { orch: mon('a-vibrat', 'vibrat', 16), active: [mon('a-hallucinat', 'hallucinat', 15)], bench: [mon('a-cobolt', 'cobolt', 15), mon('a-sagelet', 'sagelet', 15)] }),
      side('b', { orch: mon('b-heisenmoth', 'heisenmoth', 16), active: [mon('b-slopling', 'slopling', 15)], bench: [mon('b-nullbeetle', 'nullbeetle', 15), mon('b-forkling', 'forkling', 15)] }),
    ),
    { a: cycle(['accept-all', 'segfault', 'accept-all'], [4], 'foeSub'), b: cycle(['flash-inference', 'flash-inference', 'bounding-box'], [4, 3], 'foeSub') },
  ),
  scenario(
    'temperature-sweep',
    setup(
      side('a', { orch: mon('a-sagelet', 'sagelet', 18), active: [mon('a-wasp', 'off-by-wasp', 12)], bench: [mon('a-tokenibble', 'tokenibble', 12)] }),
      side('b', { orch: mon('b-blitzr', 'blitzr', 18), active: [mon('b-deprecatter', 'deprecatter', 12)], bench: [mon('b-cobolt', 'cobolt', 12)] }),
    ),
    { a: cycle(['happy-to-help', 'proof-by-contradiction'], [0, 1, 2, 3, 4], 'foeSub'), b: cycle(['distilled-strike', 'ship-it', 'compact'], [4, 3, 2, 1, 0], 'foeSub') },
  ),

  // Levers: Swap, Directive (accepted; executed from B3), none, injection payloads, uncommanded sides.
  scenario(
    'swap-lever',
    setup(
      side('a', { orch: mon('a-forkling', 'forkling', 18), active: [mon('a-tokenibble', 'tokenibble', 12), mon('a-nullbeetle', 'nullbeetle', 12)], bench: [mon('a-cobolt', 'cobolt', 12), mon('a-sagelet', 'sagelet', 12), mon('a-blitzr', 'blitzr', 12)] }),
      side('b', { orch: mon('b-spaghettopus', 'spaghettopus', 18), active: [mon('b-parrot', 'stochastiparrot', 12, ['flattery', 'hot-take']), mon('b-nullbeetle', 'nullbeetle', 12, ['infinite-loop', 'null-chomp'])], bench: [mon('b-vibrat', 'vibrat', 12)] }),
    ),
    { a: cycle(['hard-fork', { swap: { out: 0, in: 0 } }, 'swarm-of-fine-tunes', { swap: { out: 1, in: 1 } }, { move: 'community-patch', aim: 'ally' }]), b: cycle(['infinite-loop', { swap: { out: 1, in: 0 } }, 'tangle'], [2], 'foeSub') },
  ),
  scenario(
    'directive-and-none',
    setup(
      side('a', { orch: mon('a-sagelet', 'sagelet', 18), active: [mon('a-embeddingo', 'embeddingo', 12), mon('a-blitzr', 'blitzr', 12)] }),
      side('b', { orch: mon('b-hallucinat', 'hallucinat', 18), active: [mon('b-agentoad', 'agentoad', 12)], bench: [mon('b-scrapion', 'scrapion', 12)] }),
    ),
    { a: cycle([{ directive: { slot: 0, moveId: 'ground-truth' } }, 'none', 'chain-of-thought', { directive: { slot: 1 } }], [2, 0]), b: cycle(['none', 'confident-citation', { directive: { slot: 0, moveId: 'rerank' } }]) },
  ),
  scenario(
    'injection-payloads',
    setup(
      side('a', { orch: mon('a-scrapion', 'scrapion', 18), active: [mon('a-cobolt', 'cobolt', 12)], bench: [mon('a-agentoad', 'agentoad', 12)] }),
      side('b', { orch: mon('b-sagelet', 'sagelet', 18), active: [mon('b-blitzr', 'blitzr', 12)], bench: [mon('b-forkling', 'forkling', 12)] }),
    ),
    { a: cycle([{ move: 'scrape', inject: { moveId: 'happy-to-help', target: 1 } }, { move: 'retrieval-strike', inject: { moveId: 'deepfake-call', target: 3 } }, 'merge-conflict']), b: cycle([{ move: 'happy-to-help', inject: { moveId: 'token-burst', target: 0 } }, 'step-back-prompt']) },
  ),

  // Roster rules: Headless Mode, bench auto-fill, wild battles and the round-50 cap.
  scenario(
    'headless-and-autofill',
    setup(
      side('a', { orch: mon('a-tokenibble', 'tokenibble', 3), active: [mon('a-cobolt', 'cobolt', 14), mon('a-blitzr', 'blitzr', 12)], bench: [mon('a-forkling', 'forkling', 12), mon('a-sagelet', 'sagelet', 12)] }),
      side('b', { orch: mon('b-vibrat', 'vibrat', 14), active: [mon('b-scrapion', 'scrapion', 12), mon('b-spaghettopus', 'spaghettopus', 12)], bench: [mon('b-agentoad', 'agentoad', 12)] }),
    ),
    { a: cycle(['token-burst', 'low-latency']), b: cycle(['accept-all', 'segfault'], [2], 'foeOrch') },
  ),
  scenario(
    'full-rosters-uncommanded',
    setup(
      side('a', { orch: mon('a-cobolt', 'cobolt', 20), active: [mon('a-agentoad', 'agentoad', 18), mon('a-forkling', 'forkling', 18)], bench: [mon('a-blitzr', 'blitzr', 16), mon('a-embeddingo', 'embeddingo', 16), mon('a-slopling', 'slopling', 16)] }),
      side('b', { orch: mon('b-spaghettopus', 'spaghettopus', 20), active: [mon('b-hallucinat', 'hallucinat', 18), mon('b-scrapion', 'scrapion', 18)], bench: [mon('b-heisenmoth', 'heisenmoth', 16), mon('b-deprecatter', 'deprecatter', 16), mon('b-vibrat', 'vibrat', 16)] }),
      'wild',
    ),
    {},
  ),
  scenario(
    'round-cap-tiebreak',
    setup(
      side('a', { orch: mon('a-blitzr', 'blitzr', 30, ['token-burst', 'low-latency']) }),
      side('b', { orch: mon('b-parrot', 'stochastiparrot', 30, ['hype-train']) }),
    ),
    { a: opened([{ move: 'token-burst' }], cycle(['low-latency', 'compact', 'guardrail', 'clear'], [2, 0])), b: cycle(['hype-train', 'guardrail', 'compact', 'clear'], [1]) },
  ),

  scenario(
    'round-cap-draw',
    setup(
      side('a', { orch: mon('a-sagelet', 'sagelet', 25, ['step-back-prompt']) }),
      side('b', { orch: mon('b-cobolt', 'cobolt', 25, ['refactor']) }),
      'ghost',
    ),
    { a: cycle(['step-back-prompt', 'step-back-prompt', 'compact', 'clear'], [2, 3]), b: cycle(['refactor', 'guardrail', 'compact'], [4]) },
  ),
  scenario(
    'solo-duel-uncommanded',
    setup(side('a', { orch: mon('a-blitzr', 'blitzr', 15) }), side('b', { orch: mon('b-off-by-wasp', 'off-by-wasp', 15) }), 'wild'),
    {},
  ),

  // Trained subagents (Ruling 77): a subagent at trained T4 whose first move has a wildT4 list (Hot Take ×2),
  // a Robust subagent (generalization 80) whose examples were recorded from another opponent ('trainer-c', not
  // side B's 'trainer-b'), so its +5 applies (Ruling 80), and a side B with no active subagent (its bench is
  // auto-filled at the end of round 1).
  scenario(
    'trained-subagents',
    setup(
      side('a', {
        orch: mon('a-sagelet', 'sagelet', 14),
        active: [
          { ...mon('a-parrot', 'stochastiparrot', 12, ['hot-take', 'flattery']), trainedTemperature: 4 },
          { ...mon('a-embeddingo', 'embeddingo', 12), generalization: 80, recordedFoes: ['trainer-c'] },
        ],
      }),
      side('b', { orch: mon('b-cobolt', 'cobolt', 18), bench: [mon('b-nullbeetle', 'nullbeetle', 12), mon('b-heisenmoth', 'heisenmoth', 12)] }),
    ),
    { a: cycle(['chain-of-thought', 'happy-to-help'], [2]), b: cycle(['long-term-recall', 'refactor', 'batch-job'], [1]) },
  ),

  // The Context Grid: gridded orchestrators with skills, grafts, tools, a cache and forced compaction.
  scenario(
    'grid-l2-compaction',
    setup(
      gridded('a', 1, mon('a-vibrat', 'vibrat', 3), [mon('a-wasp', 'off-by-wasp', 6), mon('a-blitzr', 'blitzr', 6)], [mon('a-cobolt', 'cobolt', 6)]),
      gridded('b', 0, mon('b-sagelet', 'sagelet', 3), [mon('b-forkling', 'forkling', 6)], [mon('b-tokenibble', 'tokenibble', 6)]),
    ),
    { a: cycle(['accept-all', 'accept-all', 'accept-all', 'accept-all', 'compact'], [2], 'foeSub'), b: cycle(['happy-to-help', 'happy-to-help', 'happy-to-help', 'clear'], [3], 'foeSub') },
  ),
  scenario(
    'grid-l8-skills-graft',
    setup(
      gridded('a', 5, mon('a-hallucinat', 'hallucinat', 9), [mon('a-scrapion', 'scrapion', 8), mon('a-cobolt', 'cobolt', 8)], [mon('a-forkling', 'forkling', 8)], 4),
      gridded('b', 4, mon('b-spaghettopus', 'spaghettopus', 9), [mon('b-vibrat', 'vibrat', 8), mon('b-agentoad', 'agentoad', 8)], [mon('b-sagelet', 'sagelet', 8)]),
    ),
    { a: cycle(['confident-citation', 'socratic-method', 'batch-job', 'compact'], [2, 3], 'foeSub'), b: cycle(['tangle', 'infinite-loop', 'merge-conflict'], [2], 'foeSub') },
  ),
  scenario(
    'grid-l15-cache',
    setup(
      gridded('a', 9, mon('a-agentoad', 'agentoad', 18), [mon('a-heisenmoth', 'heisenmoth', 14), mon('a-deprecatter', 'deprecatter', 14)], [mon('a-forkling', 'forkling', 14)]),
      gridded('b', 8, mon('b-embeddingo', 'embeddingo', 18), [mon('b-slopling', 'slopling', 14), mon('b-hallucinat', 'hallucinat', 14)], [mon('b-cobolt', 'cobolt', 14)], 7),
    ),
    { a: cycle(['tool-call', 'stack-trace', 'rerank', 'token-burst'], [1, 2], 'foeSub'), b: cycle(['cosine-sniff', 'citation-needed', 'ground-truth', 'retrieval-strike'], [2], 'foeSub') },
  ),
  ...DECK_SCENARIOS,
  ...COVERAGE_SCENARIOS,
];
