# First balance pass (Task C5)

Date 2026-11-08 · engine `@latentia/engine` 0.3.0 · branch `phase-c-simulator` at fe061c2 · nothing retuned.

This note reads the first full-scale runs of `@latentia/sim` against the bible's balance targets. It ranks what the
data says and names the first tunables to move. It changes no content, archetype or target setup.

Sources (all committed under `reports/` unless marked scratch):

- `round-robin-2026-11-08.{md,csv}`: `pnpm sim round-robin --seeds 1000`, 380,000 battles.
- `targets-2026-11-08.{md,csv}`: `pnpm sim targets` at scale 1, 404,000 battles. Its round-robin uses its own seed
  label, so it is an independent replication of the one above. The two agree on every archetype's vs-field score
  within 0.7 pp (mean 0.3 pp), which is sampling noise at n = 38,000.
- `search-2026-11-08-<archetype>.{md,csv}`: four `pnpm sim search --budget 20000` runs.
- `pnpm --filter @latentia/sim triangle-solo` (`packages/sim/scripts/triangle-solo.ts`): the partnerless triangle
  diagnostic (Ruling 136).
- `pnpm --filter @latentia/sim smoke --seeds 50`: 20,000 battles, for structural correlations.
- **Scratch** (not committed, in-memory variants, no repo edits): Hallucinating frequency and anti-hallucination card
  fires (38,000 battles), T0-vs-T4 on every archetype (10,000), and a graft/spin-up breakdown (18,000). Quoted
  below as "scratch".

A draw counts 0.5 throughout. Intervals are 95% Wilson. There were 0 draws in all 380,000 round-robin battles;
135 hit the round cap and went to the HP-ratio tiebreak.

## (a) Verdicts

### Summary

| target | band | deciding row | point | 95% interval | rows pass / inc / fail | verdict |
|---|---|---|---|---|---|---|
| Any archetype vs the field | ≤ 55% | reasoning-nuke-sagelet | 83.9% | [83.5%, 84.3%] | 10 / 2 / 8 | **fail** |
| Worst single matchup | ≥ 30% | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | [0.0%, 0.2%] | 0 / 0 / 21 | **fail** |
| Starter triangle | 55–65% favoured | sagelet vs forkling | 0.1% | [0.0%, 0.3%] | 0 / 0 / 3 | **fail** |
| Temperature dial | 45–55% | mixed-starter-sagelet T0 vs T4 | 49.8% | [47.6%, 51.9%] | 1 / 0 / 0 | **pass** |
| Graft vs spin-up | 45–55% | stochastiparrot / off-by-wasp | 0.1% | [0.1%, 0.4%] | 0 / 0 / 3 | **fail** |
| Fight length | median 5–8 rounds | all round-robin battles | 7 | point only | 1 / 0 / 0 | **pass** |
| First mover | 48–52% | side A vs mirror, 20 archetypes pooled | 50.6% | [49.6%, 51.6%] | 1 / 0 / 0 | **pass** |

**3 pass, 4 fail, 0 inconclusive** at target level. All 50 rows have a verdict.

### Rows outside the round-robin

| target | subject | battles | point | 95% interval | verdict |
|---|---|---|---|---|---|
| Starter triangle | blitzr (favoured) vs sagelet | 2000 | 99.9% | [99.6%, 99.9%] | fail |
| Starter triangle | sagelet (favoured) vs forkling | 2000 | 0.1% | [0.0%, 0.3%] | fail |
| Starter triangle | forkling (favoured) vs blitzr | 2000 | 100.0% | [99.8%, 100.0%] | fail |
| Temperature dial | mixed-starter-sagelet: T0 side vs T4 mirror | 2000 | 49.8% | [47.6%, 51.9%] | pass |
| Graft vs spin-up | stochastiparrot: G vs S | 2000 | 0.1% | [0.1%, 0.4%] | fail |
| Graft vs spin-up | nullbeetle: G vs S | 2000 | 0.4% | [0.2%, 0.8%] | fail |
| Graft vs spin-up | off-by-wasp: G vs S | 2000 | 0.1% | [0.1%, 0.4%] | fail |
| Fight length | median rounds (p25 6, p75 9) | 380000 | 7 | point only | pass |
| First mover | side A vs its mirror, every archetype pooled | 10000 | 50.6% | [49.6%, 51.6%] | pass |

