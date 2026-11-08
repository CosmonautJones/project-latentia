# search — 2026-11-08

- engine: `@latentia/engine` 0.3.0
- command: `pnpm sim search --archetype speed-rush-blitzr --budget 20000 --seed c5000000000000000000000000000001 --tag speed-rush-blitzr`
- archetype: speed-rush-blitzr
- seed: c5000000000000000000000000000001
- k: 16 seeds per foe per side (19 foes × 2 sides × 16 = 608 battles per evaluation)
- battlesUsed: 19456 of 20000 (unused: 544)
- acceptance margin: 1.0 pp on the search seeds
- evaluations: 32 (the base deck and 31 candidates; 1 accepted)
- stopped: the next evaluation would exceed the budget
- held-out battles: 1,216 (outside the budget: base and final deck, 608 each)
- wall time: 22.9 s (search and held-out check)

## Score history

Every deck is scored on the same seeds against the same field (common random numbers); a draw counts 0.5. A candidate is kept only when it scores at least 1.0 pp higher than the incumbent.
Accepted steps: 67.1% → 68.4%.

| evaluation | mutation | score | kept | best | battles used |
|---|---|---|---|---|---|
| 0 | base deck | 67.1% | yes | 67.1% | 608 |
| 1 | condition of #6 (guard): self hp < 25% → foe is open type | 65.3% | no | 67.1% | 1216 |
| 2 | move of #2 (drift): compact → token-burst (target self → lowestHpFoe) | 67.1% | no | 67.1% | 1824 |
| 3 | reorder #2 → #4 (drift) | 67.1% | no | 67.1% | 2432 |
| 4 | replace #1 (finish) with search-4: IF orchestrator is buffed THEN guardrail → orchestrator | 66.0% | no | 67.1% | 3040 |
| 5 | move of #1 (finish): token-burst → compact (target lowestHpFoe → orchestrator) | 63.7% | no | 67.1% | 3648 |
| 6 | move of #8 (coin): distilled-strike → token-burst | 64.3% | no | 67.1% | 4256 |
| 7 | replace #5 (weak) with search-7: IF foe is telegraphing THEN compact → self | 64.0% | no | 67.1% | 4864 |
| 8 | replace #6 (guard) with search-8: IF self has not used the move for 1 round THEN token-burst → randomFoe | 66.3% | no | 67.1% | 5472 |
| 9 | move of #3 (tidy): compact → token-burst (target self → lowestHpFoe) | 67.8% | no | 67.1% | 6080 |
| 10 | replace #7 (hurt) with search-10: IF orchestrator is telegraphing THEN token-burst → lowestHpFoe | 66.6% | no | 67.1% | 6688 |
| 11 | replace #5 (weak) with search-11: IF foe is voice type THEN distilled-strike → orchestratorTarget | 63.8% | no | 67.1% | 7296 |
| 12 | condition of #3 (tidy): self context ≥ 75% full → self has quantized | 68.4% | yes | 68.4% | 7904 |
| 13 | replace #1 (finish) with search-13: IF orchestrator is telegraphing THEN token-burst → lowestHpFoe | 66.4% | no | 68.4% | 8512 |
| 14 | move of #8 (coin): distilled-strike → clear (target randomFoe → self) | 59.7% | no | 68.4% | 9120 |
| 15 | move of #8 (coin): distilled-strike → clear (target randomFoe → orchestrator) | 59.7% | no | 68.4% | 9728 |
| 16 | reorder #2 → #1 (drift) | 68.3% | no | 68.4% | 10336 |
| 17 | reorder #4 → #6 (opener) | 68.4% | no | 68.4% | 10944 |
| 18 | reorder #8 → #1 (coin) | 68.3% | no | 68.4% | 11552 |
| 19 | move of #8 (coin): distilled-strike → compact (target randomFoe → orchestrator) | 61.2% | no | 68.4% | 12160 |
| 20 | condition of #3 (tidy): self has quantized → self context ≥ 50% full | 65.1% | no | 68.4% | 12768 |
| 21 | move of #7 (hurt): ship-it → distilled-strike | 68.8% | no | 68.4% | 13376 |
| 22 | move of #5 (weak): distilled-strike → clear (target foeWeakToMove → orchestrator) | 65.5% | no | 68.4% | 13984 |
| 23 | reorder #6 → #4 (guard) | 68.3% | no | 68.4% | 14592 |
| 24 | replace #7 (hurt) with search-24: IF orchestrator is buffed THEN guardrail → lowestHpAlly | 67.9% | no | 68.4% | 15200 |
| 25 | replace #4 (opener) with search-25: IF self has not used the move for 1 round THEN ship-it → highestAtkFoe | 66.9% | no | 68.4% | 15808 |
| 26 | move of #5 (weak): distilled-strike → guardrail (target foeWeakToMove → self) | 65.5% | no | 68.4% | 16416 |
| 27 | reorder #7 → #6 (hurt) | 68.4% | no | 68.4% | 17024 |
| 28 | replace #4 (opener) with search-28: IF orchestrator hp ≥ 50% THEN distilled-strike → orchestratorTarget | 69.4% | no | 68.4% | 17632 |
| 29 | reorder #1 → #3 (finish) | 68.3% | no | 68.4% | 18240 |
| 30 | replace #2 (drift) with search-30: IF foe is buffed THEN ship-it → orchestratorTarget | 67.9% | no | 68.4% | 18848 |
| 31 | condition of #6 (guard): self hp < 25% → foe hp ≥ 75% | 56.6% | no | 68.4% | 19456 |

## Final deck

Read top to bottom: the first card whose condition holds and whose move fits fires.

| priority | id | card |
|---|---|---|
| 1 | finish | IF foe hp < 25% THEN token-burst → lowestHpFoe |
| 2 | drift | IF self has drift THEN compact → self |
| 3 | tidy | IF self has quantized THEN compact → self |
| 4 | opener | IF self round < 2 THEN distilled-strike → highestAtkFoe |
| 5 | weak | IF foe is weak to the move THEN distilled-strike → foeWeakToMove |
| 6 | guard | IF self hp < 25% THEN guardrail → self |
| 7 | hurt | IF foe hp < 50% THEN ship-it → lowestHpFoe |
| 8 | coin | IF self coin flip THEN distilled-strike → randomFoe |
| default | ship | OTHERWISE ship-it → lowestHpFoe |

## Base deck

| priority | id | card |
|---|---|---|
| 1 | finish | IF foe hp < 25% THEN token-burst → lowestHpFoe |
| 2 | drift | IF self has drift THEN compact → self |
| 3 | tidy | IF self context ≥ 75% full THEN compact → self |
| 4 | opener | IF self round < 2 THEN distilled-strike → highestAtkFoe |
| 5 | weak | IF foe is weak to the move THEN distilled-strike → foeWeakToMove |
| 6 | guard | IF self hp < 25% THEN guardrail → self |
| 7 | hurt | IF foe hp < 50% THEN ship-it → lowestHpFoe |
| 8 | coin | IF self coin flip THEN distilled-strike → randomFoe |
| default | ship | OTHERWISE ship-it → lowestHpFoe |

## Held-out check

The overfitting guard: each deck re-scored on fresh seeds (seedFor label search-heldout:speed-rush-blitzr, never seen by the search), the same field and k. The gap is search score minus held-out score.

| deck | search score | held-out score | held-out 95% interval | gap |
|---|---|---|---|---|
| base | 67.1% | 70.4% | [66.6%, 73.9%] | -3.3 pp |
| final | 68.4% | 71.1% | [67.3%, 74.5%] | -2.6 pp |
