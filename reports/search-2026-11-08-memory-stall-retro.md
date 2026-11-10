# search — 2026-11-08

- engine: `@latentia/engine` 0.3.0
- command: `pnpm sim search --archetype memory-stall-retro --budget 20000 --seed c5000000000000000000000000000003 --tag memory-stall-retro`
- archetype: memory-stall-retro
- seed: c5000000000000000000000000000003
- k: 16 seeds per foe per side (19 foes × 2 sides × 16 = 608 battles per evaluation)
- battlesUsed: 19456 of 20000 (unused: 544)
- acceptance margin: 1.0 pp on the search seeds
- evaluations: 32 (the base deck and 31 candidates; 1 accepted)
- stopped: the next evaluation would exceed the budget
- held-out battles: 1,216 (outside the budget: base and final deck, 608 each)
- wall time: 28.3 s (search and held-out check)

## Score history

Every deck is scored on the same seeds against the same field (common random numbers); a draw counts 0.5. A candidate is kept only when it scores at least 1.0 pp higher than the incumbent.
Accepted steps: 20.2% → 24.0%.

| evaluation | mutation | score | kept | best | battles used |
|---|---|---|---|---|---|
| 0 | base deck | 20.2% | yes | 20.2% | 608 |
| 1 | move of #5 (punish): long-term-recall → save-state (target highestAtkFoe → orchestrator) | 19.7% | no | 20.2% | 1216 |
| 2 | condition of #6 (low): self hp < 25% → orchestrator is telegraphing | 20.9% | no | 20.2% | 1824 |
| 3 | condition of #4 (tidy): self context ≥ 75% full → foe hp ≥ 75% | 16.9% | no | 20.2% | 2432 |
| 4 | move of #2 (recall): long-term-recall → guardrail (target highestAtkFoe → orchestrator) | 19.6% | no | 20.2% | 3040 |
| 5 | replace #5 (punish) with search-5: IF foe context < 50% full THEN save-state → self | 18.6% | no | 20.2% | 3648 |
| 6 | move of #4 (tidy): compact → guardrail | 24.0% | yes | 24.0% | 4256 |
| 7 | reorder #7 → #3 (finish) | 23.4% | no | 24.0% | 4864 |
| 8 | reorder #5 → #2 (punish) | 23.2% | no | 24.0% | 5472 |
| 9 | replace #7 (finish) with search-9: IF self hp < 50% THEN long-term-recall → orchestratorTarget | 24.0% | no | 24.0% | 6080 |
| 10 | reorder #2 → #8 (recall) | 23.7% | no | 24.0% | 6688 |
| 11 | condition of #7 (finish): foe hp < 25% → self hp ≥ 75% | 24.0% | no | 24.0% | 7296 |
| 12 | reorder #7 → #8 (finish) | 24.0% | no | 24.0% | 7904 |
| 13 | move of #7 (finish): nostalgia-trip → long-term-recall | 24.0% | no | 24.0% | 8512 |
| 14 | condition of #2 (recall): foe hp < 50% → foe context ≥ 25% full | 22.9% | no | 24.0% | 9120 |
| 15 | condition of #3 (drift): self has drift → foe has overfit | 24.5% | no | 24.0% | 9728 |
| 16 | reorder #5 → #4 (punish) | 23.7% | no | 24.0% | 10336 |
| 17 | move of #7 (finish): nostalgia-trip → save-state (target lowestHpFoe → self) | 24.0% | no | 24.0% | 10944 |
| 18 | reorder #7 → #3 (finish) | 23.4% | no | 24.0% | 11552 |
| 19 | replace #8 (coin) with search-19: IF foe last used token-burst THEN compact → self | 22.9% | no | 24.0% | 12160 |
| 20 | replace #5 (punish) with search-20: IF self has glazed THEN clear → lowestHpAlly | 24.0% | no | 24.0% | 12768 |
| 21 | reorder #1 → #7 (save) | 23.0% | no | 24.0% | 13376 |
| 22 | reorder #4 → #3 (tidy) | 24.0% | no | 24.0% | 13984 |
| 23 | move of #7 (finish): nostalgia-trip → clear (target lowestHpFoe → lowestHpAlly) | 23.4% | no | 24.0% | 14592 |
| 24 | move of #1 (save): save-state → long-term-recall (target self → highestAtkFoe) | 22.5% | no | 24.0% | 15200 |
| 25 | move of #2 (recall): long-term-recall → guardrail (target highestAtkFoe → self) | 21.2% | no | 24.0% | 15808 |
| 26 | move of #3 (drift): compact → save-state | 24.5% | no | 24.0% | 16416 |
| 27 | move of #4 (tidy): guardrail → nostalgia-trip (target self → orchestratorTarget) | 24.3% | no | 24.0% | 17024 |
| 28 | reorder #8 → #4 (coin) | 23.4% | no | 24.0% | 17632 |
| 29 | reorder #4 → #5 (tidy) | 23.7% | no | 24.0% | 18240 |
| 30 | reorder #4 → #8 (tidy) | 23.2% | no | 24.0% | 18848 |
| 31 | reorder #6 → #2 (low) | 24.2% | no | 24.0% | 19456 |

## Final deck

Read top to bottom: the first card whose condition holds and whose move fits fires.

| priority | id | card |
|---|---|---|
| 1 | save | IF self has not used the move for 3 rounds THEN save-state → self |
| 2 | recall | IF foe hp < 50% THEN long-term-recall → highestAtkFoe |
| 3 | drift | IF self has drift THEN compact → self |
| 4 | tidy | IF self context ≥ 75% full THEN guardrail → self |
| 5 | punish | IF foe is buffed THEN long-term-recall → highestAtkFoe |
| 6 | low | IF self hp < 25% THEN guardrail → self |
| 7 | finish | IF foe hp < 25% THEN nostalgia-trip → lowestHpFoe |
| 8 | coin | IF self coin flip THEN long-term-recall → randomFoe |
| default | trip | OTHERWISE nostalgia-trip → lowestHpFoe |

## Base deck

| priority | id | card |
|---|---|---|
| 1 | save | IF self has not used the move for 3 rounds THEN save-state → self |
| 2 | recall | IF foe hp < 50% THEN long-term-recall → highestAtkFoe |
| 3 | drift | IF self has drift THEN compact → self |
| 4 | tidy | IF self context ≥ 75% full THEN compact → self |
| 5 | punish | IF foe is buffed THEN long-term-recall → highestAtkFoe |
| 6 | low | IF self hp < 25% THEN guardrail → self |
| 7 | finish | IF foe hp < 25% THEN nostalgia-trip → lowestHpFoe |
| 8 | coin | IF self coin flip THEN long-term-recall → randomFoe |
| default | trip | OTHERWISE nostalgia-trip → lowestHpFoe |

## Held-out check

The overfitting guard: each deck re-scored on fresh seeds (seedFor label search-heldout:memory-stall-retro, never seen by the search), the same field and k. The gap is search score minus held-out score.

| deck | search score | held-out score | held-out 95% interval | gap |
|---|---|---|---|---|
| base | 20.2% | 21.9% | [18.8%, 25.3%] | -1.6 pp |
| final | 24.0% | 22.4% | [19.2%, 25.8%] | 1.6 pp |