### Partnerless triangle diagnostic (not a target row)

Each starter fights alone: the same role-based Autopilot deck, the same L8 standard grid with its Subagent Slot left
unbound (so headroom is unchanged), 1,000 battles per side assignment, pooled. The official rows are re-run on the
targets command's own seed labels and reproduce the targets report exactly.

| setup | matchup | battles | point | 95% interval | median rounds |
|---|---|---|---|---|---|
| official (+ Tokenibble) | blitzr vs sagelet | 2000 | 99.9% | [99.6%, 99.9%] | 4 |
| **solo** | blitzr vs sagelet | 2000 | 100.0% | [99.8%, 100.0%] | 3 |
| official (+ Tokenibble) | sagelet vs forkling | 2000 | 0.1% | [0.0%, 0.3%] | 3 |
| **solo** | sagelet vs forkling | 2000 | 100.0% | [99.8%, 100.0%] | 5 |
| official (+ Tokenibble) | forkling vs blitzr | 2000 | 100.0% | [99.8%, 100.0%] | 3 |
| **solo** | forkling vs blitzr | 2000 | 100.0% | [99.8%, 100.0%] | 2 |

### Round-robin rows: vs the field (≤ 55%) and each archetype's worst matchup (≥ 30%)

| archetype | vs field | interval | verdict | worst pairing | score there | interval | verdict |
|---|---|---|---|---|---|---|---|
| reasoning-nuke-sagelet | 83.9% | [83.5, 84.3] | fail | speed-rush-blitzr | 14.5% | [13.0, 16.1] | fail |
| reasoning-nuke-hallucinat | 75.6% | [75.1, 76.0] | fail | mixed-starter-sagelet | 15.7% | [14.1, 17.3] | fail |
| speed-rush-blitzr | 66.9% | [66.4, 67.4] | fail | open-swarm-forkling | 14.9% | [13.5, 16.6] | fail |
| mixed-starter-forkling | 66.9% | [66.4, 67.4] | fail | reasoning-nuke-sagelet | 6.7% | [5.7, 7.9] | fail |
| mixed-starter-sagelet | 63.0% | [62.5, 63.4] | fail | speed-rush-graft | 5.9% | [5.0, 7.1] | fail |
| open-swarm-slopling | 59.2% | [58.7, 59.7] | fail | reasoning-nuke-sagelet | 0.9% | [0.6, 1.5] | fail |
| search-anti-hallu-embeddingo | 58.8% | [58.3, 59.3] | fail | mixed-starter-sagelet | 1.7% | [1.2, 2.3] | fail |
| open-swarm-forkling | 57.3% | [56.8, 57.8] | fail | reasoning-nuke-sagelet | 0.0% | [0.0, 0.2] | fail |
| search-anti-hallu-scrapion | 54.9% | [54.4, 55.4] | inconclusive | reasoning-nuke-sagelet | 1.3% | [0.9, 1.9] | fail |
| mixed-starter-blitzr | 54.5% | [54.0, 55.0] | inconclusive | speed-rush-blitzr | 17.3% | [15.8, 19.1] | fail |
| speed-rush-agentoad | 48.4% | [47.9, 48.9] | pass | memory-stall-deprecatter | 6.3% | [5.3, 7.4] | fail |
| code-lock-spaghettopus | 47.8% | [47.3, 48.3] | pass | reasoning-nuke-sagelet | 0.0% | [0.0, 0.2] | fail |
| memory-stall-deprecatter | 47.1% | [46.6, 47.6] | pass | search-anti-hallu-scrapion | 0.0% | [0.0, 0.2] | fail |
| speed-rush-graft | 46.8% | [46.3, 47.3] | pass | open-swarm-forkling | 0.7% | [0.4, 1.1] | fail |
| voice-pressure-vibrat | 43.4% | [42.9, 43.8] | pass | reasoning-nuke-sagelet | 8.2% | [7.1, 9.5] | fail |
| code-lock-cobolt | 37.7% | [37.2, 38.2] | pass | reasoning-nuke-sagelet | 0.0% | [0.0, 0.2] | fail |
| voice-pressure-parrot | 29.6% | [29.2, 30.1] | pass | reasoning-nuke-sagelet | 2.9% | [2.3, 3.7] | fail |
| mixed-heisenmoth-tempo | 26.7% | [26.3, 27.2] | pass | reasoning-nuke-sagelet | 0.1% | [0.1, 0.4] | fail |
| memory-stall-retro | 20.7% | [20.3, 21.1] | pass | reasoning-nuke-sagelet | 0.3% | [0.1, 0.6] | fail |
| code-lock-nullbeetle | 10.9% | [10.6, 11.2] | pass | reasoning-nuke-sagelet | 0.0% | [0.0, 0.2] | fail |
| **overall** | | | | open-swarm-forkling vs reasoning-nuke-sagelet | 0.0% | [0.0, 0.2] | fail |

