# search — 2026-11-08

- engine: `@latentia/engine` 0.3.0
- command: `pnpm sim search --archetype code-lock-nullbeetle --budget 20000 --seed c5000000000000000000000000000002 --tag code-lock-nullbeetle`
- archetype: code-lock-nullbeetle
- seed: c5000000000000000000000000000002
- k: 16 seeds per foe per side (19 foes × 2 sides × 16 = 608 battles per evaluation)
- battlesUsed: 19456 of 20000 (unused: 544)
- acceptance margin: 1.0 pp on the search seeds
- evaluations: 32 (the base deck and 31 candidates; 4 accepted)
- stopped: the next evaluation would exceed the budget
- held-out battles: 1,216 (outside the budget: base and final deck, 608 each)
- wall time: 26.1 s (search and held-out check)

## Score history

Every deck is scored on the same seeds against the same field (common random numbers); a draw counts 0.5. A candidate is kept only when it scores at least 1.0 pp higher than the incumbent.
Accepted steps: 10.0% → 21.5% → 22.9% → 24.2% → 28.1%.

| evaluation | mutation | score | kept | best | battles used |
|---|---|---|---|---|---|
| 0 | base deck | 10.0% | yes | 10.0% | 608 |
| 1 | reorder #7 → #3 (guard) | 10.2% | no | 10.0% | 1216 |
| 2 | replace #1 (test) with search-2: IF foe is reasoning type THEN null-chomp → lowestHpFoe | 21.5% | yes | 21.5% | 1824 |
| 3 | reorder #1 → #8 (search-2) | 22.9% | yes | 22.9% | 2432 |
| 4 | condition of #7 (finish): foe hp < 25% → foe context ≥ 50% full | 22.9% | no | 22.9% | 3040 |
| 5 | move of #6 (guard): guardrail → segfault (target self → lowestHpFoe) | 23.0% | no | 22.9% | 3648 |
| 6 | move of #3 (tidy): compact → segfault (target self → highestAtkFoe) | 24.2% | yes | 24.2% | 4256 |
| 7 | reorder #5 → #4 (speed) | 24.2% | no | 24.2% | 4864 |
| 8 | replace #1 (loop) with search-8: IF self is buffed THEN unit-test → self | 28.1% | yes | 28.1% | 5472 |
| 9 | reorder #4 → #8 (drift) | 28.6% | no | 28.1% | 6080 |
| 10 | move of #8 (search-2): null-chomp → unit-test (target lowestHpFoe → self) | 27.8% | no | 28.1% | 6688 |
| 11 | reorder #2 → #5 (crash) | 28.1% | no | 28.1% | 7296 |
| 12 | reorder #6 → #5 (guard) | 28.1% | no | 28.1% | 7904 |
| 13 | replace #1 (search-8) with search-13: IF foe last used flattery THEN compact → lowestHpAlly | 28.5% | no | 28.1% | 8512 |
| 14 | reorder #3 → #2 (tidy) | 28.1% | no | 28.1% | 9120 |
| 15 | move of #6 (guard): guardrail → clear | 28.3% | no | 28.1% | 9728 |
| 16 | reorder #4 → #1 (drift) | 28.1% | no | 28.1% | 10336 |
| 17 | condition of #3 (tidy): self context ≥ 75% full → self coin flip | 28.9% | no | 28.1% | 10944 |
| 18 | move of #5 (speed): infinite-loop → segfault | 28.1% | no | 28.1% | 11552 |
| 19 | condition of #3 (tidy): self context ≥ 75% full → foe is voice type | 28.1% | no | 28.1% | 12160 |
| 20 | condition of #8 (search-2): foe is reasoning type → orchestrator is buffed | 28.0% | no | 28.1% | 12768 |
| 21 | condition of #3 (tidy): self context ≥ 75% full → foe has deprecated | 28.1% | no | 28.1% | 13376 |
| 22 | reorder #2 → #3 (crash) | 28.1% | no | 28.1% | 13984 |
| 23 | condition of #7 (finish): foe hp < 25% → self coin flip | 28.1% | no | 28.1% | 14592 |
| 24 | condition of #5 (speed): foe last used low-latency → foe is telegraphing | 28.1% | no | 28.1% | 15200 |
| 25 | condition of #5 (speed): foe last used low-latency → self has hallucinating | 28.1% | no | 28.1% | 15808 |
| 26 | condition of #5 (speed): foe last used low-latency → orchestrator last used citation-needed | 28.1% | no | 28.1% | 16416 |
| 27 | move of #6 (guard): guardrail → unit-test | 28.3% | no | 28.1% | 17024 |
| 28 | reorder #1 → #8 (search-8) | 28.1% | no | 28.1% | 17632 |
| 29 | reorder #1 → #6 (search-8) | 28.1% | no | 28.1% | 18240 |
| 30 | replace #2 (crash) with search-30: IF self has an ally at hp < 50% THEN unit-test → orchestrator | 20.9% | no | 28.1% | 18848 |
| 31 | reorder #7 → #2 (finish) | 27.8% | no | 28.1% | 19456 |

## Final deck

Read top to bottom: the first card whose condition holds and whose move fits fires.

| priority | id | card |
|---|---|---|
| 1 | search-8 | IF self is buffed THEN unit-test → self |
| 2 | crash | IF foe hp ≥ 75% THEN segfault → highestAtkFoe |
| 3 | tidy | IF self context ≥ 75% full THEN segfault → highestAtkFoe |
| 4 | drift | IF self has drift THEN compact → self |
| 5 | speed | IF foe last used low-latency THEN infinite-loop → highestAtkFoe |
| 6 | guard | IF self hp < 25% THEN guardrail → self |
| 7 | finish | IF foe hp < 25% THEN null-chomp → lowestHpFoe |
| 8 | search-2 | IF foe is reasoning type THEN null-chomp → lowestHpFoe |
| default | chomp | OTHERWISE null-chomp → lowestHpFoe |

## Base deck

| priority | id | card |
|---|---|---|
| 1 | test | IF self has not used the move for 3 rounds THEN unit-test → self |
| 2 | loop | IF foe is buffed THEN infinite-loop → highestAtkFoe |
| 3 | crash | IF foe hp ≥ 75% THEN segfault → highestAtkFoe |
| 4 | tidy | IF self context ≥ 75% full THEN compact → self |
| 5 | drift | IF self has drift THEN compact → self |
| 6 | speed | IF foe last used low-latency THEN infinite-loop → highestAtkFoe |
| 7 | guard | IF self hp < 25% THEN guardrail → self |
| 8 | finish | IF foe hp < 25% THEN null-chomp → lowestHpFoe |
| default | chomp | OTHERWISE null-chomp → lowestHpFoe |

## Held-out check

The overfitting guard: each deck re-scored on fresh seeds (seedFor label search-heldout:code-lock-nullbeetle, never seen by the search), the same field and k. The gap is search score minus held-out score.

| deck | search score | held-out score | held-out 95% interval | gap |
|---|---|---|---|---|
| base | 10.0% | 10.0% | [7.9%, 12.7%] | 0.0 pp |
| final | 28.1% | 30.9% | [27.4%, 34.7%] | -2.8 pp |
