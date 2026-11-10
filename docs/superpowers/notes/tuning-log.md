# First tuning pass: log

Each step records the change, the full before and after verdict tables, and anything that moved out of band. Targets are judged as in spec §9: pass needs the point and the whole 95% Wilson interval inside the band, fail is a point outside it, inconclusive is a point inside with the interval crossing an edge.

## Step D2: type chart softened (Ruling 148, engine 0.3.0 → 0.4.0)

### Change

- `content/types.ts`: strong multiplier 20000 → 15000, weak multiplier 5000 → 6667, neutral 10000. Every type still has exactly two strong and two weak matchups.
- Dual-type bounds: `mulBp` floors, so two resistances give floor(6667 × 6667 / 10000) = 4444 and two weaknesses give 15000 × 15000 = 22500 (a weakness and a resistance give 10000). `TYPE_MULT_MIN_BP` / `TYPE_MULT_MAX_BP` are now 4444 / 22500 (were 2500 / 30000), and `computeDamage` clamps with the same constants. The test pins every dual-type product on the chart and both bounds.
- Goldens re-recorded (34 of 37 expectedHash values changed; the hash does not include the engine version, so 3 keep their hash and only their `engineVersion` field changed). With the old multipliers and bounds put back, every golden except `forkling-community-patch` reproduces its old hash, so the chart is the only cause. In `forkling-community-patch` the Leaderboard Flex step moved from round 4 to round 2: the softer chart changes the damage, the orchestrator was under a status that forbids Flex by round 4, and Ruling 110 needs every move used in some golden.
- The broken-deck fixture (criterion 5) fell to 0 / 103 broken / swapped wins under the softer chart. Its levels were re-tuned for that scenario only (Sagelet 4 → 5, Forkling 6 → 9, Bootcamp Grad Off-By-Wasp 6 → 8 and Nullbeetle 6 → 7): 13 / 188 on the test's 200 seeds, 33 / 369 on a 400-seed check list. The other scenarios keep Bootcamp Grad at Lv6 / Lv6.
- Spot checks: `handoff-chain-high-damage` round 1, a 5000 → 6667 resisted hit, 30 → 39 damage (expected about ×1.333); `sagelet-reasoning` round 1, a resisted hit 11 → 15 and round 2 a super-effective TypeEffect 20000 → 15000.

### Verdicts before

Before is the baseline `reports/targets-2026-11-10.md` (engine 0.3.0, full scale, run before the D1 setups) for the rows D1 did not change, and the D1 scaled run (`pnpm sim targets --seeds-scale 0.1 --tag scratch`, engine 0.3.0, content fingerprint c3169bd34fb68888) for the rows D1 did change (starter triangle, graft). The scaled run has a tenth of the seeds, so its intervals are wide.

| target | band | baseline (full) | D1 scaled run (0.1) |
|---|---|---|---|
| Any archetype vs the field | ≤ 55% | fail: 10 pass, 2 inconclusive, 8 fail | fail: 10 pass, 1 inconclusive, 9 fail |
| Worst single matchup | ≥ 30% | fail: 20 of 20 fail (worst 0.0%) | fail: 20 of 20 fail |
| Starter triangle | 55–65% | fail: 99.9 / 0.1 / 100.0 (Tokenibble-partner rows, now removed) | fail: 100.0 / 100.0 / 100.0 (partnerless, Ruling 146) |
| Temperature dial | within 5 points of 50% | inconclusive: 54.8% [52.6, 56.9] | inconclusive: 54.5% [47.6, 61.3] |
| Graft | see rows | Graft vs spin-up 45–55%: fail, 2.1 / 2.1 / 1.1 (old target, replaced by Ruling 147) | Graft worth taking ≥ 55%: fail, 73.0 / 71.0 / 28.5 (off-by-wasp fails) |
| Fight length | median 5–8 | pass: median 7 | pass: median 7 |
| First mover | 48–52% | pass: 50.6% | inconclusive: 48.6% [45.5, 51.7] (scale 0.1) |