The vs-field band is one-sided, as §9 defines it. code-lock-nullbeetle at 10.9% "passes" it, so the 10 passes include
four archetypes under 30%. The worst-matchup target is the one that catches the weak end.

## (b) Criteria 6 and 7

- **Criterion 7 (performance): PASS.** The official `time pnpm sim round-robin --seeds 1000` took **7m20.1s real**
  (7m23.8s user). The report's own wall time is 438.9 s. That is 380,000 battles in one process at 1.16 ms per
  battle, with 26.6% headroom under the 10-minute bar. It matches the reviewer's C3.5 measurement (7m27.7s).
- **Criterion 6 (balance harness): PASS.** The full-scale `time pnpm sim targets` took **7m50.7s real** (report wall
  time 469.8 s, 404,000 battles). It measures every §9 target with its own setup and writes a pass, fail or
  inconclusive verdict on all 50 rows and all 7 targets. Per measurement: round-robin 446.9 s, first mover 14.4 s,
  graft 3.1 s, triangle 2.8 s, temperature 2.5 s. Criterion 6 asks for the tool and the first report, not for
  passing targets; hitting the targets is the tuning work below.
- The four searches took 23.9 s, 27.1 s, 29.2 s and 30.2 s real (19,456 budgeted battles plus 1,216 held-out
  each).

## (c) Findings, ranked by impact

### 1. Type matchup decides most games, and the field is Code-heavy (confirmed, count corrected)

- **Correction:** **8 of the 17 slice species carry Code**, not 7. Six are mono-Code (Nullbeetle, Off-By-Wasp,
  Heisenmoth, Cobolt, Vibrat, Spaghettopus) and two are duals (Scrapion Search/Code, Agentoad Code/Speed). In the 20
  archetypes, 38 of 80 creatures are Code-typed. The others are Speed 13, Open 11, Vision 10, Reasoning 9, Search 7,
  Voice 5 and Memory 3 (duals count twice). Memory, the type that hits Reasoning 2×, has one species (Deprecatter).
