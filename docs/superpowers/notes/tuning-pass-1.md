# Tuning pass 1: summary for Travis

Engine 0.3.0 to 0.4.1, branch `phase-d-tuning`. The full record is in `tuning-log.md`; the rulings are in `phase-d-rulings.md` (146–154). Verdicts follow spec §9: a target passes when the point and its whole 95% interval are inside the band.

## Before and after

Before is the first balance pass as left by the Checkpoint C fix wave (engine 0.3.0, `reports/targets-2026-11-10.md` as it stood then, full scale). After is the final report at engine 0.4.1 (same path, rewritten by D4; fingerprint a7b116a0136a651b).

| target | band | before (0.3.0) | after (0.4.1) | verdict |
|---|---|---|---|---|
| Any archetype vs the field | ≤ 55% | 10 pass, 2 inconclusive, 8 fail | 14 pass, 6 fail | still fail, better |
| Worst single matchup | ≥ 30% | 20 of 20 fail (worst 0.0%) | 20 of 20 fail | fail, unchanged |
| Starter triangle | 55–65% | fail: 99.9 / 0.1 / 100.0 (old Tokenibble-partner rows; the new partnerless row read 100 / 100 / 100 in D1) | fail: 99.3 / 91.2 / 100.0 | fail, unchanged in substance |
| Temperature dial | within 5 points of 50% | inconclusive: 54.8% | fail: 55.7% | worse by 0.9 pp (the D2 chart and D3 decks moved it; K1 and K2 pulled it back from 57.8%) |
| Graft | see rows | old graft-vs-spin-up row failed (2.1 / 2.1 / 1.1%) | graft worth taking: 71.5 / 81.7 / 23.3% (wasp fails) | fail, but the target changed (Ruling 147) |
| Fight length | median 5–8 | 7 | 7 | pass |
| First mover | 48–52% | pass, 50.6% | pass, 50.8% | pass |

Vs-field summed excess over 55% went from 87.9 pp (post-D3) to 74.7 pp. The six remaining failures are reasoning-nuke-sagelet 80.4%, reasoning-nuke-hallucinat 71.6%, speed-rush-blitzr 67.6%, search-anti-hallu-embeddingo 62.0%, mixed-starter-forkling 62.1% and open-swarm-forkling 61.0%.

Blowouts (1,000-seed round-robin, 190 unordered pairings): 14 at or beyond 99/1, 30 at or beyond 95/5, 48 at or beyond 90/10, 79 at or beyond 80/20; 43 pairings are within 40–60. Median fight length 7 (p25 6, p75 9). The round-robin agrees with the `targets:` seeds within about 1 pp per archetype, so it serves as the held-out replicate.

**Criterion 7 (round-robin under 10 min):** the 1,000-seed round-robin ran in 422.1 s at 0.4.1.

## What changed and why

| change | reason |
|---|---|
| Ruling 146: the official starter-triangle row is partnerless (orchestrator only, role-based decks) | A partner made the row measure the partner, not the starter edges. |
| Ruling 147: spin-up accepted as stronger; the official graft row becomes "graft worth taking" (base + graft vs base, ≥ 55%); G-vs-S rows stay diagnostic | Your decision of 2026-11-10: spin-up may be stronger, so the question is whether a graft is worth taking at all. |
| Ruling 148 (D2): type chart strong 20000 → 15000, weak 5000 → 6667; dual-type bounds 2500–30000 → 4444–22500; engine 0.4.0 | Your decision of 2026-11-10 (1.5× and ⅔). 34 of 37 goldens re-recorded, all traced to the chart; the criterion-5 fixture was re-tuned. |
| D3 deck re-baseline: 16 of 20 archetype decks adopted (6 the search's own final deck, 10 restored decks) | Content is balanced against the best deck a player can find. Adoption needs +1 pp on two independent held-out labels (Ruling 150); headline cards keep their move and condition category and at least half their pre-D3 fire rate (Ruling 149). The four kept as base are cobolt, vibrat, deprecatter and mixed-starter-forkling. |
| K1: T4 accuracy −15 → −10 | Makes the accuracy column linear; the dial's cold edge came from T4's −15. Dial 57.8 → 56.0%. |
| K2: Cosine Sniff 70 → 55 | It aims at the foe it hurts most, so against a Code-heavy field it was almost always super effective and the top single damage source. |
| K3: Swarm of Fine-Tunes 20 → 15 per hit | Forkling's own move, so one starter's move did change. The three-Open swarm was 3 × 20 at cost 2; it is now 45. The triangle role deck never plays it, so the solo rows did not move. |
| K4: Deprecatter Robustness 45 → 60 | The only Memory species was the weakest in the slice. Effect on the targets was small (excess −2.0 pp, dial 0.2 pp further out); the clear wins are the Memory teams (deprecatter 43.6 → 47.0, retro 19.7 → 22.3) and first mover. |

17 of 37 golden hashes changed at the 0.4.1 bump, content values only (all reproduce with the old values restored). Unscreened candidates (Drift penalty, Nostalgia Trip, Distilled Strike cost) are listed in the log.

## Still open

| item | state | decision owner |
|---|---|---|
| Starter triangle (99.3 / 91.2 / 100.0) | Each starter's attacks are all its own type, so single starter numbers only shuffle the cycle. Needs coverage moves (a non-own-type attack per starter) or a chart decision. | Travis |
| Off-By-Wasp graft (23.3%) | The graft card aims at `lowestHpFoe` and the off-by-one redirect hits the healthier foe. Aiming it at `highestAtkFoe` reaches about 55.8%, borderline and inconclusive; the redirected hit lands on Sagelet, where Code into Reasoning is resisted. Fix the aim in the target template. | Target template (controller), then re-check |
| Temperature dial (55.7%) | Deferred. A two-step path (Agentoad HP 65 → 55, then T4 self-hallucination 12% → 9%) probed at about 54.6% (inconclusive) with agentoad at 53.8%, not confirmed. | Next tuning pass |
| Remaining 99/1 pairings (14 in the round-robin) | Reasoning and Search teams against mono-Code and Memory teams. No species or move number screened in D4 flips them; it needs coverage or less Code-heavy archetypes. | Travis, with the coverage decision |
| Vs field (6 rows) and worst matchup (20 of 20) | A nerf to one dominant team lifts the others and tips a mid team over 55%. | Follows the coverage decision |