Full-scale triangle-solo before (D1 setups, engine 0.3.0 chart, run by putting the old multipliers back for one run): blitzr over sagelet 100.0%, sagelet over forkling 100.0%, forkling over blitzr 100.0%; median rounds 3, 5, 2.

### Verdicts after

`pnpm sim targets` at full scale, engine 0.4.0, content fingerprint c3169bd34fb68888, git b4587a0 (clean). Report: `reports/targets-2026-11-10.md`.

| target | band | after (full) | verdict |
|---|---|---|---|
| Any archetype vs the field | ≤ 55% | 11 pass, 0 inconclusive, 9 fail | fail |
| Worst single matchup | ≥ 30% | 0 pass, 20 fail (overall worst: open-swarm-forkling vs reasoning-nuke-sagelet 0.0%) | fail |
| Starter triangle | 55–65% | blitzr over sagelet 99.3% [98.8, 99.6], sagelet over forkling 91.3% [89.9, 92.4], forkling over blitzr 100.0% [99.8, 100.0] | fail |
| Temperature dial | within 5 points of 50% | 56.9% [54.7, 59.1] | fail |
| Graft worth taking | ≥ 55% | stochastiparrot 71.5% pass, nullbeetle 81.7% pass, off-by-wasp 23.3% fail | fail |
| Fight length | median 5–8 | median 7 | pass |
| First mover | 48–52% | 50.9% [49.9, 51.9] | pass |

Triangle-solo after (`pnpm --filter @latentia/sim triangle-solo`, 2000 per matchup): 99.3% / 91.3% / 100.0%, median rounds 3, 5, 2. Every matchup still fails the 55–65% band by a wide margin: the softer chart moved sagelet over forkling from 100% to 91%, and nothing else.

### Fight length and timing

| measurement | before (0.3.0) | after (0.4.0) |
|---|---|---|
| Median fight length (round-robin, 380,000 battles) | 7 rounds (p25 6, p75 9, min 2, max 50) | 7 rounds (p25 6, p75 9, min 3, max 50) |
| Round-cap hits | 135 | 129 |
| `pnpm sim round-robin --seeds 1000` wall time | 420.0 s (report) | 461.2 s (report), 7 min 42 s by `time` |
| `pnpm sim targets` full run, wall time | 434.7 s | 519.5 s (8 min 40 s by `time`) |
| Bench (gate 1.2 ms) | not re-run | deck-driven 0.883 ms, player-commanded 0.552 ms |

The median fight length is unchanged at 7. Fights are not longer in the median; the round-robin is about 10% slower, 461 s against the 600 s limit of criterion 7, so the margin shrank from 180 s to 139 s but holds.

### Moved out of band

- Temperature dial: inconclusive → fail (T0 side scores 56.9% against its T4 mirror; the interval [54.7, 59.1] no longer reaches 55%). Before it was 54.8% and 54.5% in the two baselines. A softer chart favours the cold side a little more.
- Any archetype vs the field, search-anti-hallu-scrapion: inconclusive (54.9%) → fail (57.5% [57.0, 58.0]).
- Nothing else moved from pass to fail. Rows that improved: mixed-starter-blitzr inconclusive (54.5%) → pass (49.9%); mixed-starter-sagelet 63.0% → 57.4% (still fail); the worst-matchup points for speed-rush-blitzr vs open-swarm-forkling (14.9% → 18.0%), speed-rush-agentoad vs deprecatter (6.3% → 10.8%) and reasoning-nuke-sagelet vs speed-rush-blitzr (14.5% → 21.2%) rose, none near 30%.
- Rows that got worse but were already failing: open-swarm-forkling 57.3% → 69.0%, open-swarm-slopling 59.2% → 61.7%, reasoning-nuke-sagelet 83.9% → 85.1%.

### Reading

Softening the chart did not move the headline problems: the field is still dominated by reasoning-nuke-sagelet and open-swarm-forkling, the triangle is still lopsided, and the worst matchups are still far below 30%. Those are numbers, stats and deck issues for D3 and D4, not type magnitude.