- Correlation with win rate vs the field (smoke, 50 seeds, n = 20 archetypes; |r| > 0.44 is significant):
  - offense vs field (mean type multiplier of the team's attacks on the field) +0.65;
  - Reasoning-type members +0.49 and Code-type members −0.47;
  - defense vs field −0.46;
  - total base stats +0.47.

  Temperature (−0.00), grid headroom (−0.13) and active-card count (+0.07) do not matter.
- Reasoning hits Code and Open 2×, and Vision hits Speed and Open 2×. That makes the two Reasoning nukes, Sagelet
  plus Hallucinat (Reasoning/Vision), the top two archetypes (83.9% and 75.6%). Code-heavy teams fill the bottom.
- The bible's chart is regular, so the chart is not "wrong". The imbalance comes from a Code-heavy field meeting a
  2×/½ chart that is sharp enough to decide a fight on its own (finding 3).

### 2. Worst-matchup blowouts are the norm (confirmed)

- All 21 worst-matchup rows fail. Of the 190 unordered pairings (2,000 battles each):
  - 130 are worse than 70/30;
  - 99 are worse than 80/20;
  - 70 are worse than 90/10;
  - 58 are worse than 95/5.

  Only 32 fall within 40–60.
- **reasoning-nuke-sagelet is the worst pairing for 11 of the 20 archetypes**, and the overall worst is 0.0%.
  Every Code-lock team scores 0.0% against it.
- Side assignment barely matters inside a pairing (mean |score as A − score as B| = 1.2 pp, max 6.3 pp). Side A
  scores 50.07% over all 380,000 battles.

### 3. The starter triangle is extreme, and the partner inverts one edge (confirmed; two separate problems)

- **Officially:** Blitzr > Sagelet 99.9%, Sagelet > Forkling **0.1%**, Forkling > Blitzr 100.0%.
- **Solo:** 100.0% / 100.0% / 100.0%.
- **Type strength alone is total.** With no partner, the favoured starter scores 100.0% (to one decimal) on all three
  edges, 6,000 battles in total, with median fights of 2–5 rounds. Each starter's damaging moves are all its own type: Sagelet is all Reasoning, Blitzr all Speed and
  Forkling all Open. Against a 2× / ½ chart that is a 4× damage ratio with no coverage, plus 1.25× same-type bonus
  on both sides. The bible's "~60/40, so skill can flip it" is far away.
- **The Tokenibble partner confound is real and decisive on one edge** (Ruling 136). Adding the Speed-type intern to
  both sides flips Sagelet > Forkling from 100.0% to 0.1%. The C3 trace showed why:
  - Forkling's intern hits Sagelet 2×.
  - Sagelet's intern is resisted by Forkling.
  - Forkling's decoy shield eats Sagelet's opener.
  - Sagelet spends turn 1 on Step-Back Prompt and its strongest move costs 3 cells.

  On the other two edges the partner changes nothing, because the favoured side already wins.

### 4. Spin-up strictly beats graft at L8 (confirmed, with the cause isolated)

- G scores 0.1%, 0.4% and 0.1% against S. The scratch breakdown (2,000 battles each, both sides pooled):

  | species | G vs base team | S vs base team | G vs S **with the signature stripped from S** |
  |---|---|---|---|
  | stochastiparrot | 61.5% | 99.7% | 0.3% |
  | nullbeetle | 68.8% | 95.8% | 0.5% |
  | off-by-wasp | **29.5%** | 99.9% | 0.0% |

- **The extra body is the whole effect.** A second L8 subagent is worth +46 to +50 pp over the base team. A graft is
  worth −20 to +19 pp.
- **The spun-up subagent keeps its signature at full power.** That is unlike the bible's spin-up column ("3 moves
  and a passive; the signature becomes a weaker passive echo"). Validation accepts a subagent listing its own
  signature, and the sim's `subagent()` builder gives every subagent all 4 species moves. Stripping it changes
  nothing measurable (0.0–0.5%), so it is not the cause here. It is still a rules mismatch worth fixing (finding 4b
  in (d)).
- **The Off-By-Wasp graft is net negative.** G scores 29.5% against the base team without it.
  - The template's graft card (cooldown 1, placed above `power`) replaces Happy to Help with Off-By-One every other
    round.
  - Off-By-One (75 power, cost 1) aims at `foeOffByOne` by design, so it often hits a creature other than the one
    chosen.
  - It is Code, which the opposing Sagelet resists. Null Chomp is also Code yet helps (+18.8 pp), so the
    off-by-one targeting is the likelier cause.
- The bible's tuning assumption, that a subagent action is worth about 0.6 of a commanded action, never applies in
  these sims. Both sides are Autopilot, and no engine rule discounts a subagent's action, so the extra body acts at
  full value.

### 5. The weakest archetypes are partly weak decks (new)

- No dominant deck appears in the four searches. Each ran 32 evaluations at k = 16, i.e. 608 battles per
  evaluation, with a 1 pp acceptance margin. Held-out is fresh seeds, the same field, 608 battles.

  | archetype | search seed | base search → final search | base held-out → final held-out | held-out gain | dominant? |
  |---|---|---|---|---|---|
  | speed-rush-blitzr | c5…01 | 67.1% → 68.4% (1 step) | 70.4% → 71.1% | +0.7 pp | no (gain < 3 pp) |
  | code-lock-nullbeetle | c5…02 | 10.0% → 28.1% (4 steps) | 10.0% → 30.9% | **+20.9 pp** | no (< 55%) |
  | memory-stall-retro | c5…03 | 20.2% → 24.0% (1 step) | 21.9% → 22.4% | +0.5 pp | no |
  | mixed-heisenmoth-tempo | c5…04 | 27.8% → 38.5% (5 steps) | 24.2% → 35.2% | **+11.0 pp** | no (< 55%) |

  (Seeds are `c5000000000000000000000000000001` … `…04`.)
- **Speed-rush-blitzr's deck is near a local optimum.** The only accepted step re-gated its Compact card on
  Quantized, which no slice battle can apply, so in effect it deleted the card.
- **nullbeetle and tempo gain a lot from deck edits alone.**
  - nullbeetle replaced its top card (Unit Test every 3 rounds) and its Compact card with attacks.
  - tempo dropped Bounding Box and its Compact card, and moved its coin-flip Token Nibble up.

  The bottom of the vs-field table therefore measures under-built archetype decks as well as type and stats.
- **Weak but consistent signal: the "context ≥ 75% → Compact" card is a net loss.** All four searches removed or
  neutralised it. Each step was worth +1 to +4 pp on the search seeds, but the held-out gains for blitzr and retro
  are within noise (≤ 0.7 pp). In 7-round fights, spending an action on Compact (priority −2) is worth less than
  overflowing into Drift (−8 accuracy per stack).

### 6. Search's anti-hallucination cards rarely fire (confirmed, quantified)

- Only two of 17 slice species inflict Hallucinating:
  - Hallucinat, with Confident Citation (20%) and Adversarial Patch (30%);
  - Slopling, with Adversarial Patch.

  T3/T4 self-hallucination substitutes the move but never applies the status. Any Search hit cures it.
- Scratch, each search archetype against the other 19 with 50 seeds per ordered pairing (1,900 battles each):

  | archetype | battles with own side Hallucinating | with a foe Hallucinating | Ground Truth fires | Citation Needed on a Hallucinating foe fires |
  |---|---|---|---|---|
  | search-anti-hallu-embeddingo | 4.6% | 0.1% | 28 | **0** |
  | search-anti-hallu-scrapion | 8.3% | 6.7% | 48 | 12 |

- Field-wide, a side has a Hallucinating creature in 4–14% of battles.
- These archetypes win (58.8% and 54.9%) on Cosine Sniff, Search's 2× against Code, and Citation Needed on
  Reasoning-type foes. The "anti-hallucination" identity is not what they play. This is content, not tuning
  (question 2 in (e)).

### 7. The temperature dial passes officially, but cold is favoured across the field (corrected)

- **Correction to the C3 scaled run (58%, n = 100):** at full scale the official row is 49.8% [47.6, 51.9], a pass.
- The official setup, mixed-starter-sagelet, is one of the most temperature-neutral teams. Scratch, T0 vs T4 on all
  20 archetypes (500 battles each, both sides pooled): **T0 scores 54.5% [53.6, 55.5] on average**, at the band edge.
  - Three archetypes sit clearly outside the band: search-anti-hallu-embeddingo 67.9%, speed-rush-blitzr 64.6% and
    open-swarm-slopling 64.4%.
  - Only memory-stall-deprecatter leans hot (45.8%, interval to 50.2%). T4 is never clearly better.
- The likely cause is T4's −15 accuracy and 12% self-hallucination against "nearly flat" expected damage. The super-
  effective ×1.25 rider does not make up for them.

### 8. First mover is fair (corrected)

- **Correction to the scaled 47.2% (n = 500):** the full row is 50.6% [49.6, 51.6], a pass. Side A over the whole
  round-robin is 50.07%.

### 9. Fight length is in band (confirmed)

- The median is 7 rounds (p25 6, p75 9, min 2, max 50).
- Cap hits are 135 of 380,000 battles (0.04%). There are no draws.
- The target-setup fights are much shorter: 2–5 rounds in the triangle, about 3 in graft vs spin-up. That is part
  of why one extra action decides them.

## (d) First tuning moves

These are ranked cheapest-and-highest-leverage first. "Cost" is the size of the edit; "leverage" is which failing rows it
moves. Expected effects are directions and rough sizes inferred from the data above. None has been run; each names
the command that verifies it.

0. **Before any content change, re-baseline the archetype decks with `search`.** This is method, not a content
   tunable. Run `pnpm sim search --archetype <id> --budget 20000` for at least the bottom six, ideally all 20, and
   adopt the held-out-confirmed decks. Finding 5 shows decks alone move an archetype by up to +21 pp. Without this,
   species tuning would end up compensating for deck-building errors. Verify with `pnpm sim round-robin --seeds 1000`
   and the vs-field rows of `pnpm sim targets`.

1. **Type-chart magnitude: the 2× and ½ cells, 20000 / 5000 bp → 15000 / 6667 bp** (all 32 non-neutral cells, two
   constants).
   - Cost: tiny edit, but a bible-level change. The content test pins 20000/5000 per row and column; regularity is
     kept.
   - Leverage: highest. Type alone produces the solo triangle's 100% and drives offense vs field (r = +0.65).
   - Expected:
     - the solo triangle drops from 100% toward roughly 70–85%, with mono-type movesets still sharp;
     - the 130 pairings beyond 70/30 shrink;
     - the reasoning nukes fall and the Code teams rise.
   - Verify with `pnpm sim targets` (all rows) and `pnpm --filter @latentia/sim triangle-solo`. Needs Travis's
     sign-off because it changes the bible's stated multipliers.

2. **Deprecatter's base stats** (Compute 45 → ~60, Robustness 45 → ~55; total 180, the slice's lowest) **or Nostalgia
   Trip power 50 → ~65.**
   - Cost: one line.
   - Leverage: Memory is the only type that hits Reasoning 2×, and its one species is too weak to counter the
     archetype that is the worst pairing for 11 of 20.
   - Expected: memory-stall-retro (20.7%) and memory-stall-deprecatter rise, and reasoning-nuke-sagelet drops a few
     points against them.
   - Verify: `pnpm sim matchup memory-stall-retro reasoning-nuke-sagelet --seeds 1000` (now 0.3% pooled), then the
     targets vs-field rows.

