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

## Step D4: iterative content tuning (Ruling 152, engine content; ENGINE_VERSION stays 0.4.0 until the one bump to 0.4.1 at the end)

### Method

- One engine-content number per candidate. Each candidate is screened with `pnpm sim targets --seeds-scale 0.1 --tag scratch-d4-<id>`, compared row by row against a 0.1-scale run of the current kept state (the same seeds, so the comparison is paired). Full-scale `pnpm sim targets` confirms a candidate before it is kept, and before the next candidate is screened. Heavy jobs ran one at a time, in the background, with logs.
- **Keep rule.** A change is kept only if its own target moves toward its band and no other target leaves its band (a pass or inconclusive becoming a fail). For the 20-row vs-field target, "toward" means the summed excess over 55% (Σ max(0, point − 55) over the 20 rows) falls, or a failing row comes into band, with no row becoming a fail.
- **Screen-scale noise.** At scale 0.1 the first-mover row is 1,000 mirror battles; it reads 48.1% there against 51.1% at full scale, so its 0.1 "fail" flags are noise. First mover is judged at full scale only, where it stayed in band after every kept change (51.1–51.2% for K1–K3, 50.8% after K4).
- **Full-seed dial.** A scratch script (outside the repo) re-runs the official temperature-dial row with its exact `targets:temperature-dial:<id>` labels and 50 battles per side (2,000 battles, the full-scale row), plus the mean of the 20 sweep rows on their own labels. It reproduces the targets row exactly (56.0% at K1 in both).
- **Blowouts.** The coordinator's priority for this pass is "no matchup at or near 100%" and fight length. `pnpm sim round-robin --seeds 200 --tag scratch-d4-rr-<state>` (200 battles per ordered pairing, 400 per unordered pairing) counts the unordered pairings at or beyond 99/1, 95/5, 90/10 and 80/20.
- The content fingerprint in the reports (FNV-1a of ARCHETYPES and the target setups) does not cover engine content, so every D4 scratch report carries a7b116a0136a651b. The engine version stays 0.4.0 in them.

### Baseline

`pnpm sim targets` at full scale on 9af6141 (clean, `scratch-d4-base`) reproduces the committed D3 report (`reports/targets-2026-11-10.md`, run on 88c3079) row for row: the D3 fix round 2 card-id renames changed no behaviour. Wall time 563.8 s.

Blowouts at baseline (`scratch-d4-rr-base`): of 190 unordered pairings, 19 at or beyond 99/1, 34 at or beyond 95/5, 57 at or beyond 90/10, 91 at or beyond 80/20, 39 within 40–60; median fight length 7.

### Target 2, the starter triangle: blocked for single starter numbers

The triangle is a cycle (Blitzr > Sagelet > Forkling > Blitzr), and each starter's damaging moves are all of its own type, so on every edge the favoured side deals 1.5 × (1 / ⅔) = 2.25× the type-relative damage, on top of STAB on both sides. A base stat, power or cost change helps or hurts a starter on both of its edges at once: it is favoured on one and the underdog on the other. In a logit picture, stat differences sum to zero around the cycle, so stats can redistribute the three edges but cannot lower all three. Probes, `pnpm --filter @latentia/sim triangle-solo` (2,000 per matchup, blitzr > sagelet / sagelet > forkling / forkling > blitzr; baseline 99.3 / 91.3 / 100.0, median rounds 3, 5, 2):

| probe | blitzr > sagelet | sagelet > forkling | forkling > blitzr |
|---|---|---|---|
| Sagelet HP 60 → 70 | 98.6 | 96.9 | 100.0 |
| Sagelet HP 60 → 80 | 98.4 | 98.3 | 100.0 |
| Sagelet HP 60 → 95 | 98.4 | 99.7 | 100.0 |
| Sagelet Latency 55 → 75 | 99.3 | 100.0 | 100.0 |
| Happy to Help cost 3 → 2 | 94.3 | 100.0 | 100.0 |
| Forkling Compute 60 → 50 | 99.3 | 97.0 | 100.0 |
| Distilled Strike 75 → 65 | 99.3 | 91.3 | 100.0 |
| Ship It 65 → 45 | 96.5 | 91.3 | 100.0 |

