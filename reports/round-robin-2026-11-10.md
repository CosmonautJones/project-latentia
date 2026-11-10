# round-robin — 2026-11-10

- engine: `@latentia/engine` 0.3.0
- command: `pnpm sim round-robin --seeds 1000`
- seed scale: 1000 (seeds per ordered pairing)
- content fingerprint: 16228d6128370c89 (FNV-1a 64 of the canonical JSON of ARCHETYPES and the target setups)
- git: 269f0a9aea0cc108b1c93c939767ecfb89277235 (clean)
- seeds: 1,000 seeds per ordered pairing
- pairings: 20 archetypes → 190 unordered pairings → 380 ordered pairings
- battles: 380,000
- wall time: 420.0 s

## Fight length

Median 7 rounds; p25 6, p75 9, min 2, max 50; round-cap hits (BattleEnd reason cap) 135.

## Vs the field

Each archetype’s score over all of its battles (a draw counts 0.5), with its 95% Wilson interval, and the pairing (both orderings pooled) it scores worst in.

| archetype | battles | score | 95% interval | worst pairing | score there |
|---|---|---|---|---|---|
| reasoning-nuke-sagelet | 38000 | 84.1% | [83.7%, 84.4%] | speed-rush-blitzr | 14.8% |
| reasoning-nuke-hallucinat | 38000 | 75.8% | [75.3%, 76.2%] | mixed-starter-sagelet | 14.1% |
| speed-rush-blitzr | 38000 | 66.9% | [66.4%, 67.4%] | open-swarm-forkling | 12.2% |
| mixed-starter-forkling | 38000 | 66.4% | [65.9%, 66.9%] | reasoning-nuke-sagelet | 7.3% |
| mixed-starter-sagelet | 38000 | 62.5% | [62.0%, 63.0%] | speed-rush-graft | 5.3% |
| search-anti-hallu-embeddingo | 38000 | 59.0% | [58.5%, 59.5%] | reasoning-nuke-sagelet | 1.8% |
| open-swarm-slopling | 38000 | 58.7% | [58.2%, 59.2%] | reasoning-nuke-sagelet | 0.4% |
| open-swarm-forkling | 38000 | 57.6% | [57.1%, 58.1%] | reasoning-nuke-sagelet | 0.0% |
| search-anti-hallu-scrapion | 38000 | 55.0% | [54.5%, 55.5%] | reasoning-nuke-sagelet | 1.7% |
| mixed-starter-blitzr | 38000 | 54.0% | [53.5%, 54.5%] | mixed-starter-forkling | 17.1% |
| code-lock-spaghettopus | 38000 | 47.8% | [47.3%, 48.3%] | reasoning-nuke-sagelet | 0.0% |
| speed-rush-agentoad | 38000 | 47.7% | [47.2%, 48.2%] | memory-stall-deprecatter | 6.5% |
| speed-rush-graft | 38000 | 47.0% | [46.5%, 47.5%] | open-swarm-forkling | 0.9% |
| memory-stall-deprecatter | 38000 | 46.9% | [46.4%, 47.4%] | search-anti-hallu-scrapion | 0.0% |
| voice-pressure-vibrat | 38000 | 43.5% | [43.0%, 44.0%] | reasoning-nuke-sagelet | 10.2% |
| code-lock-cobolt | 38000 | 38.1% | [37.6%, 38.5%] | reasoning-nuke-sagelet | 0.0% |
| voice-pressure-parrot | 38000 | 29.9% | [29.5%, 30.4%] | reasoning-nuke-sagelet | 2.8% |
| mixed-heisenmoth-tempo | 38000 | 27.4% | [27.0%, 27.9%] | code-lock-spaghettopus | 0.0% |
| memory-stall-retro | 38000 | 21.1% | [20.7%, 21.5%] | reasoning-nuke-sagelet | 0.4% |
| code-lock-nullbeetle | 38000 | 10.9% | [10.5%, 11.2%] | reasoning-nuke-hallucinat | 0.0% |
