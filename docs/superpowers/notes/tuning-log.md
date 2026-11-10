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

This section was rewritten in fix round 1 (Rulings 149–151). The first pass adopted 17 decks on one held-out label and let searched decks change or drop headline cards; its targets report (commit 53d7ccc) is superseded.

### Method

- Every archetype ran `pnpm sim search --archetype <id> --budget 20000 --seed <seed> --tag scratch-<id>` under the 0.4.0 chart, one run at a time (k 16, 19 foes × 2 sides × 16 = 608 battles per evaluation, 32 evaluations). The tag `scratch-<id>` (not bare `scratch`) keeps one uncommitted report per archetype. Seed: the first 32 hex characters of fnv1a64Hex("d3:" + id) written twice (the 16-character hash doubled).
- **Adoption (Ruling 150).** A deck is adopted only if it beats the base deck by at least 1 pp on the search's held-out label (`search-heldout:<id>`) AND on a second, independent label (`search-heldout2:<id>`, same field and k, 608 battles per deck). A gain on the search seeds alone is not enough. Over-band archetypes may still adopt better decks: content has to be balanced against the strongest deck a player can find, and D4 handles the over-band gap.
- **Headline integrity (Ruling 149).**
  - A headline card an Autopilot deck owns keeps its move and its condition category (the parameters may change), and fires in at least 50% of the battles it fired in before D3. A card that broke this is put back as the base deck had it (a dropped one replaces the non-headline card whose replacement cost the least), and tried at every priority position if its rate stays under its floor. The parrot's Glaze card is held to the same rule as the headlines.
  - A headline outside the Autopilot deck (a subagent's) that falls under its floor makes the deck unusable.
  - Each rate is the share of battles in which the card fired at least once, over the field: 19 foes × 2 sides × 6 seeds = 228 battles (`src/headline-rates.ts`, seeds `headline:<foe id>`). The pre-D3 rates were measured at 77335b6 and are recorded in `headlines.ts` as `preD3Rate`; the headline test asserts at least half of each on the committed decks.
- `packages/sim/scripts/d3-rebaseline.ts` does the restoring and the two held-out scores; it reproduces only from the pre-D3 archetype data (77335b6), because the search field is the other archetypes' base decks.
- Searched cards in adopted decks have names from their move and condition (`hot-take-buffed`, not `search-14`; fix round 2 also renamed the stale `tidy`, `drift` and `coin` ids that no longer matched their cards, e.g. `compact-status-quantized`, `token-nibble-status-glazed`). No id is a headline or floor key.
- Headlines also record their subject and condition category in `headlines.ts`, and the archetype test asserts them on the committed decks (a Reasoner back on "self, cooldown" fails it). Data only: eight archetype files changed (Autopilot deck cards); no grid, species or level.

### Per-archetype results

Scores are percentages, a draw counting 0.5. Held-out columns read "label 1 / label 2". "committed" is the restored deck where the search's own final deck was not usable.

| id | seed | search score | held-out base | held-out final | adopted? and why | headline kept? |
|---|---|---|---|---|---|---|
| speed-rush-blitzr | `7c3754b7755e7c167c3754b7755e7c16` | 68.4 → 70.6 | 70.4 / 68.8 | 72.7 / 70.1 | yes: search final, +2.3 / +1.3 pp | yes |
| speed-rush-agentoad | `0b4eb2931477d5320b4eb2931477d532` | 47.9 → 54.6 (committed 53.3) | 48.4 / 47.5 | 51.8 / 52.3 (committed 52.8 / 50.3) | yes: restored deck, +4.4 / +2.8 pp | search deck broke it (agentoad#tools fires in 0% of battles, floor 48.2%; tools changed to tool-call / foeBuffed); restored, floors met |
| speed-rush-graft | `38961e0bd05029b938961e0bd05029b9` | 43.8 → 52.1 | 46.5 / 48.5 | 53.8 / 54.1 | yes: search final, +7.3 / +5.6 pp | yes |
| reasoning-nuke-sagelet | `a34744dea5a5c944a34744dea5a5c944` | 83.7 → 93.9 (committed 84.9) | 85.7 / 84.7 | 94.4 / 93.4 (committed 87.3 / 86.2) | yes: restored deck, +1.6 / +1.5 pp | search deck broke it (sagelet#charge fires in 0% of battles, floor 50%; charge changed to step-back-prompt / foeBuffed); restored, floors met |
| reasoning-nuke-hallucinat | `2c9798558f2c924e2c9798558f2c924e` | 72.4 → 76 | 76.5 / 74.2 | 77.8 / 76.6 | yes: search final, +1.3 / +2.4 pp | yes |
| open-swarm-forkling | `87747723e373119a87747723e373119a` | 68.4 → 74.2 (committed 74.2) | 68.9 / 67.8 | 74.2 / 77.5 (committed 71.4 / 75.8) | yes: restored deck, +2.5 / +8 pp | search deck broke it (forkling#coin fires in 3.5% of battles, floor 5.7%); restored, floors met |
| open-swarm-slopling | `6e34ea64fd45ccf66e34ea64fd45ccf6` | 62.5 → 66.1 | 60.5 / 63.5 | 63.2 / 67.6 | yes: search final, +2.7 / +4.1 pp | yes |
| code-lock-spaghettopus | `8c5387dfea3cc7438c5387dfea3cc743` | 44.6 → 64.6 (committed 55.8) | 47.2 / 49.5 | 65.1 / 65.1 (committed 57.2 / 59.2) | yes: restored deck, +10 / +9.7 pp | search deck broke it (spaghettopus#loop fires in 8.8% of battles, floor 20.6%; spaghettopus#leak fires in 0% of battles, floor 50%; loop changed to tangle / foeBuffed; leak dropped); restored, floors met |
| code-lock-nullbeetle | `dde20f6b07564086dde20f6b07564086` | 10.9 → 25 (committed 20.1) | 11.3 / 9.9 | 25.8 / 23.2 (committed 22.5 / 20.6) | yes: restored deck, +11.2 / +10.7 pp | search deck broke it (nullbeetle#test fires in 0% of battles, floor 50%; test dropped; loop changed to segfault / foeBuffed); restored, floors met |
| code-lock-cobolt | `1872586ddf29c06d1872586ddf29c06d` | 35.2 → 37.8 (committed 36.2) | 38.7 / 36.2 | 39 / 37.7 (committed 39.1 / 36.5) | no: committed candidate +0.4 / +0.3 pp, below 1 pp | search deck broke it (cobolt#patch fires in 4.4% of battles, floor 11.4%; patch changed to batch-job / allyHp); restored, floors met |
| voice-pressure-parrot | `a755f10a54703fa7a755f10a54703fa7` | 29.1 → 61.8 (committed 40.8) | 25.2 / 25.8 | 61.7 / 63.2 (committed 42.1 / 40.8) | yes: restored deck, +16.9 / +15 pp | search deck broke it (parrot#hype fires in 0% of battles, floor 50%; parrot#flatter fires in 2.6% of battles, floor 45.6%; hype dropped; flatter changed to flattery / turn); restored, floors met |
| voice-pressure-vibrat | `91eeb40836aa930b91eeb40836aa930b` | 43.4 → 47 (committed 43.4) | 36.3 / 37.2 | 44.6 / 43.6 (committed 36.3 / 37.2) | no: restoring the changed Hype Train card gives back the base deck (+0.0 / +0.0) | search deck broke it (hype changed to guardrail / cooldown); restored, floors met |
| memory-stall-deprecatter | `253da53bd5b837c4253da53bd5b837c4` | 52.3 → 52.3 | 47.5 / 49 | 47.5 / 49 | no: the search accepted no step | yes |
| memory-stall-retro | `2be03eef4e3b6e532be03eef4e3b6e53` | 22 → 24.7 | 19.9 / 23.2 | 23.7 / 24.3 | yes: search final, +3.8 / +1.1 pp | yes |
| search-anti-hallu-embeddingo | `1351d9e2cfc60beb1351d9e2cfc60beb` | 57.6 → 76 (committed 65.5) | 57.9 / 58.1 | 73.5 / 75.8 (committed 65.1 / 66.3) | yes: restored deck, +7.2 / +8.2 pp | search deck broke it (embeddingo#sniff fires in 0% of battles, floor 41.7%; reasoner changed to citation-needed / cooldown; sniff changed to cosine-sniff / foeBuffed); restored, floors met |
| search-anti-hallu-scrapion | `df6a5d03db4e3790df6a5d03db4e3790` | 55.9 → 66.9 (committed 57.7) | 59.9 / 59.7 | 66.1 / 66.1 (committed 62.2 / 61.2) | yes: restored deck, +2.3 / +1.5 pp | search deck broke it (scrapion#check fires in 0% of battles, floor 46.9%; check dropped); restored, floors met |
| mixed-starter-sagelet | `1ddcf7fd357db7371ddcf7fd357db737` | 59.5 → 75 (committed 61.7) | 56.3 / 56.1 | 71.9 / 71.5 (committed 58.7 / 58.4) | yes: restored deck, +2.4 / +2.3 pp | search deck broke it (think changed to proof-by-contradiction / cooldown); restored, floors met |
| mixed-starter-blitzr | `f30d4619bec1cccdf30d4619bec1cccd` | 47.9 → 52.3 | 51.2 / 48.2 | 53 / 52.6 | yes: search final, +1.8 / +4.4 pp | yes |
| mixed-starter-forkling | `482a827adb2b5c9e482a827adb2b5c9e` | 64.3 → 72 | 65.6 / 65.1 | 73.7 / 71.4 | no: the search final (+8.1 / +6.3) drops forkling patch to 0% (floor 11.8%); restoring and repositioning it reaches only 8.3%, so no deck clears the floor | search deck broke it (forkling#patch fires in 0% of battles, floor 11.8%; patch dropped); not restorable |
| mixed-heisenmoth-tempo | `834889a10ab3ab16834889a10ab3ab16` | 25.5 → 47.2 (committed 38.3) | 25 / 27.3 | 50.7 / 50 (committed 37.7 / 41.1) | yes: restored deck, +12.7 / +13.8 pp | search deck broke it (heisenmoth#box fires in 0% of battles, floor 50%; box dropped); restored, floors met |

Adopted: 16 of 20 (6 are the search's own final deck, 10 are restored decks): blitzr, agentoad, graft, sagelet, hallucinat, forkling, slopling, spaghettopus, nullbeetle, parrot, retro, embeddingo, scrapion, mixed-sagelet, mixed-blitzr, heisenmoth. Kept base: cobolt, vibrat, deprecatter and mixed-starter-forkling (no deck cleared both gates and its headline floor). Compared with the first pass, mixed-starter-forkling no longer adopts and open-swarm-forkling and code-lock-spaghettopus adopt smaller, restored decks (+2.5 / +8.0 and +10.0 / +9.7 pp against +5.3 and +12.7). Open-swarm-slopling still clears the second label (+4.1 pp on mine; the reviewer's own second set may differ).

### Headline fire rates, before and after

Before is the pre-D3 rate at 77335b6; the floor is half of it; after is the committed decks against the committed field (the headline test's pass). Every row is at or above its floor. The pre-D3 rates here come from this log's seed set (`headline:<foe id>`, seeds 0–5, both sides); the earlier review's seed set gave a few points different rates (for example spaghettopus Loop 48% there, 41% here), so the floors are specific to this set and the headline test uses the same one.

| archetype | headline card | pre-D3 rate | floor (50%) | after D3 | status |
|---|---|---|---|---|---|
| speed-rush-blitzr | blitzr finish | 27.6% | 13.8% | 24.1% | ok |
| speed-rush-blitzr | tokenibble exit | 54.4% | 27.2% | 51.8% | ok |
| speed-rush-blitzr | tokenibble burst | 93.9% | 47.0% | 93.9% | ok |
| speed-rush-agentoad | agentoad tools | 96.5% | 48.3% | 96.1% | ok |
| speed-rush-agentoad | heisenmoth flash | 78.5% | 39.3% | 80.7% | ok |
| speed-rush-graft | blitzr weak | 27.6% | 13.8% | 28.9% | ok |
| speed-rush-graft | tokenibble burst | 88.6% | 44.3% | 88.6% | ok |
| speed-rush-graft | heisenmoth flash | 77.2% | 38.6% | 78.1% | ok |
| reasoning-nuke-sagelet | sagelet charge | 100.0% | 50.0% | 100.0% | ok |
| reasoning-nuke-sagelet | hallucinat patch | 94.3% | 47.2% | 93.0% | ok |
| reasoning-nuke-sagelet | embeddingo cite | 7.9% | 4.0% | 6.6% | ok |
| reasoning-nuke-hallucinat | hallucinat nuke | 5.3% | 2.7% | 8.8% | ok |
| reasoning-nuke-hallucinat | vibrat hype | 85.1% | 42.6% | 85.1% | ok |
| reasoning-nuke-hallucinat | vibrat accept | 68.9% | 34.5% | 66.7% | ok |
| open-swarm-forkling | forkling coin | 11.4% | 5.7% | 51.8% | ok |
| open-swarm-forkling | fork swarm | 84.2% | 42.1% | 84.6% | ok |
| open-swarm-forkling | slopling swarm | 86.8% | 43.4% | 87.3% | ok |
| open-swarm-slopling | slopling swarm | 96.5% | 48.3% | 96.5% | ok |
| open-swarm-slopling | slopling haze | 37.7% | 18.9% | 34.6% | ok |
| open-swarm-slopling | forkling swarm | 42.5% | 21.3% | 39.5% | ok |
| code-lock-spaghettopus | spaghettopus loop | 41.2% | 20.6% | 31.1% | ok |
| code-lock-spaghettopus | spaghettopus leak | 100.0% | 50.0% | 99.6% | ok |
| code-lock-spaghettopus | nullbeetle pin | 48.2% | 24.1% | 49.1% | ok |
| code-lock-nullbeetle | nullbeetle test | 100.0% | 50.0% | 87.3% | ok |
| code-lock-nullbeetle | nullbeetle loop | 52.6% | 26.3% | 29.4% | ok |
| code-lock-nullbeetle | wasp test | 98.7% | 49.4% | 98.7% | ok |
| code-lock-cobolt | cobolt patch | 22.8% | 11.4% | 20.6% | ok |
| code-lock-cobolt | spaghettopus loop | 66.7% | 33.4% | 70.2% | ok |
| voice-pressure-parrot | parrot hype | 100.0% | 50.0% | 62.7% | ok |
| voice-pressure-parrot | parrot flatter | 91.2% | 45.6% | 99.6% | ok |
| voice-pressure-vibrat | vibrat hype | 93.0% | 46.5% | 91.2% | ok |
| voice-pressure-vibrat | parrot flatter | 100.0% | 50.0% | 100.0% | ok |
| memory-stall-deprecatter | deprecatter save | 81.6% | 40.8% | 80.3% | ok |
| memory-stall-deprecatter | deprecatter replay | 18.0% | 9.0% | 20.2% | ok |
| memory-stall-deprecatter | cobolt patch | 43.9% | 22.0% | 42.1% | ok |
| memory-stall-retro | deprecatter save | 91.2% | 45.6% | 89.9% | ok |
| memory-stall-retro | cobolt patch | 43.9% | 22.0% | 40.8% | ok |
| search-anti-hallu-embeddingo | embeddingo reasoner | 18.0% | 9.0% | 9.6% | ok |
| search-anti-hallu-embeddingo | embeddingo sniff | 83.3% | 41.7% | 78.9% | ok |
| search-anti-hallu-embeddingo | scrapion check | 44.7% | 22.4% | 39.0% | ok |
| search-anti-hallu-scrapion | scrapion steal | 13.2% | 6.6% | 12.3% | ok |
| search-anti-hallu-scrapion | scrapion check | 93.9% | 47.0% | 93.9% | ok |
| search-anti-hallu-scrapion | embeddingo sniff | 83.8% | 41.9% | 83.8% | ok |
| mixed-starter-sagelet | sagelet think | 97.4% | 48.7% | 97.4% | ok |
| mixed-starter-sagelet | intern exit | 45.2% | 22.6% | 39.9% | ok |
| mixed-starter-blitzr | blitzr speed | 100.0% | 50.0% | 100.0% | ok |
| mixed-starter-blitzr | intern exit | 49.1% | 24.6% | 49.6% | ok |
| mixed-starter-forkling | forkling flex | 91.2% | 45.6% | 91.2% | ok |
| mixed-starter-forkling | forkling patch | 23.7% | 11.9% | 20.6% | ok |
| mixed-starter-forkling | intern exit | 49.6% | 24.8% | 45.2% | ok |
| mixed-heisenmoth-tempo | heisenmoth flash | 10.1% | 5.1% | 12.7% | ok |
| mixed-heisenmoth-tempo | heisenmoth box | 100.0% | 50.0% | 100.0% | ok |
| mixed-heisenmoth-tempo | deprecatter save | 84.6% | 42.3% | 84.6% | ok |

The two cases the review named: parrot's Flatter is back to its cooldown(3) condition and fires in 99.6% of battles (91.2% before D3; the search had cut it to 2%), with its Glaze card kept; embeddingo's Reasoner is "foe is Reasoning type" again.

### Verdicts before

Before is D2's after: `pnpm sim targets` at full scale, engine 0.4.0, content fingerprint c3169bd34fb68888, git b4587a0.

### Verdicts after

`pnpm sim targets` at full scale, engine 0.4.0, content fingerprint 8451d71bea9df836, git 88c3079 (clean). Report: `reports/targets-2026-11-10.md` (overwrites the same-date report).

| target | band | before (D2) | after (D3) | verdict |
|---|---|---|---|---|
| Any archetype vs the field | ≤ 55% | 11 pass, 0 inconclusive, 9 fail | 12 pass, 0 inconclusive, 8 fail | fail → fail (scrapion now passes) |
| Worst single matchup | ≥ 30% | 0 pass, 20 fail (worst 0.0%) | 0 pass, 20 fail (worst 0.0%, forkling vs sagelet) | fail → fail |
| Starter triangle | 55–65% | 99.3 / 91.3 / 100.0 | 99.3 / 91.3 / 100.0 (role decks, not archetype decks) | fail → fail |
| Temperature dial | within 5 points of 50% | 56.9% [54.7, 59.1] | 57.8% [55.6, 59.9] | fail → fail |
| Graft worth taking | ≥ 55% | parrot 71.5 pass, nullbeetle 81.7 pass, wasp 23.3 fail | identical (base-team setups) | fail → fail |
| Fight length | median 5–8 | median 7 | median 7 | pass → pass |
| First mover | 48–52% | 50.9% [49.9, 51.9] | 51.1% [50.2, 52.1] | pass → inconclusive |

Per archetype (before, D2 report; after, this run):

| archetype | vs field before | verdict | vs field after | verdict | worst matchup before | worst matchup after |
|---|---|---|---|---|---|---|
| speed-rush-blitzr | 67.8% | fail | 66.3% | fail | open-swarm-forkling 18.0% | open-swarm-forkling 13.7% |
| speed-rush-agentoad | 48.6% | pass | 47.6% | pass | memory-stall-deprecatter 10.8% | memory-stall-deprecatter 13.4% |
| speed-rush-graft | 46.1% | pass | 49.4% | pass | open-swarm-forkling 0.4% | open-swarm-forkling 1.1% |
| reasoning-nuke-sagelet | 85.1% | fail | 83.5% | fail | speed-rush-blitzr 21.2% | speed-rush-blitzr 21.3% |
| reasoning-nuke-hallucinat | 74.4% | fail | 71.3% | fail | speed-rush-blitzr 27.7% | speed-rush-blitzr 27.3% |
| open-swarm-forkling | 69.0% | fail | 70.2% | fail | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| open-swarm-slopling | 61.7% | fail | 57.1% | fail | reasoning-nuke-sagelet 1.5% | reasoning-nuke-sagelet 0.9% |
| code-lock-spaghettopus | 48.4% | pass | 53.4% | pass | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.1% |
| code-lock-nullbeetle | 10.9% | pass | 17.5% | pass | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| code-lock-cobolt | 37.5% | pass | 31.1% | pass | reasoning-nuke-sagelet 0.0% | reasoning-nuke-sagelet 0.0% |
| voice-pressure-parrot | 26.1% | pass | 36.6% | pass | search-anti-hallu-embeddingo 5.3% | code-lock-spaghettopus 16.9% |
| voice-pressure-vibrat | 39.9% | pass | 36.4% | pass | reasoning-nuke-sagelet 8.4% | reasoning-nuke-sagelet 5.9% |
| memory-stall-deprecatter | 49.0% | pass | 42.9% | pass | search-anti-hallu-scrapion 0.1% | search-anti-hallu-embeddingo 0.1% |
| memory-stall-retro | 20.9% | pass | 19.7% | pass | search-anti-hallu-embeddingo 0.3% | search-anti-hallu-embeddingo 0.3% |
| search-anti-hallu-embeddingo | 57.2% | fail | 61.2% | fail | reasoning-nuke-sagelet 1.3% | reasoning-nuke-sagelet 4.3% |
| search-anti-hallu-scrapion | 57.5% | fail | 54.5% | pass | reasoning-nuke-sagelet 9.2% | search-anti-hallu-embeddingo 7.7% |
| mixed-starter-sagelet | 57.4% | fail | 55.6% | fail | speed-rush-graft 11.9% | speed-rush-graft 10.4% |
| mixed-starter-blitzr | 49.9% | pass | 48.7% | pass | mixed-starter-forkling 14.8% | mixed-starter-forkling 14.7% |
| mixed-starter-forkling | 66.4% | fail | 62.9% | fail | reasoning-nuke-sagelet 9.3% | reasoning-nuke-sagelet 7.8% |
| mixed-heisenmoth-tempo | 26.2% | pass | 34.4% | pass | code-lock-spaghettopus 0.0% | reasoning-nuke-sagelet 0.4% |

### Moved out of band

- First mover: pass → inconclusive (51.1%, the interval's upper edge 52.1 crosses 52). The point is inside the band.
- Temperature dial: still fail, 0.9 pp further out (56.9% → 57.8%).
- Fixed: search-anti-hallu-scrapion (57.5% → 54.5%) now passes. No other row went from pass to fail.
- Still failing (≤ 55%): blitzr 66.3%, sagelet 83.5%, hallucinat 71.3%, forkling 70.2%, slopling 57.1%, embeddingo 61.2%, mixed-sagelet 55.6% (it passed, at 54.4%, in the first pass), mixed-forkling 62.9%.
- Worst-matchup points: parrot's worst rose from 5.3% to 16.9% and embeddingo's from 1.3% to 4.3%; blitzr's fell 18.0% → 13.7%. Every row still fails 30%; the structural zeros (forkling, nullbeetle, cobolt vs sagelet) are untouched.

### Reading

- The headline floors cost strength, as intended. Parrot's committed deck holds 42.1 / 40.8 held-out, not the 61.7 the search found by dropping its Hype Train and moving its Flattery to round 7, and its round-robin score is 36.6% against 52.2% in the first pass. Likewise embeddingo, sagelet, nullbeetle and spaghettopus adopt the restored decks, not the search's.
- The search is a zero-sum improver against a fixed field: the weakest decks gained most (parrot 26.1% → 36.6%, nullbeetle 10.9% → 17.5%, heisenmoth 26.2% → 34.4%), and the dominant trio is still far over 55%: sagelet 83.5%, forkling 70.2%, hallucinat 71.3%. Adopting a better sagelet (+1.6 / +1.5 pp) is the rule's outcome, not a fix; the over-band gap is D4's.
- Held-out samples are 608 battles, so one gain carries about ±2 pp; adopting on two independent labels removes the one-label luck the first pass relied on. Several adopted decks score lower in the round-robin than before (blitzr 67.8% → 66.3%, hallucinat 74.4% → 71.3%, retro 20.9% → 19.7%) because their foes improved too.
- The remaining gaps are not deck problems: the sagelet and forkling dominance, the structural 0.0% matchups, the triangle and the wasp graft are for D4's number and content work.

### Timing

| measurement | D2 | D3 first pass | D3 fix round 1 |
|---|---|---|---|
| Round-robin inside targets (380,000 battles) | 479.0 s | 450.4 s | 572.9 s |
| `pnpm sim targets` wall time | 519.5 s | 489.0 s | 622.7 s |

The round-robin is 123 s slower than the first pass, 27 s under the 600 s limit of criterion 7. This is machine variance, not deck content: the reviewer's like-for-like round-robin runs on the 77335b6, 53d7ccc and 5815618 decks, on one machine, are within about 3% of each other. The median fight length is 7 throughout. Re-time it before D5 for the record.

### Tests

- `test/archetypes.test.ts`: the headline test asserts every headline card fires and fires at least half as often as its `preD3Rate`, over 228 battles per archetype (60 s timeout).
- `test/target-setups.test.ts`, temperature live check: counts a substitution only while the orchestrator holds no Drift (the mixed-starter-sagelet deck can reach Drift at T0, where 5% per stack is a legitimate substitution). The exclusion is conservative: it discards every substitution made under Drift, so it can only hide a T0 substitution, and the T4 check still needs one outside Drift.
- `test/search.test.ts`, "keeps exactly 8 cards…": climbs from a deliberately weak synthetic deck (every card and the Default only guard) at budget 960, k 8, instead of from archetype data.

### Fingerprint

Fix round 2 renamed card ids only, so the content fingerprint is now a7b116a0136a651b (the targets report above carries 8451d71bea9df836 and was run before the rename). Behaviour is unchanged: ids are not read by the engine's decisions, and the full test suite passes.

### Notes for D4

- search-anti-hallu-embeddingo's card `compact-speed-type` is `self` + "is speed type" (a foeType category on a self subject, id `drift` before the rename, a leftover of the search). It is unlikely to fire meaningfully; behaviour was left alone in D3. D4 should drop or fix it.