3. **Hallucinat's base Compute 75 → ~65.**
   - Cost: one line.
   - Leverage: Hallucinat sits in the top two archetypes, and in mixed-starter-blitzr and both voice builds.
   - Expected: reasoning-nuke-sagelet and reasoning-nuke-hallucinat come down several points each. The two voice
     builds, already weak, lose a little.
   - Verify: `pnpm sim matchup reasoning-nuke-sagelet speed-rush-blitzr --seeds 1000` and the targets vs-field and
     worst-matchup rows. Do this after 1 or 2, so as not to over-nerf.

4. **Temperature table, T4 row: accuracy −15 → −10** (the alternative is self-hallucination 12% → 8%).
   - Cost: one number.
   - Leverage: the field-wide cold edge (T0 54.5% average; 64–68% for three archetypes). The official row already
     passes.
   - Expected: the field average moves toward 50–52%, and the three outliers come back toward the band.
   - Verify: the targets temperature-dial row, plus a per-archetype T0-vs-T4 sweep. The sweep is the ~15-line scratch
     loop behind finding 7; it is worth promoting into `targets` as extra rows.

5. **The graft rule and the spin-up rule** (graft vs spin-up, 0.1–0.4%).
   - 5a. Graft move power 100% → 130%. This is the bible's own "graft ≈ 1.3× a basic Skill"; today a graft is
     exactly its signature. Cost: one rule. Expected: small; it lifts G against the base team, but it cannot close
     a 46–50 pp body-count gap.
   - 5b. Make spin-up match the bible: no signature at full power, three moves plus a passive echo. That is a
     validation rule plus the sim's `subagent()` builder. Expected: about 0 on this target (scratch: 0.0–0.5%), but
     it removes a content mismatch before tuning.
   - 5c. The lever that can actually move the target is the spun-up subagent's entry level, for example distilled
     subagents enter below the orchestrator's level. That is a progression rule, and so a product call (question 6
     in (e)).
   - Verify all three with the targets graft-vs-spin-up rows.

