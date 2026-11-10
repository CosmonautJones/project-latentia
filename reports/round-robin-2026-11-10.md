# round-robin — 2026-11-10

- engine: `@latentia/engine` 0.4.1
- command: `pnpm sim round-robin --seeds 1000`
- seed scale: 1000 (seeds per ordered pairing)
- content fingerprint: a7b116a0136a651b (FNV-1a 64 of the canonical JSON of ARCHETYPES and the target setups)
- git: 0483c657c859a8a6340a6e0d31ddb1bb4cfb0777 (clean)
- seeds: 1,000 seeds per ordered pairing
- pairings: 20 archetypes → 190 unordered pairings → 380 ordered pairings
- battles: 380,000
- wall time: 422.1 s

## Fight length

Median 7 rounds; p25 6, p75 9, min 2, max 50; round-cap hits (BattleEnd reason cap) 210.

## Vs the field

Each archetype’s score over all of its battles (a draw counts 0.5), with its 95% Wilson interval, and the pairing (both orderings pooled) it scores worst in.

| archetype | battles | score | 95% interval | worst pairing | score there |
|---|---|---|---|---|---|
| reasoning-nuke-sagelet | 38000 | 80.6% | [80.2%, 81.0%] | speed-rush-blitzr | 19.0% |
| reasoning-nuke-hallucinat | 38000 | 71.9% | [71.4%, 72.3%] | speed-rush-blitzr | 24.8% |
| speed-rush-blitzr | 38000 | 67.9% | [67.4%, 68.3%] | open-swarm-forkling | 17.0% |
| search-anti-hallu-embeddingo | 38000 | 62.3% | [61.8%, 62.8%] | speed-rush-graft | 5.0% |
| open-swarm-forkling | 38000 | 61.4% | [60.9%, 61.9%] | reasoning-nuke-sagelet | 0.0% |
| mixed-starter-forkling | 38000 | 61.4% | [60.9%, 61.8%] | reasoning-nuke-sagelet | 9.2% |
| code-lock-spaghettopus | 38000 | 54.3% | [53.8%, 54.8%] | search-anti-hallu-embeddingo | 0.1% |
| search-anti-hallu-scrapion | 38000 | 54.0% | [53.5%, 54.6%] | search-anti-hallu-embeddingo | 2.2% |
| mixed-starter-sagelet | 38000 | 53.2% | [52.7%, 53.7%] | speed-rush-graft | 9.0% |
| speed-rush-agentoad | 38000 | 52.7% | [52.2%, 53.2%] | memory-stall-deprecatter | 16.5% |
| open-swarm-slopling | 38000 | 50.9% | [50.4%, 51.4%] | reasoning-nuke-sagelet | 0.1% |
| mixed-starter-blitzr | 38000 | 48.3% | [47.8%, 48.8%] | mixed-starter-forkling | 15.3% |
| speed-rush-graft | 38000 | 47.9% | [47.4%, 48.5%] | open-swarm-forkling | 2.2% |
| memory-stall-deprecatter | 38000 | 46.7% | [46.2%, 47.2%] | search-anti-hallu-embeddingo | 0.3% |
| voice-pressure-vibrat | 38000 | 39.8% | [39.3%, 40.3%] | search-anti-hallu-embeddingo | 10.4% |
| voice-pressure-parrot | 38000 | 39.3% | [38.8%, 39.8%] | code-lock-spaghettopus | 19.4% |
| mixed-heisenmoth-tempo | 38000 | 35.9% | [35.5%, 36.4%] | reasoning-nuke-sagelet | 0.9% |
| code-lock-cobolt | 38000 | 31.9% | [31.5%, 32.4%] | search-anti-hallu-embeddingo | 0.2% |
| memory-stall-retro | 38000 | 22.8% | [22.3%, 23.2%] | search-anti-hallu-embeddingo | 0.4% |
| code-lock-nullbeetle | 38000 | 16.8% | [16.4%, 17.2%] | reasoning-nuke-sagelet | 0.0% |
