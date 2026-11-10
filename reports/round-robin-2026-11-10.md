# round-robin — 2026-11-10

- engine: `@latentia/engine` 0.4.0
- command: `pnpm sim round-robin --seeds 1000`
- seed scale: 1000 (seeds per ordered pairing)
- content fingerprint: c3169bd34fb68888 (FNV-1a 64 of the canonical JSON of ARCHETYPES and the target setups)
- git: b4587a040001b54d736a9a8f769ef48a29c46124 (clean)
- seeds: 1,000 seeds per ordered pairing
- pairings: 20 archetypes → 190 unordered pairings → 380 ordered pairings
- battles: 380,000
- wall time: 461.2 s

## Fight length

Median 7 rounds; p25 6, p75 9, min 3, max 50; round-cap hits (BattleEnd reason cap) 129.

## Vs the field

Each archetype’s score over all of its battles (a draw counts 0.5), with its 95% Wilson interval, and the pairing (both orderings pooled) it scores worst in.

| archetype | battles | score | 95% interval | worst pairing | score there |
|---|---|---|---|---|---|
| reasoning-nuke-sagelet | 38000 | 85.3% | [85.0%, 85.7%] | speed-rush-blitzr | 22.4% |
| reasoning-nuke-hallucinat | 38000 | 74.5% | [74.0%, 74.9%] | speed-rush-blitzr | 26.1% |
| open-swarm-forkling | 38000 | 69.0% | [68.5%, 69.4%] | reasoning-nuke-sagelet | 0.0% |
| speed-rush-blitzr | 38000 | 67.9% | [67.4%, 68.3%] | open-swarm-forkling | 15.4% |
| mixed-starter-forkling | 38000 | 65.8% | [65.3%, 66.3%] | reasoning-nuke-sagelet | 8.6% |
| open-swarm-slopling | 38000 | 61.5% | [61.0%, 62.0%] | reasoning-nuke-sagelet | 1.8% |
| search-anti-hallu-scrapion | 38000 | 57.8% | [57.3%, 58.3%] | reasoning-nuke-hallucinat | 8.5% |
| search-anti-hallu-embeddingo | 38000 | 57.5% | [57.0%, 58.0%] | reasoning-nuke-sagelet | 1.1% |
| mixed-starter-sagelet | 38000 | 57.0% | [56.5%, 57.5%] | speed-rush-graft | 12.0% |
| mixed-starter-blitzr | 38000 | 49.5% | [49.0%, 50.0%] | mixed-starter-forkling | 15.1% |
| memory-stall-deprecatter | 38000 | 48.8% | [48.3%, 49.3%] | search-anti-hallu-scrapion | 0.3% |
| code-lock-spaghettopus | 38000 | 48.4% | [47.9%, 48.9%] | reasoning-nuke-sagelet | 0.1% |
| speed-rush-agentoad | 38000 | 48.0% | [47.5%, 48.5%] | memory-stall-deprecatter | 10.3% |
| speed-rush-graft | 38000 | 45.9% | [45.4%, 46.4%] | open-swarm-forkling | 0.4% |
| voice-pressure-vibrat | 38000 | 39.8% | [39.3%, 40.3%] | reasoning-nuke-sagelet | 10.4% |
| code-lock-cobolt | 38000 | 37.8% | [37.3%, 38.3%] | reasoning-nuke-sagelet | 0.1% |
| mixed-heisenmoth-tempo | 38000 | 26.7% | [26.3%, 27.2%] | reasoning-nuke-sagelet | 0.1% |
| voice-pressure-parrot | 38000 | 26.6% | [26.1%, 27.0%] | search-anti-hallu-embeddingo | 4.1% |
| memory-stall-retro | 38000 | 21.4% | [21.0%, 21.8%] | reasoning-nuke-sagelet | 0.3% |
| code-lock-nullbeetle | 38000 | 10.9% | [10.6%, 11.2%] | reasoning-nuke-sagelet | 0.0% |