6. **Distilled Strike (Blitzr's Skill): cost 1 → 2, or power 75 → 65.**
   - Cost: one number.
   - Leverage: speed-rush-blitzr is 66.9% and the worst pairing for two archetypes. Every Blitzr move costs 1 cell,
     while Sagelet's strongest costs 3.
   - Expected: speed-rush-blitzr moves toward 55–60%. This is an inference from the move data, not a measured
     effect.
   - Verify: `pnpm sim matchup speed-rush-blitzr open-swarm-forkling --seeds 1000` and the vs-field row.

7. **Drift's accuracy penalty: 8 → 10–12 per stack.**
   - Cost: one constant in the accuracy formula.
   - Leverage: low. This acts on the weak "Compact card is a loss" signal.
   - Expected: overflowing costs more, so Compact earns its action.
   - Verify: re-run the four searches on their seeds and see whether the Compact cards survive. The **headroom
     floor** (4) is not a lever at L8: grid headroom does not correlate with winning (r = −0.13). The bible's L1
     headroom question needs an L1 field, which this pass does not have.

**Not a tunable, for the controller: the official triangle row's partner.** The plan-mandated Tokenibble partner
measures "starter + Speed intern" rather than the starter triangle. Option A is to keep it, accepting that the
intern's type is part of the starter experience. Option B is to give the official row a type-neutral partner, or
none. Either way, the solo row should stay next to it.

## (e) Product questions for Travis

These are content decisions, not tuning.

1. **Learnsets or Skill Scrolls for the 18 unreachable launch moves.**
   - The moves: captcha-wall, deep-research, deepfake-call, deliberate, earnest-apology, embedding-cache,
     filibuster, fork, permissive-license, pixel-peep, red-team, refusal, saliency-map, screenshot,
     speculative-decoding, temperature-spike, throttle, tree-search.
   - No slice species can learn them (Ruling 112).
   - Without **Deepfake Call**, Prompt Injected cannot be reached in a legal battle (Rulings 113, 120). That is the
     bible's signature counter to shallow "always strongest attack" decks, and the reason voice-injection became
     "voice pressure".
   - The golden suite also lists Rate Limited, Deprecated and Quantized as unreachable in slice battles.
   - Which moves should the slice teach, and through learnsets or Scrolls?
2. **More Hallucinating sources.** Today only Hallucinat and Slopling inflict it, at 20–30% per hit, and any Search
   hit cures it. So the Search anti-hallucination archetype's defining cards fire in 0–3% of battles (finding 6).
   Options:
   - add a Hallucinating rider to more slice moves, such as a Vision or Voice move;
   - let T3/T4 self-hallucination also apply the status (a rules change);
   - or accept that Search's identity is "beats Code and Reasoning".

   Raising the existing chances alone would mostly buff Hallucinat and Slopling, which are already top-tier.
3. **The satire move candidates** (Make No Mistakes, Vibe Code, Slop Cannon and the rest). Evaluate them as a
   follow-up after this pass? They need new content and, for Ship It, Benchmaxx and Seed Round, new primitives
   (Ruling 122). The bible's satire section now says so.
4. **Specialist for ghost Autopilot decks.** It is subagent-only for Phase C (Ruling 123), so a ghost's orchestrator
   deck never earns the +15%. Should ghosts be able to?
5. **The subagent deck cap of 12.** It is flat for Phase C (Ruling 123). Archetype Autopilot decks follow the
   per-version sizes 6/8/10/12 (Ruling 121). Should subagent decks scale per version too?
6. **What "graft vs spin-up 45–55%" should compare.** At equal level the extra body wins about 99% of the time. Is a
   freshly spun-up subagent meant to enter at the orchestrator's level? Or should the target compare graft against
   a lower-level spin-up, or at equal grid cost? This decides whether 5a–5c above can ever pass the target.
7. **The field's type mix.** Eight of 17 slice species carry Code, because the first gym is Code (Ruling 131). Should
   one or two mono-Code species be re-typed, or should a second Memory or Search species join the slice? Or is the
   Code-heavy early field intended, with the chart magnitude (move 1) carrying the fix?
