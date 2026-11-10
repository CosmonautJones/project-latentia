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
- Nothing else moved from pass to fail. Rows that improved: mixed-starter-blitzr inconclusive (54.5%) → pass (49.9%); mixed-starter-sagelet 63.0% → 57.4% (still fail); the worst-matchup points for speed-rush-blitzr vs open-swarm-forkling (14.9% → 18.0%), speed-rush-agentoad vs deprecatter (6.3% → 10.8%) and reasoning-nuke-sagelet vs speed-rush-blitzr (14.5% → 21.2%) rose; the best of them, reasoning-nuke-hallucinat vs speed-rush-blitzr (15.7% against mixed-starter-sagelet before, 27.7% after), is close to the 30% band edge but still fails, and every other worst-matchup point is 21.2% or lower.
- Rows that got worse but were already failing: open-swarm-forkling 57.3% → 69.0%, open-swarm-slopling 59.2% → 61.7%, reasoning-nuke-sagelet 83.9% → 85.1%.

### Reading

Softening the chart did not move the headline problems: the field is still dominated by reasoning-nuke-sagelet and open-swarm-forkling, the triangle is still lopsided, and the worst matchups are still far below 30%. Those are numbers, stats and deck issues for D3 and D4, not type magnitude.

## Step D3: archetype decks re-baselined with the search (engine 0.4.0, sim only)

### Method