- Every probe that softens one edge hardens another. Forkling > Blitzr does not move off 100% (median 2 rounds: Hard Fork kills Blitzr in two hits while the decoy eats Blitzr's first).
- Distilled Strike does not move Blitzr > Sagelet because the role deck's signature card ("where super effective") plays Ship It against Sagelet. Ship It 45 does move that edge (99.3 → 96.5), but only because the template plays the signature over a stronger move. That is the Review Focus's "60/40 by accident of deck templates", so it is not a candidate.
- Reaching 55–65% needs either coverage (a non-own-type damaging move for each starter, which is new content or learnsets, out of scope) or a softer chart (settled in D2). This is reported, not tuned. No starter number was changed to fix the triangle, and the triangle rows are 99.3 / 91.2 / 100.0 throughout. K3 (Swarm of Fine-Tunes 20 → 15 per hit) did change Forkling's own move, but the role deck never plays it (Hard Fork is stronger), so the solo rows did not move.

### Target 4, the Off-By-Wasp graft: blocked by targeting, not value

The graft row (base team + Off-By-One graft vs the base team, Sagelet + Tokenibble) reads 23.3%. Scratch probes with the graft setup itself (`runPooled(graftVariant('off-by-wasp'), baseTeam(), 500, …)`, 1,000 battles each):

| Off-By-One | graft row |
|---|---|
| power 120 (was 75) | 31.9% |
| power 160 | 67.1% |
| power 75, target `foe` instead of `foeOffByOne` | 55.0% |

- The graft card aims at `lowestHpFoe`, and the off-by-one redirect then hits the other, healthier foe, so the graft splits damage away from the kill. The signature's value would need about 150 power at cost 1 to overcome that. That breaks the wasp's seven archetypes: at 95 power, speed-rush-blitzr already rose 1.7 pp in screening while the row moved only 22.5 → 25.5%.
- The cause is the gag's targeting meeting the template's aim, not the content value. The fix belongs to the target template (aim the graft card so that one tile left is the intended foe) or to a ruling; it is not a D4 content change.
- **Template-only fix, probed late.** Re-aiming the graft card at `highestAtkFoe` with Off-By-One left at power 75 reaches about 55.8% on the graft row: borderline and inconclusive, not a clean pass. When the aim lands on `highestAtkFoe`, the off-by-one redirect puts the hit on Sagelet, and Code into Reasoning is resisted (⅔), a likely reason the template fix stops near 56% rather than clearing the band.
- Side finding (screen c26, below): Token Nibble 55 → 45, the base team's intern, flips this row to 63.5% at scale 0.1, so the row also depends on how fast the intern ends fights. It was rejected for other rows.

### Candidates on the baseline state (scale 0.1; reference `scratch-d4-s01-base`, summed excess 88.7, 8 vs-field rows failing, dial 59.0%)

| id | change | why this number | excess | vs-field rows failing | dial | left band | decision |
|---|---|---|---|---|---|---|---|
| c1 | Hallucinat Compute 75 → 65 | first-balance-pass §d move 3 | 88.7 → 97.6 | 8 → 7 | 59.0 → 56.5 | none | rejected: reasoning-nuke-hallucinat rises 71.3 → 79.8 and search-anti-hallu-embeddingo 61.1 → 62.6. Lower Compute stops Hallucinat being the `highestAtkFoe` that foes' cards aim at, so it is focused less |
| c2 | Chain of Thought ramp cap +60 → +30 | cap at 90 power, level with the cost-3 nukes | 88.7 → 88.4 | 8 → 8 | 59.0 → 59.0 | none | rejected: no measurable effect (the ramp rarely reaches the cap; ≤ 1.1 pp on any row) |
| c3 | Retrieval Strike 70 → 60 | the slice's most efficient attack (70·1·100) | 88.7 → 88.7 | 8 → 7 | 59.0 → 57.5 | none | rejected: net zero, open-swarm-forkling +1.8 offsets the Search teams' drop |
| c4 | Swarm of Fine-Tunes 20 → 15 per hit | 45 in a three-Open team instead of 60, at cost 2 and 100 accuracy | 88.7 → 82.9 | 8 → 9 | 59.0 → 59.0 | search-anti-hallu-scrapion 54.7 → 56.1 | rejected on this state; taken later as K3 |
| c5 | Hard Fork 70 → 60 | Forkling's 100-accuracy signature | 88.7 → 88.5 | 8 → 8 | 59.0 → 59.5 | scrapion 54.7 → 55.8 | rejected |
| c6 | Sagelet Compute 70 → 60 | the nuke's orchestrator | 88.7 → 98.8 | 8 → 8 | 59.0 → 56.0 | none | rejected: mixed-starter-sagelet +11.9, embeddingo +6.1 (the same `highestAtkFoe` effect as c1) |
| c7 | Six Fingers 65 → 55 | Slopling's signature | 88.7 → 87.6 | 8 → 8 | 59.0 → 60.0 | none | rejected: small; superseded |
| c8 | Leaderboard Flex bonus +30 → +15 | open-swarm-forkling's top damage | 88.7 → 88.7 | 8 → 8 | 59.0 → 59.0 | none | rejected: net zero |
| c9 | Cosine Sniff 70 → 60 | Embeddingo's carry | 88.7 → 86.2 | 8 → 7 | 59.0 → 55.5 | none | superseded by c10 |
| c10 | Cosine Sniff 70 → 55 | see K2 | 88.7 → 85.7 | 8 → 6 | 59.0 → 55.5 | none | candidate; taken as K2 after K1 |
| c11 | Scrape 60 → 50 | Scrapion's signature, 25 damage a battle in the Embeddingo team | 88.7 → 88.3 | 8 → 8 | 59.0 → 59.0 | none | rejected: small |
| c12 | T4 accuracy −15 → −10 | §d move 4; see K1 | 88.7 → 84.6 | 8 → 7 | 59.0 → 57.0 | none | **kept as K1** |
| c13 | Deprecatter Robustness 45 → 60 | §d move 2 | 88.7 → 86.3 | 8 → 8 | 59.0 → 59.0 | none | not taken: the memory teams gain about 3 pp but no failing row moves more than 0.6; superseded under the 8-change budget |
| c14 | Adversarial Patch 70 → 60 | Hallucinat's and Slopling's attack | 88.7 → 89.1 | 8 → 8 | 59.0 → 59.5 | none | rejected |
| c15 | Distilled Strike 75 → 65 | §d move 6 | 88.7 → 90.1 | 8 → 9 | 59.0 → 59.0 | scrapion 54.7 → 55.4 | rejected: reasoning-nuke-sagelet +1.6 (Blitzr is its main check) |
| c16 | Confident Citation 70 → 60 | Hallucinat's signature | 88.7 → 90.0 | 8 → 9 | 59.0 → 59.0 | scrapion 54.7 → 55.7 | rejected |
| c17 | Off-By-One 75 → 95 | §d move 5a (target 4) | 88.7 → 88.5 | 8 → 8 | 59.0 → 59.0 | none | rejected: graft row only 22.5 → 25.5, speed-rush-blitzr +1.7 |

Damage breakdowns (scratch, 20 battles per side against each of the 19 others) show why single-move nerfs move these teams so little. Reasoning-nuke-sagelet deals 26.6 damage a battle with Embeddingo's Cosine Sniff and 18.8 with Retrieval Strike, against 24.0 from Sagelet itself (Chain of Thought, Happy to Help and Proof by Contradiction). Open-swarm-forkling deals 34.4 with Leaderboard Flex. Most of their wins are type blowouts against the Code-heavy field, which a 15% damage cut rarely flips. Scrapion (54.5%, its interval touching 55%) is the first gatekeeper: most Open- and Speed-team nerfs push it over.

### K1: T4 accuracy −15 → −10 (kept)

- **Change:** `content/temperature.ts` T4 row, accMod −15 → −10.
- **Why −10:** it is first-balance-pass §d move 4, and it makes the accuracy column linear (+10, +5, 0, −5, −10). T4 still pays the most for its 60–150% roll, 1/6 crit and 12% self-hallucination. The dial's cold edge came from T4's −15 accuracy against "nearly flat" expected damage (finding 7).
- **Screen (c12):** dial 59.0 → 57.0, excess 88.7 → 84.6, mixed-starter-sagelet into band, scrapion 54.7 → 54.1.
- **Full scale** (`scratch-d4-k1`, 577.3 s), before = baseline:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 66.3% | 67.1% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 47.6% | 52.2% | pass |
| vs field (≤ 55%) | speed-rush-graft | 49.4% | 48.6% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 83.5% | 82.9% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 71.3% | 70.5% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 70.2% | 69.5% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 57.1% | 56.0% | fail |
| vs field (≤ 55%) | code-lock-spaghettopus | 53.4% | 52.6% | pass |
| vs field (≤ 55%) | code-lock-nullbeetle | 17.5% | 16.9% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 31.1% | 31.4% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 36.6% | 39.1% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 36.4% | 39.8% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 42.9% | 42.2% | pass |
| vs field (≤ 55%) | memory-stall-retro | 19.7% | 18.9% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 61.2% | 60.6% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 54.5% | 53.8% | pass |
| vs field (≤ 55%) | mixed-starter-sagelet | 55.6% | 54.7% | fail → **inconclusive** |
| vs field (≤ 55%) | mixed-starter-blitzr | 48.7% | 47.7% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 62.9% | 61.9% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 34.4% | 33.4% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 13.7% | 14.8% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 13.4% | 15.6% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.1% | 1.1% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 21.3% | 19.8% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 27.3% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.9% | 0.9% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs reasoning-nuke-sagelet | 0.1% | 0.1% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 16.9% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 5.9% | 7.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.1% | 0.1% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.3% | 0.3% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs reasoning-nuke-sagelet | 4.2% | 4.2% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 7.7% | 7.7% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 10.4% | 10.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs mixed-starter-forkling | 14.7% | 14.7% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 7.8% | 7.8% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 0.4% | 0.4% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 57.8% | 56.0% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.1% | 51.1% | inconclusive |

Vs-field rows failing 8 → 7; summed excess over 55% 87.9 → 83.6 pp.

(Worst-matchup rows are each archetype's worst pairing in that run; the row names the after run's pairing.)

- **Decision:** kept. The dial moves toward its band (57.8 → 56.0, still a fail) and vs field improves (excess 87.9 → 83.6, mixed-starter-sagelet fail → inconclusive). No row left its band. speed-rush-agentoad (own T4) rises 47.6 → 52.2 and the two voice builds (T4/T3) rise 2–3 pp, all still in band. Bible temperature table updated in the same commit.

### Candidates on the K1 state (scale 0.1; reference `scratch-d4-s01-k1`, excess 84.6, 7 failing, dial 57.0% at this scale)

| id | change | why this number | excess | vs-field rows failing | dial | left band | decision |
|---|---|---|---|---|---|---|---|
| c18 | T4 self-hallucination 12% → 8% | §d move 4's alternative; 8% stays above T3's 5% | 84.6 → 84.4 | 7 → 8 | full-seed dial 54.975% [52.8, 57.1], inconclusive | speed-rush-agentoad (own T4) 52.8 → 56.5 | rejected: any T4 buff lifts the T4-native agentoad over 55% |
| c19 | Tool Call 15 → 12 per hit | agentoad's signature; 17.3 damage a battle in speed-rush-blitzr | 84.6 → 88.4 | 7 → 7 | 57.0 → 59.5 | none | rejected: blitzr −1.4 but the Open and mixed teams gain more |
| c20 | Cosine Sniff 70 → 55 | see K2 | 84.6 → 83.1 | 7 → 6 | full-seed dial 55.45% (screen 53.0) | none | **kept as K2** |

Cosine Sniff 60 on this state gives a full-seed dial of 55.25%, against 55.45% for 55; 55 was taken for its larger vs-field effect (c9 against c10 on the baseline: excess −2.5 against −3.0, failing rows −1 against −2).

### K2: Cosine Sniff 70 → 55 (kept)

- **Change:** `content/moves/signatures.ts`, Cosine Sniff (Embeddingo's signature) power 70 → 55. Cost 2, accuracy 90 and the `foeMostDamage` aim are unchanged.
- **Why 55:** Cosine Sniff picks the foe it hurts most, so in practice it lands super effective whenever any foe is weak to Search, which against this Code-heavy field is almost always. At 55 its usual hit is 55 × 1.5 ≈ 82, above a neutral 70-power signature, so it is still the best move into a weakness, as the gag says, without being the slice's top single damage source (26.6 damage a battle in reasoning-nuke-sagelet before). It is a placeholder signature with no bible number. The bible's Embeddingo row gives only the gag, so the bible needs no change.
- **Screen (c20):** excess 84.6 → 83.1, open-swarm-slopling 56.0 → 52.9, mixed-starter-sagelet into band, scrapion 54.1 → 52.8.
- **Full scale** (`scratch-d4-k2`, 441.7 s), before = K1:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 67.1% | 67.5% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 52.2% | 53.0% | pass |
| vs field (≤ 55%) | speed-rush-graft | 48.6% | 49.0% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 82.9% | 80.6% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 70.5% | 71.8% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 69.5% | 69.1% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 56.0% | 53.0% | fail → **pass** |
| vs field (≤ 55%) | code-lock-spaghettopus | 52.6% | 53.5% | pass |
| vs field (≤ 55%) | code-lock-nullbeetle | 16.9% | 17.1% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 31.4% | 32.0% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 39.1% | 39.7% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 39.8% | 40.1% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 42.2% | 43.1% | pass |
| vs field (≤ 55%) | memory-stall-retro | 18.9% | 19.4% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 60.6% | 61.1% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 53.8% | 52.4% | pass |
| vs field (≤ 55%) | mixed-starter-sagelet | 54.7% | 53.0% | inconclusive → **pass** |
| vs field (≤ 55%) | mixed-starter-blitzr | 47.7% | 47.9% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 61.9% | 62.5% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 33.4% | 34.0% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 14.8% | 14.8% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 15.6% | 15.6% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.1% | 1.1% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 19.8% | 19.3% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 26.1% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.9% | 0.5% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs search-anti-hallu-embeddingo | 0.1% | 0.2% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs search-anti-hallu-embeddingo | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 19.0% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 7.4% | 10.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.1% | 0.2% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.3% | 0.4% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs speed-rush-graft | 4.2% | 4.0% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 7.7% | 1.8% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 10.4% | 8.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs mixed-starter-forkling | 14.7% | 14.7% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 7.8% | 9.7% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 0.4% | 1.0% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 56.0% | 55.5% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.1% | 51.2% | inconclusive |

Vs-field rows failing 7 → 6; summed excess over 55% 83.6 → 82.6 pp.

- **Decision:** kept. Vs field: 7 → 6 rows failing (open-swarm-slopling 56.0 → 53.0 now passes; mixed-starter-sagelet inconclusive → pass), excess 83.6 → 82.6 pp; reasoning-nuke-sagelet 82.9 → 80.6. The dial also moves toward its band (56.0 → 55.5). No row left its band. Scrapion, the gatekeeper, falls 53.8 → 52.4, which leaves room for K3. reasoning-nuke-hallucinat rises 70.5 → 71.8 (still a fail; it loses fewer pairings to the Embeddingo teams).

### Candidates on the K2 state (scale 0.1; reference `scratch-d4-s01-k2`, excess 83.1, 6 failing)

| id | change | why this number | excess | vs-field rows failing | left band | decision |
|---|---|---|---|---|---|---|
| c21 | Swarm of Fine-Tunes 20 → 15 per hit | see K3 | 83.1 → 76.8 | 6 → 6 | none (scrapion 52.8 → 54.4 and spaghettopus 53.2 → 54.5 become inconclusive) | **kept as K3** |
| c22 | Hard Fork 70 → 60 | Forkling's 100-accuracy signature | 83.1 → 83.7 | 6 → 6 | none | rejected: open-swarm-slopling −6.3 but forkling only −1.6 and the rest rise |
| c23 | Leaderboard Flex base 65 → 55 | open-swarm-forkling's top damage (34.4 a battle) | 83.1 → 79.5 | 6 → 6 | none | not taken: c21 is larger; re-screened after K3 (c27, K4 attempt) |

### K3: Swarm of Fine-Tunes 20 → 15 per hit (kept)

- **Change:** `content/moves/open.ts`, Swarm of Fine-Tunes power 20 → 15 per hit. The hit count, 1 + Open allies, is unchanged.
- **Why 15:** Swarm's identity is that it scales with Open allies. In open-swarm-forkling's three-Open line-up it was 3 × 20 = 60 power at cost 2 and 100 accuracy, a multi-hit that breaks shields and guards one hit at a time, and its 18 + 11 damage a battle sat beside Leaderboard Flex and Hard Fork. At 15 a hit the three-Open swarm is 45 (60 with a fourth Open creature). That keeps the scaling and keeps it below Hard Fork's 70 single hit. It is used only by the three Open-swarm teams (forkling swarm, slopling swarm, mixed-starter-forkling) and the Forkling starter grid's Skill piece. The triangle's role deck never plays it: Hard Fork is the stronger move.
- Rejected on the baseline state (c4) because scrapion crossed 55%. After K2 lowered scrapion to 52.4%, it no longer does.
- **Full scale** (`scratch-d4-k3`, 433.5 s), before = K2:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 67.5% | 67.8% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 53.0% | 53.2% | pass |
| vs field (≤ 55%) | speed-rush-graft | 49.0% | 49.2% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 80.6% | 80.6% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 71.8% | 72.0% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 69.1% | 61.6% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 53.0% | 51.4% | pass |
| vs field (≤ 55%) | code-lock-spaghettopus | 53.5% | 54.5% | pass → **inconclusive** |
| vs field (≤ 55%) | code-lock-nullbeetle | 17.1% | 17.3% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 32.0% | 32.5% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 39.7% | 40.5% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 40.1% | 40.6% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 43.1% | 43.6% | pass |
| vs field (≤ 55%) | memory-stall-retro | 19.4% | 19.7% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 61.1% | 62.0% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 52.4% | 53.8% | pass |
| vs field (≤ 55%) | mixed-starter-sagelet | 53.0% | 53.7% | pass |
| vs field (≤ 55%) | mixed-starter-blitzr | 47.9% | 49.1% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 62.5% | 62.7% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 34.0% | 34.3% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 14.8% | 18.9% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 15.6% | 15.6% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.1% | 1.9% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 19.3% | 19.3% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 26.1% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.5% | 0.4% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs search-anti-hallu-embeddingo | 0.2% | 0.2% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs search-anti-hallu-embeddingo | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 19.0% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 10.4% | 10.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.2% | 0.2% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.4% | 0.4% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs speed-rush-graft | 4.0% | 4.0% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 1.8% | 1.8% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 8.4% | 8.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs mixed-starter-forkling | 14.7% | 14.9% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 9.7% | 9.7% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 1.0% | 1.0% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 55.5% | 55.5% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.2% | 51.1% | inconclusive |

Vs-field rows failing 6 → 6; summed excess over 55% 82.6 → 76.7 pp.

- **Decision:** kept. open-swarm-forkling 69.1 → 61.6 (still a fail) and the vs-field excess 82.6 → 76.7 pp, the largest single step of D4. No row left its band. code-lock-spaghettopus goes pass → inconclusive (53.5 → 54.5, allowed) and becomes the next gatekeeper with scrapion (53.8). Dial 55.5% (unchanged), first mover 51.1%, fight length median 7.
- **Blowouts after K1–K3** (`scratch-d4-rr-k3`, against `scratch-d4-rr-base`): pairings at or beyond 99/1 19 → 16, at or beyond 95/5 34 → 30, at or beyond 90/10 57 → 51, at or beyond 80/20 91 → 81; within 40–60 39 → 43; median fight length 7 → 7.
- Bible move list (Swarm of Fine-Tunes 20× → 15×) and the integrity test's pinned row updated in the same commit.

### Candidates on the K3 state (scale 0.1; reference `scratch-d4-s01-k3`, excess 76.8, 6 failing)

| id | change | why this number | excess | vs-field rows failing | left band | decision |
|---|---|---|---|---|---|---|
| c24 | Retrieval Strike 70 → 60 | Embeddingo's carry in the sagelet nuke (19.5 a battle) | 76.8 → 78.1 | 6 → 6 | none | rejected: excess up (open-swarm-forkling +1.5) |
| c25 | Segfault 110 → 95 | the hallucinat nuke's top damage (23.9 a battle) | 76.8 → 78.9 | 6 → 7 | speed-rush-agentoad 53.9 → 55.4 | rejected (spaghettopus 54.5 → 50.1 and the dial −3 would have helped) |
| c26 | Token Nibble 55 → 45 | Tokenibble's cost-1 signature with a rider | 76.8 → 78.1 | 6 → 8 | spaghettopus 54.5 → 55.6, scrapion 54.4 → 56.3 | rejected; side finding: the wasp graft row 22.5 → 63.5 (see target 4) |
| c27 | Leaderboard Flex base 65 → 55 | 85 when ahead on HP%, 55 when behind | 76.8 → 72.3 | 6 → 7 | scrapion 54.4 → 55.3 at this scale | confirmed at full scale as the K4 attempt: rejected (below) |
| c28 | Agentoad HP 65 → 55 | Agentoad's 260 base total is the slice's second highest, after Cobolt the tank | 76.8 → 76.5 | 6 → 6 | none | candidate (speed-rush-blitzr −1.3, agentoad −2.2, making room for a T4 dial change); its full run was lost to an environment restart and it was not re-run (see below) |
| c29 | Tangle 65 → 55 | Spaghettopus's signature, to make room under the gatekeeper | 76.8 → 78.6 | 6 → 6 | none | rejected: an enabler only; vs field moves away |
| c30 | T4 self-hallucination 12% → 9% | full-seed dial 54.7% [52.5, 56.9] (10% gives 55.1%, a fail) | 76.8 → 78.1 | 6 → 7 | speed-rush-agentoad 53.9 → 57.1 | rejected: the T4-native agentoad crosses 55% |

Full-seed dial probes on the K3 state (official labels, 2,000 battles): K3 55.55% [53.4, 57.7] (sweep mean 55.7%); T4 self-hallucination 10% 55.10%, 9% 54.70%; T4 accuracy −8 54.35%. Every T4 buff lifts speed-rush-agentoad, which plays at T4, so the dial is deferred, not blocked: agentoad (53.2%) has to come down first. A two-step path was probed at full dial scale but not confirmed: first Agentoad HP 65 → 55 (c28, which already passes the keep rule), then T4 self-hallucination 12% → 9%. That put the dial at about 54.6% (inconclusive) and speed-rush-agentoad at 53.8%.

### K4 attempt: Leaderboard Flex base 65 → 55 (rejected at full scale)

`scratch-d4-k4` (454.1 s), before = K3:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 67.8% | 68.3% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 53.2% | 53.6% | pass |
| vs field (≤ 55%) | speed-rush-graft | 49.2% | 49.7% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 80.6% | 80.7% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 72.0% | 72.5% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 61.6% | 57.7% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 51.4% | 52.1% | pass |
| vs field (≤ 55%) | code-lock-spaghettopus | 54.5% | 55.1% | inconclusive → **fail** |
| vs field (≤ 55%) | code-lock-nullbeetle | 17.3% | 17.6% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 32.5% | 33.3% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 40.5% | 41.0% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 40.6% | 40.8% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 43.6% | 41.5% | pass |
| vs field (≤ 55%) | memory-stall-retro | 19.7% | 20.2% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 62.0% | 62.6% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 53.8% | 54.7% | pass → **inconclusive** |
| vs field (≤ 55%) | mixed-starter-sagelet | 53.7% | 54.7% | pass → **inconclusive** |
| vs field (≤ 55%) | mixed-starter-blitzr | 49.1% | 50.2% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 62.7% | 60.5% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 34.3% | 33.0% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 18.9% | 22.2% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 15.6% | 18.9% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.9% | 3.4% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 19.3% | 19.3% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 26.1% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.4% | 0.4% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs search-anti-hallu-embeddingo | 0.2% | 0.2% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs search-anti-hallu-embeddingo | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 19.0% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 10.4% | 10.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.2% | 0.0% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.4% | 0.4% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs speed-rush-graft | 4.0% | 4.0% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 1.8% | 1.8% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 8.4% | 8.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs speed-rush-blitzr | 14.9% | 15.9% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 9.7% | 8.8% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 1.0% | 0.7% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 55.5% | 55.7% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.1% | 51.1% | inconclusive |

Vs-field rows failing 6 → 7; summed excess over 55% 76.7 → 72.4 pp.

- **Decision:** rejected and reverted. open-swarm-forkling falls 61.6 → 57.7 and the excess 76.7 → 72.4, but code-lock-spaghettopus goes inconclusive → fail (54.5 → 55.1). Scrapion (53.8 → 54.7) and mixed-starter-sagelet (53.7 → 54.7) become inconclusive. Each nerf to a top team lifts the mid teams that the top team beat. Four mid teams (spaghettopus, scrapion, mixed-sagelet, agentoad) sit at 53–54.5%, so a top-team nerf that lowers the excess usually tips one of them over.

### Re-prioritisation (coordinator, after an environment restart)

The agentoad candidate's full run was killed by an environment restart. The coordinator then time-boxed D4 to at most four more kept changes or about three hours of runs. They also re-prioritised it toward "playable and not broken": first no matchup at or near 100% (the starter triangle, then the dominant archetypes), then fight length staying at a median of 5–8. From here, candidates are judged first on the worst-matchup target (its rows' total shortfall below 30%) and on the blowout counts from a 200-seed round-robin, still under the rule that no target may leave its band. The agentoad candidate only made room for a dial change, which is not in those priorities, so it was not re-run. The 200-seed round-robin at K3 lists the remaining blowouts: 16 pairings at or beyond 99/1. Every one is a Search team (Embeddingo, Scrapion) or a Reasoning nuke (Sagelet, Hallucinat) against a Code-lock, Memory or Open team, or Slopling or mixed-starter-forkling against code-lock-nullbeetle.

### Candidates not screened

Three candidates from first-balance-pass.md §d were never screened in D4:

- **Drift accuracy penalty 8 → 10–12 per stack** (§d move 7). It acts on whether a Compact card survives the deck search, a weak signal about deck shape, and on no target row (first-balance-pass.md:387 lists its verification as re-running the four searches). The targets table cannot show whether it helps, so the keep rule has nothing to judge it by.
- **Nostalgia Trip power 50 → ~65** (§d move 2, the alternative to Deprecatter's stats). Not screened: K4 took the stats half of move 2, and the time-box ended after K4. Its effect on the Memory teams is therefore untested; it remains an available Memory lever.
- **Distilled Strike cost 1 → 2** (§d move 6, the cost half). Not screened. Its power half was (c15, 75 → 65): it lowered Blitzr but raised reasoning-nuke-sagelet by 1.6 pp, because Blitzr is Sagelet's main check, so it was rejected. The cost change also weakens Blitzr and was expected to push the same way; that is an inference, not a measurement.

### Blowout candidates on the K3 state (scale 0.1 targets against `scratch-d4-s01-k3`; 200-seed round-robin against `scratch-d4-rr-k3`: 16 at or beyond 99/1, 30 at or beyond 95/5, 51 at or beyond 90/10, 81 at or beyond 80/20)

A first pass of these three ran with a quoting slip that applied no change. All three reproduced the K3 reference exactly (a determinism check on the committed state) and are not counted.

| id | change | why this number | vs-field excess | worst-matchup shortfall | blowouts 99/1 · 95/5 · 90/10 · 80/20 | left band | decision |
|---|---|---|---|---|---|---|---|
| b1 | Retrieval Strike 70 → 60 | the Search teams' cost-1 attack against Code and Memory | 76.8 → 78.1 | 455.5 → 454.5 | 16 · 32 · 52 · 82 | none | rejected: no fewer blowouts, vs field away |
| b2 | Deprecatter Robustness 45 → 60 | see K4 | 76.8 → 74.7 | 455.5 → 458.0 | 15 · 26 · 48 · 81 | none | **kept as K4** |
| b3 | Scrape 60 → 50 | Scrapion's signature | 76.8 → 75.2 | 455.5 → 453.0 | 16 · 33 · 50 · 81 | none | rejected: blowouts at 95/5 up |

(Worst-matchup shortfall is Σ max(0, 30 − point) over the 20 worst-matchup rows. At this scale each row is 200 battles, so ±3 pp on the sum is noise.)

### K4: Deprecatter Robustness 45 → 60 (kept)

- **Change:** `content/species.ts`, Deprecatter base Robustness 45 → 60 (L8 stat 12 → 14).
- **Why 60:** first-balance-pass §d move 2. Deprecatter is the slice's weakest species (base total 180; the others are 210–275) and the only Memory species, Memory being the type that hits Reasoning 1.5×. It sits in both Memory teams, which lose 99/1 to the Search teams, and in mixed-heisenmoth-tempo. 60 is level with Forkling's Robustness and brings the total to 195, still the slice's lowest, so "nostalgic, weak" holds. Robustness rather than Compute, because a higher Compute makes a creature the `highestAtkFoe` that foes' cards aim at (c1, c6). Species base stats have no bible numbers (the ModelDex rows give type, line and gag), so the bible needs no change.
- **Full scale** (`scratch-d4-k4c`, 455.6 s), before = K3:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 67.8% | 67.6% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 53.2% | 53.1% | pass |
| vs field (≤ 55%) | speed-rush-graft | 49.2% | 48.1% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 80.6% | 80.4% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 72.0% | 71.6% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 61.6% | 61.0% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 51.4% | 50.8% | pass |
| vs field (≤ 55%) | code-lock-spaghettopus | 54.5% | 54.4% | inconclusive → **pass** |
| vs field (≤ 55%) | code-lock-nullbeetle | 17.3% | 16.8% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 32.5% | 31.9% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 40.5% | 39.8% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 40.6% | 40.1% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 43.6% | 47.0% | pass |
| vs field (≤ 55%) | memory-stall-retro | 19.7% | 22.3% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 62.0% | 62.0% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 53.8% | 53.3% | pass |
| vs field (≤ 55%) | mixed-starter-sagelet | 53.7% | 53.5% | pass |
| vs field (≤ 55%) | mixed-starter-blitzr | 49.1% | 48.6% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 62.7% | 62.1% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 34.3% | 35.6% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 18.9% | 18.9% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 15.6% | 15.7% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.9% | 1.9% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 19.3% | 19.3% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 26.1% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.4% | 0.4% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs search-anti-hallu-embeddingo | 0.2% | 0.2% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs search-anti-hallu-embeddingo | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 19.0% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 10.4% | 10.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.2% | 0.5% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.4% | 0.6% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs speed-rush-graft | 4.0% | 4.0% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 1.8% | 1.8% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 8.4% | 8.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs mixed-starter-forkling | 14.9% | 14.9% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 9.7% | 9.7% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 1.0% | 1.1% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 55.5% | 55.7% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.1% | 50.8% | inconclusive → **pass** |

Vs-field rows failing 6 → 6; summed excess over 55% 76.7 → 74.7 pp.

- **Decision:** kept. Blowouts fall (200-seed round-robin: pairings at or beyond 95/5 30 → 26, at or beyond 99/1 16 → 15, at or beyond 90/10 51 → 48). memory-stall-deprecatter rises 43.6 → 47.0 and memory-stall-retro 19.7 → 22.3. Its effect on the targets is small: vs-field excess 76.7 → 74.7 pp (−2.0; every failing row falls 0.2–0.6), and the dial moved 0.2 pp the wrong way. Its clear wins are the Memory teams (memory-stall-deprecatter and memory-stall-retro) and first mover, not the targets. code-lock-spaghettopus goes inconclusive → pass (54.4) and first mover inconclusive → pass (50.8). No row left its band. The dial is 55.7% (from 55.5%, still a fail). The worst-matchup rows are unchanged within noise: each archetype's single worst pairing is still a type blowout.

### Blowout candidates on the K4 state (scale 0.1 targets and 200-seed round-robin against the K4 state, which is screen b2: excess 74.7; blowouts 15 · 26 · 48 · 81)

| id | change | why this number | vs-field excess | blowouts 99/1 · 95/5 · 90/10 · 80/20 | left band | decision |
|---|---|---|---|---|---|---|
| b4 | Embeddingo Robustness 55 → 45 | Embeddingo is in every Search and nuke team that wins the blowouts | 74.7 → 75.3 | 15 · 27 · 49 · 81 | none | rejected: no effect |
| b5 | Nullbeetle Robustness 55 → 65 | code-lock-nullbeetle is the most blown-out team (7 pairings at or beyond 95/5) | 74.7 → 77.2 | 16 · 28 · 47 · 81 | code-lock-spaghettopus 54.4 → 56.9, search-anti-hallu-scrapion 53.8 → 57.1 | rejected: Nullbeetle is also a subagent in both gatekeeper teams |
| b6 | Deprecatter HP 50 → 60 | a second step for the Memory teams | 74.7 → 74.9 | 15 · 27 · 47 · 81 | none | rejected: no effect |

### Stop (blocked)

D4 stops at four kept changes, inside both the eight-change cap and the coordinator's time-box (at most four more after the restart, about three hours of runs; about 75 minutes were used). Every target is not yet passing or inconclusive, so this stop is "blocked", not "done":

- **Vs field and blowouts.** The six failing archetypes (reasoning-nuke-sagelet, reasoning-nuke-hallucinat, speed-rush-blitzr, open-swarm-forkling, search-anti-hallu-embeddingo, mixed-starter-forkling) mostly lose to one another. A nerf to one lifts the others and the four mid teams at 53–55% (spaghettopus, scrapion, mixed-sagelet, agentoad), so most single numbers that lower the excess tip a mid team over 55%. The remaining blowouts (15 pairings at or beyond 99/1) are Reasoning and Search hitting mono-Code and Memory teams at 1.5× and taking ⅔ back. No species or move number screened in D4 flips them. Moving them needs a softer chart (settled in D2), coverage moves (out of scope) or less Code-heavy archetypes (settled in D3).
- **Starter triangle.** Blocked for single starter numbers (the cycle argument above).
- **Temperature dial.** 55.7%, 0.7 pp out. Deferred, not blocked: every single T4 buff that reaches the band lifts the T4-native speed-rush-agentoad over 55%, but the two-step path (Agentoad HP 65 → 55, then T4 self-hallucination 12% → 9%) probed at about 54.6% (inconclusive) with agentoad at 53.8%. It was not confirmed or committed.
- **Off-By-Wasp graft.** Blocked by its targeting, not its value.
- **Worst matchup.** Each archetype's worst pairing is a type blowout and did not move.

### D4 summary: verdicts before and after (engine 0.4.0 at 9af6141 → 0.4.1 at 0483c65)

Kept changes (each confirmed at full scale and committed with its log entry): K1 T4 accuracy −15 → −10 (3a4d316); K2 Cosine Sniff 70 → 55 (43fdffa); K3 Swarm of Fine-Tunes 20 → 15 per hit (6d833d4); K4 Deprecatter Robustness 45 → 60 (7e23211). Version bump and goldens: 0483c65.

Final report: `pnpm sim targets` at full scale on 0483c65 (clean), engine 0.4.1, fingerprint a7b116a0136a651b, 478.6 s (`reports/targets-2026-11-10.md`, overwriting the D3 report of the same date). It reproduces the K4 confirmation run row for row. Before is the baseline run on 9af6141.

| target | band | before (0.4.0) | after (0.4.1) | verdict |
|---|---|---|---|---|
| Any archetype vs the field | ≤ 55% | 12 pass, 8 fail; excess 87.9 pp | 14 pass, 6 fail; excess 74.7 pp | fail → fail |
| Worst single matchup | ≥ 30% | 0 pass, 20 fail | 0 pass, 20 fail | fail → fail |
| Starter triangle | 55–65% | 99.3 / 91.2 / 100.0 | 99.3 / 91.2 / 100.0 | fail → fail (blocked) |
| Temperature dial | 45–55% | 57.8% | 55.7% | fail → fail |
| Graft worth taking | ≥ 55% | 71.5 / 81.7 / 23.3 | 71.5 / 81.7 / 23.3 | fail → fail (wasp blocked) |
| Fight length | median 5–8 | 7 | 7 | pass → pass |
| First mover | 48–52% | 51.1% inconclusive | 50.8% pass | inconclusive → pass |

Every row:

| target | row | before | after | verdict |
|---|---|---|---|---|
| vs field (≤ 55%) | speed-rush-blitzr | 66.3% | 67.6% | fail |
| vs field (≤ 55%) | speed-rush-agentoad | 47.6% | 53.1% | pass |
| vs field (≤ 55%) | speed-rush-graft | 49.4% | 48.1% | pass |
| vs field (≤ 55%) | reasoning-nuke-sagelet | 83.5% | 80.4% | fail |
| vs field (≤ 55%) | reasoning-nuke-hallucinat | 71.3% | 71.6% | fail |
| vs field (≤ 55%) | open-swarm-forkling | 70.2% | 61.0% | fail |
| vs field (≤ 55%) | open-swarm-slopling | 57.1% | 50.8% | fail → **pass** |
| vs field (≤ 55%) | code-lock-spaghettopus | 53.4% | 54.4% | pass |
| vs field (≤ 55%) | code-lock-nullbeetle | 17.5% | 16.8% | pass |
| vs field (≤ 55%) | code-lock-cobolt | 31.1% | 31.9% | pass |
| vs field (≤ 55%) | voice-pressure-parrot | 36.6% | 39.8% | pass |
| vs field (≤ 55%) | voice-pressure-vibrat | 36.4% | 40.1% | pass |
| vs field (≤ 55%) | memory-stall-deprecatter | 42.9% | 47.0% | pass |
| vs field (≤ 55%) | memory-stall-retro | 19.7% | 22.3% | pass |
| vs field (≤ 55%) | search-anti-hallu-embeddingo | 61.2% | 62.0% | fail |
| vs field (≤ 55%) | search-anti-hallu-scrapion | 54.5% | 53.3% | pass |
| vs field (≤ 55%) | mixed-starter-sagelet | 55.6% | 53.5% | fail → **pass** |
| vs field (≤ 55%) | mixed-starter-blitzr | 48.7% | 48.6% | pass |
| vs field (≤ 55%) | mixed-starter-forkling | 62.9% | 62.1% | fail |
| vs field (≤ 55%) | mixed-heisenmoth-tempo | 34.4% | 35.6% | pass |
| worst matchup (≥ 30%) | speed-rush-blitzr vs open-swarm-forkling | 13.7% | 18.9% | fail |
| worst matchup (≥ 30%) | speed-rush-agentoad vs memory-stall-deprecatter | 13.4% | 15.7% | fail |
| worst matchup (≥ 30%) | speed-rush-graft vs open-swarm-forkling | 1.1% | 1.9% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-sagelet vs speed-rush-blitzr | 21.3% | 19.3% | fail |
| worst matchup (≥ 30%) | reasoning-nuke-hallucinat vs speed-rush-blitzr | 27.3% | 26.1% | fail |
| worst matchup (≥ 30%) | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | open-swarm-slopling vs reasoning-nuke-sagelet | 0.9% | 0.4% | fail |
| worst matchup (≥ 30%) | code-lock-spaghettopus vs search-anti-hallu-embeddingo | 0.1% | 0.2% | fail |
| worst matchup (≥ 30%) | code-lock-nullbeetle vs reasoning-nuke-sagelet | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | code-lock-cobolt vs search-anti-hallu-embeddingo | 0.0% | 0.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-parrot vs code-lock-spaghettopus | 16.9% | 19.0% | fail |
| worst matchup (≥ 30%) | voice-pressure-vibrat vs reasoning-nuke-sagelet | 5.9% | 10.4% | fail |
| worst matchup (≥ 30%) | memory-stall-deprecatter vs search-anti-hallu-embeddingo | 0.1% | 0.5% | fail |
| worst matchup (≥ 30%) | memory-stall-retro vs search-anti-hallu-embeddingo | 0.3% | 0.6% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-embeddingo vs speed-rush-graft | 4.2% | 4.0% | fail |
| worst matchup (≥ 30%) | search-anti-hallu-scrapion vs search-anti-hallu-embeddingo | 7.7% | 1.8% | fail |
| worst matchup (≥ 30%) | mixed-starter-sagelet vs speed-rush-graft | 10.4% | 8.4% | fail |
| worst matchup (≥ 30%) | mixed-starter-blitzr vs mixed-starter-forkling | 14.7% | 14.9% | fail |
| worst matchup (≥ 30%) | mixed-starter-forkling vs reasoning-nuke-sagelet | 7.8% | 9.7% | fail |
| worst matchup (≥ 30%) | mixed-heisenmoth-tempo vs reasoning-nuke-sagelet | 0.4% | 1.1% | fail |
| starter triangle (55–65%) | blitzr (favoured) vs sagelet | 99.3% | 99.3% | fail |
| starter triangle (55–65%) | sagelet (favoured) vs forkling | 91.2% | 91.2% | fail |
| starter triangle (55–65%) | forkling (favoured) vs blitzr | 100.0% | 100.0% | fail |
| temperature dial (45–55%) | T0 vs T4 mirror, pooled | 57.8% | 55.7% | fail |
| graft worth taking (≥ 55%) | stochastiparrot | 71.5% | 71.5% | pass |
| graft worth taking (≥ 55%) | nullbeetle | 81.7% | 81.7% | pass |
| graft worth taking (≥ 55%) | off-by-wasp | 23.3% | 23.3% | fail |
| fight length (median 5–8) | median rounds | 7 | 7 | pass |
| first mover (48–52%) | side A vs mirror, pooled | 51.1% | 50.8% | inconclusive → **pass** |

Vs-field rows failing 8 → 6; summed excess over 55% 87.9 → 74.7 pp.

### Blowouts and fight length

| measurement | before | after |
|---|---|---|
| 200-seed round-robin, unordered pairings at or beyond 99/1 · 95/5 · 90/10 · 80/20 | 19 · 34 · 57 · 91 (`scratch-d4-rr-base`) | 15 · 26 · 48 · 81 (K4 state, screen b2) |
| pairings within 40–60 (same runs) | 39 | 45 |
| `pnpm sim round-robin --seeds 1000` at 0.4.1 (`reports/round-robin-2026-11-10.md`) | n/a: the committed report was D2's, before the D3 decks; its counts were 23 · 41 · 63 · 93 | 14 · 30 · 48 · 79; 43 within 40–60 |
| median fight length (round-robin) | 7 (p25 6, p75 9) | 7 (p25 6, p75 9, min 2, max 50) |
| round-cap hits, 380,000 battles | 129 at D2 (pre-D3 decks; not like-for-like) | 210 (0.06%) |

The 1,000-seed round-robin (labels `round-robin:…`) is the held-out replicate of the `targets:` seeds: it uses different seeds for the same archetypes, and its per-archetype scores agree with the targets table within about 1 pp (reasoning-nuke-sagelet 80.6% against 80.4%, speed-rush-blitzr 67.9% against 67.6%, search-anti-hallu-embeddingo 62.3% against 62.0%).

Still at or beyond 99/1 at 0.4.1: the Search teams and the Reasoning nukes against the mono-Code and Memory teams (for example reasoning-nuke-sagelet against open-swarm-forkling and code-lock-nullbeetle, and search-anti-hallu-embeddingo against memory-stall-retro and code-lock-cobolt).

### Timing (criterion 7) and gates

| measurement | D3 | D4 final |
|---|---|---|
| `time pnpm sim round-robin --seeds 1000` | 461.2 s (D2 report) | 422.1 s (report), 7 min 3 s by `time` |
| round-robin inside `pnpm sim targets` | 572.9 s | 442.7 s |
| `pnpm sim targets` wall time | 622.7 s | 478.6 s |
| bench deck-driven / player-commanded (gate 1.2 ms) | 0.883 / 0.552 ms (D2) | 0.797–1.001 / 0.465–0.515 ms over three runs |

Criterion 7 holds: 422 s against the 600 s limit. This machine's run-to-run variance is large; the bench ranged 0.80–1.00 ms in three consecutive runs. Gates on 0483c65: lint, typecheck and `pnpm test` (engine 1,282 and sim 206 tests) pass, and the `FUZZ_N=10000` fuzz test passes. The criterion-5 broken-deck scenario passed unchanged, so it needed no re-tune, and the headline fire-rate floors all hold.

### Goldens

Re-recorded once, at the 0.4.1 bump. With the four old values put back and the engine at 0.4.0, all 49 golden tests passed against the 0.4.0 goldens, so the four content values are the only cause. 17 of 37 expectedHash values changed (listed in 0483c65's message). The other 20 changed only their `engineVersion` field, because the hash excludes the version.

### Still open (for D5 and Travis)

- **Starter triangle (99.3 / 91.2 / 100.0).** Needs coverage moves or a ruling: single starter numbers redistribute the cycle without lowering it.
- **Vs field.** Six failing rows: reasoning-nuke-sagelet 80.4%, reasoning-nuke-hallucinat 71.6%, speed-rush-blitzr 67.6%, search-anti-hallu-embeddingo 62.0%, mixed-starter-forkling 62.1%, open-swarm-forkling 61.0%. The six mostly beat each other's victims, and the mid teams sit at 53–54.4%. The remaining gap is the Code-heavy field meeting the chart.
- **Temperature dial (55.7%).** Each T4 buff that would reach the band lifts the T4-native speed-rush-agentoad over 55%. Deferred: the two-step path (Agentoad HP 65 → 55, which passes the keep rule on its own as c28, then T4 self-hallucination 12% → 9%) was probed at full dial scale at about 54.6% (inconclusive) with agentoad at 53.8%, but not confirmed or committed.
- **Off-By-Wasp graft (23.3%).** Its targeting meets the template's `lowestHpFoe` aim; this is a template or ruling question, not a content value.
- **Embeddingo card.** Its `compact-speed-type` card (D3 note) was left alone: it is an archetype deck card, and D3 settled the decks.
