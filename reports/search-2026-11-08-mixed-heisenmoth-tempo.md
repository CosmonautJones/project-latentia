# search — 2026-11-08

- engine: `@latentia/engine` 0.3.0
- command: `pnpm sim search --archetype mixed-heisenmoth-tempo --budget 20000 --seed c5000000000000000000000000000004 --tag mixed-heisenmoth-tempo`
- archetype: mixed-heisenmoth-tempo
- seed: c5000000000000000000000000000004
- k: 16 seeds per foe per side (19 foes × 2 sides × 16 = 608 battles per evaluation)
- battlesUsed: 19456 of 20000 (unused: 544)
- acceptance margin: 1.0 pp on the search seeds
- evaluations: 32 (the base deck and 31 candidates; 5 accepted)
- stopped: the next evaluation would exceed the budget
- held-out battles: 1,216 (outside the budget: base and final deck, 608 each)
- wall time: 29.2 s (search and held-out check)

## Score history

Every deck is scored on the same seeds against the same field (common random numbers); a draw counts 0.5. A candidate is kept only when it scores at least 1.0 pp higher than the incumbent.
Accepted steps: 27.8% → 29.1% → 33.9% → 35.2% → 36.3% → 38.5%.

| evaluation | mutation | score | kept | best | battles used |
|---|---|---|---|---|---|
| 0 | base deck | 27.8% | yes | 27.8% | 608 |
| 1 | replace #1 (flash) with search-1: IF self has an ally at hp ≥ 50% THEN bounding-box → self | 17.8% | no | 27.8% | 1216 |
| 2 | replace #3 (drift) with search-2: IF orchestrator hp ≥ 75% THEN guardrail → orchestrator | 21.1% | no | 27.8% | 1824 |
| 3 | reorder #5 → #3 (nibble) | 28.5% | no | 27.8% | 2432 |
| 4 | reorder #6 → #7 (weak) | 27.8% | no | 27.8% | 3040 |
| 5 | reorder #1 → #5 (flash) | 27.6% | no | 27.8% | 3648 |
| 6 | reorder #8 → #2 (coin) | 29.1% | yes | 29.1% | 4256 |
| 7 | condition of #6 (nibble): foe hp < 25% → foe holds field junkPerRound | 29.3% | no | 29.1% | 4864 |
| 8 | condition of #3 (box): self has not used the move for 3 rounds → orchestrator context < 50% full | 30.1% | no | 29.1% | 5472 |
| 9 | replace #3 (box) with search-9: IF orchestrator is buffed THEN clear → self | 33.9% | yes | 33.9% | 6080 |
| 10 | reorder #3 → #8 (search-9) | 35.2% | yes | 35.2% | 6688 |
| 11 | condition of #4 (tidy): self context ≥ 75% full → foe holds field junkPerRound | 36.3% | yes | 36.3% | 7296 |
| 12 | move of #5 (nibble): token-nibble → compact (target lowestHpFoe → self) | 34.7% | no | 36.3% | 7904 |
| 13 | move of #7 (guard): guardrail → bounding-box | 36.0% | no | 36.3% | 8512 |
| 14 | replace #4 (tidy) with search-14: IF orchestrator is buffed THEN token-nibble → orchestratorTarget | 38.5% | yes | 38.5% | 9120 |
| 15 | move of #7 (guard): guardrail → observer-effect (target self → lowestHpFoe) | 38.3% | no | 38.5% | 9728 |
| 16 | move of #2 (coin): token-nibble → guardrail (target randomFoe → orchestrator) | 31.1% | no | 38.5% | 10336 |
| 17 | move of #6 (weak): flash-inference → bounding-box (target foeWeakToMove → orchestrator) | 34.5% | no | 38.5% | 10944 |
| 18 | reorder #3 → #7 (drift) | 38.5% | no | 38.5% | 11552 |
| 19 | replace #8 (search-9) with search-19: IF self holds field revealIntents THEN observer-effect → highestAtkFoe | 38.7% | no | 38.5% | 12160 |
| 20 | replace #5 (nibble) with search-20: IF foe is open type THEN flash-inference → foeWeakToMove | 38.3% | no | 38.5% | 12768 |
| 21 | reorder #3 → #8 (drift) | 38.5% | no | 38.5% | 13376 |
| 22 | reorder #6 → #4 (weak) | 38.5% | no | 38.5% | 13984 |
| 23 | reorder #8 → #4 (search-9) | 36.3% | no | 38.5% | 14592 |
| 24 | reorder #1 → #2 (flash) | 38.3% | no | 38.5% | 15200 |
| 25 | condition of #6 (weak): foe is weak to the move → orchestrator holds field revealTopDeckCard | 37.2% | no | 38.5% | 15808 |
| 26 | move of #6 (weak): flash-inference → bounding-box (target foeWeakToMove → lowestHpAlly) | 34.5% | no | 38.5% | 16416 |
| 27 | reorder #6 → #8 (weak) | 38.5% | no | 38.5% | 17024 |
| 28 | reorder #1 → #2 (flash) | 38.3% | no | 38.5% | 17632 |
| 29 | condition of #2 (coin): self coin flip → foe has quantized | 39.1% | no | 38.5% | 18240 |
| 30 | move of #8 (search-9): clear → token-nibble (target self → orchestratorTarget) | 38.7% | no | 38.5% | 18848 |
| 31 | condition of #8 (search-9): orchestrator is buffed → self is code type | 30.3% | no | 38.5% | 19456 |

## Final deck

Read top to bottom: the first card whose condition holds and whose move fits fires.

| priority | id | card |
|---|---|---|
| 1 | flash | IF foe hp < 50% THEN flash-inference → lowestHpFoe |
| 2 | coin | IF self coin flip THEN token-nibble → randomFoe |
| 3 | drift | IF self has drift THEN clear → self |
| 4 | search-14 | IF orchestrator is buffed THEN token-nibble → orchestratorTarget |
| 5 | nibble | IF foe hp < 25% THEN token-nibble → lowestHpFoe |
| 6 | weak | IF foe is weak to the move THEN flash-inference → foeWeakToMove |
| 7 | guard | IF self hp < 25% THEN guardrail → self |
| 8 | search-9 | IF orchestrator is buffed THEN clear → self |
| default | observe | OTHERWISE observer-effect → lowestHpFoe |

## Base deck

| priority | id | card |
|---|---|---|
| 1 | flash | IF foe hp < 50% THEN flash-inference → lowestHpFoe |
| 2 | box | IF self has not used the move for 3 rounds THEN bounding-box → self |
| 3 | drift | IF self has drift THEN clear → self |
| 4 | tidy | IF self context ≥ 75% full THEN compact → self |
| 5 | nibble | IF foe hp < 25% THEN token-nibble → lowestHpFoe |
| 6 | weak | IF foe is weak to the move THEN flash-inference → foeWeakToMove |
| 7 | guard | IF self hp < 25% THEN guardrail → self |
| 8 | coin | IF self coin flip THEN token-nibble → randomFoe |
| default | observe | OTHERWISE observer-effect → lowestHpFoe |

## Held-out check

The overfitting guard: each deck re-scored on fresh seeds (seedFor label search-heldout:mixed-heisenmoth-tempo, never seen by the search), the same field and k. The gap is search score minus held-out score.

| deck | search score | held-out score | held-out 95% interval | gap |
|---|---|---|---|---|
| base | 27.8% | 24.2% | [20.9%, 27.7%] | 3.6 pp |
| final | 38.5% | 35.2% | [31.5%, 39.1%] | 3.3 pp |