- Every archetype ran `pnpm sim search --archetype <id> --budget 20000 --seed <seed> --tag scratch-<id>` under the 0.4.0 chart, one run at a time (k 16, 19 foes × 2 sides × 16 = 608 battles per evaluation, 32 evaluations; the search report's held-out check is 608 battles per deck on `search-heldout:<id>` seeds). The tag `scratch-<id>` (not bare `scratch`) keeps one uncommitted report per archetype, since a bare tag would overwrite the day's report each run.
- Seed for each archetype: the first 32 hex characters of fnv1a64Hex("d3:" + id) written twice (the 16-character hash doubled). The seeds are in the table.
- Adoption rule: the final deck is adopted only if its held-out score beats the base deck's held-out score by at least 1 pp. A gain on the search seeds is not enough.
- Headline rule: every headline card an archetype's Autopilot deck owns (the card of the orchestrator's local id in HEADLINES) must still be in the deck, with its move unchanged (the search may change a card's condition or target; a card whose move changed is a different card), and must still fire over the field (sampled over 19 foes × 2 sides × 4 seeds). When the search deck broke that, `packages/sim/scripts/d3-rebaseline.ts` repeated the search at the same seed (same deck, same held-out scores as the report), put the headline cards back (changed or silent ones in place, dropped ones in place of the non-headline card whose replacement cost the least on the search seeds), and scored the restored deck on the held-out seeds. A restored deck was adopted only if it beat the base by at least 1 pp held-out. Subagent headline cards sit in subagent decks the search never touches; the headline test covers them.
- Data only: eight archetype files changed (Autopilot deck cards); no grid, species or level changed. Two tests changed (see Tests). All scores below are percentages, a draw counting 0.5.

### Per-archetype results

"search score" is the base deck's search-seed score → the search's final deck (and, where the headline cards had to be restored, the restored deck). "held-out final" is the search's final deck (and the restored deck).

| id | seed | search score | held-out base | held-out final | adopted? and why | headline kept? |
|---|---|---|---|---|---|---|
| speed-rush-blitzr | `7c3754b7755e7c167c3754b7755e7c16` | 68.4 → 70.6 | 70.4 | 72.7 | yes: search final, +2.3 pp | yes |
| speed-rush-agentoad | `0b4eb2931477d5320b4eb2931477d532` | 47.9 → 54.6 (restored deck 53.3) | 48.4 | 51.8 (restored 52.8) | yes: restored deck, +4.4 pp | no in the search deck (silent tools); restored, all fire |
| speed-rush-graft | `38961e0bd05029b938961e0bd05029b9` | 43.8 → 52.1 | 46.5 | 53.8 | yes: search final, +7.3 pp | yes |
| reasoning-nuke-sagelet | `a34744dea5a5c944a34744dea5a5c944` | 83.7 → 93.9 (restored deck 84.9) | 85.7 | 94.4 (restored 87.3) | yes: restored deck, +1.6 pp | no in the search deck (silent charge); restored, all fire |
| reasoning-nuke-hallucinat | `2c9798558f2c924e2c9798558f2c924e` | 72.4 → 76 | 76.5 | 77.8 | yes: search final, +1.3 pp | yes |
| open-swarm-forkling | `87747723e373119a87747723e373119a` | 68.4 → 74.2 | 68.9 | 74.2 | yes: search final, +5.3 pp | yes |
| open-swarm-slopling | `6e34ea64fd45ccf66e34ea64fd45ccf6` | 62.5 → 66.1 | 60.5 | 63.2 | yes: search final, +2.7 pp | yes |
| code-lock-spaghettopus | `8c5387dfea3cc7438c5387dfea3cc743` | 44.6 → 64.6 (restored deck 56.7) | 47.2 | 65.1 (restored 59.9) | yes: restored deck, +12.7 pp | no in the search deck (dropped leak, move changed loop); restored, all fire |
| code-lock-nullbeetle | `dde20f6b07564086dde20f6b07564086` | 10.9 → 25 (restored deck 21.5) | 11.3 | 25.8 (restored 19.6) | yes: restored deck, +8.3 pp | no in the search deck (dropped test, move changed loop); restored, all fire |
| code-lock-cobolt | `1872586ddf29c06d1872586ddf29c06d` | 35.2 → 37.8 (restored deck 36.2) | 38.7 | 39 (restored 39.1) | no: restored +0.4 pp < 1 | no in the search deck (move changed patch); restored, all fire |
| voice-pressure-parrot | `a755f10a54703fa7a755f10a54703fa7` | 29.1 → 61.8 (restored deck 57.2) | 25.2 | 61.7 (restored 58.7) | yes: restored deck, +33.5 pp | no in the search deck (dropped hype); restored, all fire |
| voice-pressure-vibrat | `91eeb40836aa930b91eeb40836aa930b` | 43.4 → 47 (restored deck 43.4) | 36.3 | 44.6 (restored 36.3) | no: restored +0 pp < 1 | no in the search deck (move changed hype); restored, all fire |
| memory-stall-deprecatter | `253da53bd5b837c4253da53bd5b837c4` | 52.3 → 52.3 | 47.5 | 47.5 | no: the search accepted no step, final = base | yes |
| memory-stall-retro | `2be03eef4e3b6e532be03eef4e3b6e53` | 22 → 24.7 | 19.9 | 23.7 | yes: search final, +3.8 pp | yes |
| search-anti-hallu-embeddingo | `1351d9e2cfc60beb1351d9e2cfc60beb` | 57.6 → 76 (restored deck 66.3) | 57.9 | 73.5 (restored 66.3) | yes: restored deck, +8.4 pp | no in the search deck (silent sniff); restored, all fire |
| search-anti-hallu-scrapion | `df6a5d03db4e3790df6a5d03db4e3790` | 55.9 → 66.9 (restored deck 57.7) | 59.9 | 66.1 (restored 62.2) | yes: restored deck, +2.3 pp | no in the search deck (dropped check); restored, all fire |
| mixed-starter-sagelet | `1ddcf7fd357db7371ddcf7fd357db737` | 59.5 → 75 (restored deck 61.7) | 56.3 | 71.9 (restored 58.7) | yes: restored deck, +2.4 pp | no in the search deck (move changed think); restored, all fire |
| mixed-starter-blitzr | `f30d4619bec1cccdf30d4619bec1cccd` | 47.9 → 52.3 | 51.2 | 53 | yes: search final, +1.8 pp | yes |
| mixed-starter-forkling | `482a827adb2b5c9e482a827adb2b5c9e` | 64.3 → 72 (restored deck 72.4) | 65.6 | 73.7 (restored 74) | yes: restored deck, +8.4 pp | no in the search deck (dropped patch); restored, all fire |
| mixed-heisenmoth-tempo | `834889a10ab3ab16834889a10ab3ab16` | 25.5 → 47.2 (restored deck 38.3) | 25 | 50.7 (restored 37.7) | yes: restored deck, +12.7 pp | no in the search deck (dropped box); restored, all fire |

Adopted: 17 of 20 (blitzr, agentoad, graft, sagelet, hallucinat, forkling, slopling, spaghettopus, nullbeetle, parrot, retro, embeddingo, scrapion, mixed-sagelet, mixed-blitzr, mixed-forkling, heisenmoth). Kept base: cobolt (restored deck +0.4 pp), vibrat (every search gain came from changing the move of its Hype Train card; restoring it gives back the base deck), deprecatter (the search accepted no step). Of the 17, 7 are the search's own final deck and 10 are restored decks.

### Verdicts before

Before is D2's after: `pnpm sim targets` at full scale, engine 0.4.0, content fingerprint c3169bd34fb68888, git b4587a0.

### Verdicts after

`pnpm sim targets` at full scale, engine 0.4.0, content fingerprint 7644e92697a229a0, git 497c8bd (clean). Report: `reports/targets-2026-11-10.md` (overwrites D2's report of the same date).

| target | band | before (D2) | after (D3) | verdict |
|---|---|---|---|---|
| Any archetype vs the field | ≤ 55% | 11 pass, 0 inconclusive, 9 fail | 13 pass, 0 inconclusive, 7 fail | fail → fail (2 rows fixed) |
| Worst single matchup | ≥ 30% | 0 pass, 20 fail (worst 0.0%) | 0 pass, 20 fail (worst 0.0%, forkling vs sagelet unchanged) | fail → fail |
| Starter triangle | 55–65% | 99.3 / 91.3 / 100.0 | 99.3 / 91.3 / 100.0 (role decks, not archetype decks) | fail → fail |
| Temperature dial | within 5 points of 50% | 56.9% [54.7, 59.1] | 58.7% [56.5, 60.8] | fail → fail (further out) |
| Graft worth taking | ≥ 55% | parrot 71.5 pass, nullbeetle 81.7 pass, wasp 23.3 fail | identical (base-team setups) | fail → fail |
| Fight length | median 5–8 | median 7 | median 7 | pass → pass |
| First mover | 48–52% | 50.9% [49.9, 51.9] | 51.1% [50.1, 52.0] | pass → inconclusive |

Per archetype (before, D2 report; after, this run). Vs-field is the pooled score over the 19 foes; worst matchup is that archetype's worst pairing, both orderings pooled, 2,000 battles.

| archetype | vs field before | verdict | vs field after | verdict | worst matchup before | worst matchup after |
|---|---|---|---|---|---|---|
| speed-rush-blitzr | 67.8% | fail | 65.5% | fail | open-swarm-forkling 18.0% | open-swarm-forkling 13.7% |
| speed-rush-agentoad | 48.6% | pass | 46.5% | pass | memory-stall-deprecatter 10.8% | memory-stall-deprecatter 13.4% |
| speed-rush-graft | 46.1% | pass | 48.3% | pass | open-swarm-forkling 0.4% | open-swarm-forkling 0.2% |
| reasoning-nuke-sagelet | 85.1% | fail | 81.6% | fail | speed-rush-blitzr 21.2% | speed-rush-blitzr 21.3% |
| reasoning-nuke-hallucinat | 74.4% | fail | 69.1% | fail | speed-rush-blitzr 27.7% | speed-rush-blitzr 27.3% |
| open-swarm-forkling | 69.0% | fail | 69.8% | fail | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| open-swarm-slopling | 61.7% | fail | 56.4% | fail | reasoning-nuke-sagelet 1.5% | reasoning-nuke-sagelet 0.9% |
| code-lock-spaghettopus | 48.4% | pass | 53.4% | pass | reasoning-nuke-sagelet 0.0% | search-anti-hallu-embeddingo 0.2% |
| code-lock-nullbeetle | 10.9% | pass | 15.3% | pass | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| code-lock-cobolt | 37.5% | pass | 29.8% | pass | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| voice-pressure-parrot | 26.1% | pass | 52.2% | pass | search-anti-hallu-embeddingo 5.3% | open-swarm-forkling 19.1% |
| voice-pressure-vibrat | 39.9% | pass | 35.3% | pass | reasoning-nuke-sagelet 8.4% | reasoning-nuke-sagelet 5.9% |
| memory-stall-deprecatter | 49.0% | pass | 41.9% | pass | search-anti-hallu-scrapion 0.1% | search-anti-hallu-embeddingo 0.1% |
| memory-stall-retro | 20.9% | pass | 18.8% | pass | search-anti-hallu-embeddingo 0.3% | search-anti-hallu-embeddingo 0.3% |
| search-anti-hallu-embeddingo | 57.2% | fail | 59.7% | fail | reasoning-nuke-sagelet 1.3% | reasoning-nuke-sagelet 5.3% |
| search-anti-hallu-scrapion | 57.5% | fail | 52.1% | pass | reasoning-nuke-sagelet 9.2% | reasoning-nuke-sagelet 8.6% |
| mixed-starter-sagelet | 57.4% | fail | 54.4% | pass | speed-rush-graft 11.9% | speed-rush-graft 10.4% |
| mixed-starter-blitzr | 49.9% | pass | 47.4% | pass | mixed-starter-forkling 14.8% | mixed-starter-forkling 9.5% |
| mixed-starter-forkling | 66.4% | fail | 68.9% | fail | reasoning-nuke-sagelet 9.3% | reasoning-nuke-sagelet 10.1% |
| mixed-heisenmoth-tempo | 26.2% | pass | 33.4% | pass | code-lock-spaghettopus 0.0% | reasoning-nuke-sagelet 0.4% |

### Moved out of band

- First mover: pass → inconclusive (51.1%, the interval [50.1, 52.0] now touches the 52% edge; the point moved 0.2 pp). The mirrors' decks changed; the point stays inside the band.
- Temperature dial: still fail, further out (56.9% → 58.7%). The per-archetype sweep shows the T0 side ahead of the T4 mirror almost everywhere: embeddingo 77.4%, forkling 70.6%, blitzr 66.4%, forkling-mixed 64.8%, sagelet 64.0%. Only parrot (45.8%) and deprecatter (48.4%) read below 50%.
- No other row went from pass to fail.
- Fixed: Any archetype vs the field for search-anti-hallu-scrapion (57.5% → 52.1%) and mixed-starter-sagelet (57.4% → 54.4%, interval [53.9, 55.0]) now pass.
- Still failing (Any archetype vs the field, ≤ 55%): blitzr 65.5%, sagelet 81.6%, hallucinat 69.1%, forkling 69.8%, slopling 56.4%, embeddingo 59.7%, mixed-forkling 68.9%.
- Worst-matchup points: voice-pressure-parrot's worst rose from 5.3% to 19.1% and embeddingo's from 1.3% to 5.3%; blitzr's fell from 18.0% to 13.7% and mixed-blitzr's from 14.8% to 9.5%. Every row still fails the 30% band; the structural zeros (forkling, nullbeetle, cobolt vs sagelet) are untouched.

### Reading

- The search is a zero-sum improver against a fixed field: each adopted deck was tuned against the other 19 base decks, so the field's scores moved by compensation. The two weakest decks gained most (parrot 25.2% → 58.7% held-out, 26.1% → 52.2% in the round-robin; heisenmoth 26.2% → 33.4%; nullbeetle 10.9% → 15.3%), which pulled the middle up and left the same dominant trio: sagelet (81.6%), forkling (69.8%) and hallucinat (69.1%) are still far over 55%, and mixed-forkling (68.9%) and blitzr (65.5%) too. Adopting sagelet's restored deck (+1.6 pp held-out) was the rule's outcome, not a fix; it fell from 85.1% to 81.6% in the full round-robin because the field around it got stronger.
- The held-out sample is 608 battles, so one deck's gain carries about ±2 pp of noise. The small gains (sagelet +1.6, hallucinat +1.3, mixed-blitzr +1.8) are near the noise floor. Held-out gains are against the old field; once 17 decks change together, several adopted decks score lower in the new round-robin (blitzr 67.8% → 65.5%, hallucinat 74.4% → 69.1%, agentoad 48.6% → 46.5%, retro 20.9% → 18.8%) because their foes improved as well. The full-scale targets run is the check that counts.
- The remaining gaps are not deck problems: the sagelet and forkling dominance, the structural 0.0% matchups, the triangle and the wasp graft are for D4's number and content work.

### Timing

| measurement | D2 | D3 |
|---|---|---|
| Round-robin inside targets (380,000 battles) | 479.0 s | 450.4 s |
| `pnpm sim targets` wall time | 519.5 s | 489.0 s |

### Tests

- `test/target-setups.test.ts`, "is live: the engine runs the sides at T0 and T4": a T0 substitution count of 2 appeared for mixed-starter-sagelet, from Drift (5% random move per stack, spec §5 D1), because the new deck no longer compacts at 75% context. The check now counts a substitution only while the orchestrator holds no Drift (a DriftChanged event tracks it). The T4 side still hallucinates.
- `test/search.test.ts`, "keeps exactly 8 cards plus the base Default…": the regression guard needs a search that accepts a step on the tiny two-foe field; blitzr's deck, already tuned against the full field, accepts none. It now climbs from code-lock-cobolt, whose deck is still as authored.
