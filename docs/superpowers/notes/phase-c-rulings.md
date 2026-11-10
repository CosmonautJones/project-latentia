# Phase C rulings (normative addendum to the battle engine spec)

These are the controller rulings made while Phase C was built: the `@latentia/sim` balance simulator, the C3.5 engine performance task, the first balance report and the Checkpoint C review. They continue the numbering of `phase-a-rulings.md` (1–80) and `phase-b-rulings.md` (81–119), with the same normative status: where a ruling and the spec differ, the ruling wins, and a later ruling amends an earlier one where it says so. Rulings 144 and 145 record Travis's own decisions. Each ruling is reproduced verbatim from the build ledger and grouped by the task it governs. "Cost if wrong" is the controller's estimate.

## Pre-flight: Phase C scope and defaults

- Ruling 120: the voice-injection archetype is built from slice Voice content (Stochastiparrot: Flattery/Glazed, Hype Train, Hot Take, Stochastic Repeat) as "Voice pressure", without Prompt Injected, because no slice species can learn Deepfake Call. The gap is flagged in the C5 notes and to Travis, and the content fix (learnsets or Skill Scrolls) is his call. Cost if wrong: one archetype is retuned once the content lands.
- Ruling 121: archetype Autopilot decks respect the per-version size for the orchestrator's version (v1 6, v2 8, v3.5 10, v4 12, per bible), checked in archetypes.test.ts. The engine still enforces only the flat 12. Cost if wrong: decks shorter than possible.
- Ruling 122: the satire candidate moves (Make No Mistakes, Vibe Code, Slop Cannon and the rest) are out of Phase C scope, because they need new content and some new primitives. They become a follow-up after C5 if Travis wants it; the bible's "Phase C decides" wording is amended at the C5 docs pass. Cost if wrong: none.
- Ruling 123: open Travis questions get defaults for Phase C. Subagent deck cap stays 12. Specialist stays subagent-only, so ghost Autopilot decks do not earn it. Both are revisitable.
- Ruling 124: C2 exports `starterGrid(speciesId, level)` and the standard L8 starter grids, the only definition, which C3's starter-triangle and graft setups consume. Cost if wrong: none.
- Ruling 125: C4's searchDeck validates every candidate deck with the engine's own validation (validateSetup on the side) and counts only valid candidates against the budget; invalid mutations are re-drawn. Cost if wrong: search efficiency.
- Ruling 126: the sim package is outside the engine's lint bans (spec §10 scopes them to packages/engine/src). Floats are allowed in statistics, and Date only in the CLI layer. Results must be deterministic for a given seed list. Cost if wrong: none.

## Task C1: runner and statistics

- Ruling 127: runMatch overwrites a.side.opponentId = b.id and b.side.opponentId = a.id (documented; built once per match). The same fix round also covers minors 1, 2 and 4 (cli testable without side effects) and bumps packages/engine/package.json version to 0.3.0 to match ENGINE_VERSION.

## Task C2: archetypes

- Ruling 128 (C2 concern 1): every ARCHETYPES creature is level 8, orchestrators and subagents alike. This is the slice's early-gym band and the C3 starter-triangle level. Versions follow the L8 ladder (v2 → 8-card Autopilot). The round-robin then compares builds (species, grid, decks, temperature) rather than levels. The level-spread idea (rookie vs veteran) is dropped from the round-robin set. Cost if wrong: no level-asymmetry coverage in the targets (none of the targets asks for it).
- Ruling 129 (C2 concerns 4–5): C2 exports `mirrorOf(archetype, tag)`. It returns a copy whose creature ids, grid slot bindings and any deck references to those ids are consistently suffixed, so an archetype can face itself (C3 first mover). starterGrid(speciesId, level, subagentId) amends Ruling 124. The extra files build.ts and starter-grids.ts are accepted.
- Ruling 130 (C2 follow-up 2): team size now drives results (r = 0.74). Every ARCHETYPES side fields exactly 4 creatures: orchestrator, 2 active subagents and 1 bench. That makes Headless auto-fill and Swap reachable for all of them. With level and size equalised, the round-robin measures builds. v1 coverage is dropped from the archetype set; the engine tests and goldens still cover v1. 18 cap hits in 4,000 battles (0.45%) is accepted. Cost if wrong: no team-size asymmetry coverage; no target asks for it.
- Ruling 131: the Code-heavy field (7 of 17 slice species are Code) is a real property of the slice, whose first gym is Code, not an artifact of the archetypes. It is reported in C5 as a primary balance finding (type-mix or chart levers) and not tuned in C2. Starter-triangle teams being smaller than archetypes is fine, because C3 never pits them against ARCHETYPES.
- Ruling 132:
    - Every subagent deck's card count is at most the active-card count of the slot it occupies.
    - A bench deck is at most the smaller active count of its side's two slots.
    - Prefer adding Example Cards to the grid so each archetype's idea stays functional, and trim only when a grid cannot fit more.
    - Re-order so the cards that carry the idea are on top.
    - Test it with the engine's own active-card count. If that is not exported, export activeCardCount and the grid size table from the engine's index. This is a public-API addition with no behaviour change.
    - Also fix minors 1 (freeze shared condition constants and the INTERN deck, or clone them in archetype()), 2 (mirror mutation test), 3 (starterGrid determinism test; use the engine's grid-size table), 4 (stale wording), 6 (commit the smoke/correlation script as packages/sim/scripts/smoke.ts, reusable in C5) and 7 (layout() connectivity check).
    - Minor 5 (rare conditions) is accepted.

## Task C3: commands and targets

- Ruling 133 (C3 target setups, within plan text):
    - starter triangle: each starter's side uses starterGrid(species, 8, subagentId) with Tokenibble L8. Each side's Autopilot deck is one fixed 8-card template defined once in targets.ts and instantiated per starter's moves, so no starter gets a hand-tuned edge, and the Tokenibble deck is identical on every side. Both side assignments are pooled.
    - temperature dial: one mixed archetype, the first `mixed-*` in ARCHETYPES order, against mirrorOf(itself); one side at autopilot temperature 0, the other at 4; both assignments pooled.
    - graft vs spin-up: base = each of 3 slice species (pick species whose graftShape fits the L8 starter grid) on a starter L8 team. Variant G adds that species' signature as a graft piece; variant S adds the species as a subagent in a 2×2 slot with 3 adjacent Example Cards. Everything else is identical. Ruling 130's 1+2+1 rule does not apply to target setups.
    - first mover: pooled perfect mirrors, x vs mirrorOf(x) for all 20 archetypes at 500 seeds each = 10,000, so that no single archetype's quirk decides it.
    - vs field, worst matchup and fight length: from one round-robin run inside `targets`, at 1,000 seeds per ordered pairing (worst matchup = both orderings pooled = 2,000).
    - `--seeds-scale k` scales every count, rounding up, with a minimum of 1.
    - Every target uses its own seedFor label, so targets are independent and reproducible.
    - The report records engine version, seeds, wall time per command and per target.
    Cost if wrong: target definitions get tweaked in C5.
- Ruling 134 (C3 target setups are degenerate in two places; these are measurement bugs, not balance findings):
    (a) Starter triangle (Speed > Reasoning > Open > Speed): favoured Sagelet scores 5% against Forkling. The suspicion is that the per-move-index template cripples Sagelet. Build each starter's Autopilot deck by role, not by index:
      - its strongest damaging move first;
      - then its setup or buff move gated on turn 1;
      - then the signature on a condition that fits it;
      - Default = its strongest affordable damaging move.
      Use one role template for all three starters, and give the identical Tokenibble deck on every side. Add sanity tests that every triangle side deals damage and that its top card fires.
    (b) Graft vs spin-up follows Ruling 133 literally. Both variants keep the base team (starter + Tokenibble).
      - G adds the species' signature as a graft piece, and its Autopilot deck must use the grafted move. Add a test that the graft card fires in G.
      - S adds the species as an extra subagent in a 2×2 slot with 3 adjacent Example Cards.
      - If L8 space cannot hold both, use the largest legal layout and state it.
      - The body-count asymmetry is inherent to the choice and is the finding.
    (c) Every target gets a "setup is live" sanity test: its defining difference actually occurs in battle (temperatures differ, the graft fires, the mirror is exact).
    Re-run the 5% targets and report. No tuning.
- Ruling 136: these are now genuine balance findings from valid setups and go to C5, untuned. The plan's shared Tokenibble partner confounds the starter triangle (the Speed partner favours whoever Speed beats). C5 adds a diagnostic triangle with no partner (orchestrator only), next to the official plan-mandated row, so type strength can be read separately from the partner confound. The graft result is read as "spin-up is strictly stronger at L8": the bible says graft must give real value against an extra body. C5 records the tuning levers.
- Ruling 137 (C3 fix round 2, queued until C3.5 finishes so there is only one implementer in the tree):
    - Important 1: each command declares its allowed flags and positional count; anything else is a UsageError, exit 2.
    - m1: the triangle live test asserts that each orchestrator uses its power or signature move (MoveUsed).
    - m2: test the fuzz failure paths with an injected failing case; remove the vacuous capHits ≥ 0.
    - m3: cap hit = BattleEnd.reason 'cap'.
    - m4: histogram min/max via a loop.
    - m5: the targets CSV gains the scale and engine version; the first-mover subject key does not embed counts.
    - m6: derive the report prose from the setup.
    - m7: reports/ stays committable; C5 commits the real reports. Add `reports/*-scratch*` to .gitignore and document it.
    - m8: fix `--` handling.
    - m9: usage text notes same-day overwrite.
    - m10: test temp dirs are cleaned up.

## Task C3.5: engine performance

- Ruling 135 (criterion 7): new engine task C3.5, "round-robin perf". Profile hotspots: grid adjacency is recomputed each round (≈15%) and the event hash takes ≈12%.
    - Cache activeCardCount (and any other static grid derivation) per grid revision, invalidated when a piece is compacted or removed.
    - Further event-hash speedups are allowed.
    - No golden hash may change.
    - Gate: the full 1,000-seed round-robin under 8 min on this sandbox, with headroom under 10. It runs after the C3 fix round, so the two never touch the same files at the same time.
- Ruling 138: revert 91df731, the setup-validation memo. It adds a module-level cache in front of the engine's validation boundary, which is the security boundary for ghost uploads. The gate holds without it (about 7.2 min). The grid memo is a WeakMap on grid objects, which never change during a battle (compaction lives in context state). Accepted; the reviewer confirms.
- Ruling 140: criterion 7 (spec: < 10 min, one process, with headroom) is met by the shipped engine at about 7.5 min, about 25% headroom. The 8-min figure was an internal stretch gate, and the reviewer's measurement meets it. The official `time pnpm sim round-robin --seeds 1000` on the final code is recorded in C5 Step 1, which the plan already requires; it is not run now, so as not to distort C4's concurrent run. Minors 1 (hard-coded v4 cap), 2 (pin grid immutability by freezing the battle grid or a deep-equal test) and 3 (trie retained size via the public eventStreamHash) go to the Checkpoint C fix wave triage; minors 4–6 are accepted.

## Task C4: deck search

- Ruling 139 (C4 search design, within the plan text):
    (a) The search mutates the archetype's 8-card Autopilot deck, the v2 size under Ruling 121. Every candidate keeps exactly 8 cards plus Default.
    (b) Every candidate is validated with the engine's validateSetup on its side (Ruling 125). Invalid mutations are re-drawn and cost no budget.
    (c) Common random numbers: every candidate is scored on the same fixed list of evaluation seeds against the same field (the other 19 archetypes, both sides). Battles per evaluation = 19 × 2 × k. The default k fits about 25–50 evaluations into a 20,000 budget; report the k used.
    (d) A step is accepted only on a strictly higher score, so accepted-step win rates rise monotonically.
    (e) The search has its own PRNG seeded from the SeedHex argument, using the engine's exported rng if public, or a sim-local sfc32 otherwise. Never Math.random.
    (f) Overfitting guard: report the final deck's score on fresh held-out seeds (a different label) alongside the search score, and on the base deck.
    (g) CLI: `search --archetype <id> --budget N [--seed hex] [--tag t]` writes reports/search-<date>.md and .csv, with the history, the final deck printed as cards, the held-out comparison and battlesUsed.
- Ruling 141 (amends 139(d); done before C5 because it changes the search stream):
    - A candidate is accepted only if its score beats the current one by at least 1 percentage point on the shared evaluation seeds. This guards against noise-chasing at k = 16, where one evaluation has a standard error of about 1.9 pp.
    - foeLastMove conditions draw from the moves the field actually knows.
    - turn thresholds skip impossible values.
    - Replacement targets are constrained by move category (attacks aim at foes; self, buff and heal moves at self or allies), using the same selectors the engine's defaults use.
    - The report shows the unused budget.
    - m1 (movePool copies a private engine rule) is parked for a one-line engine export in the Checkpoint C fix wave. m5 (cosmetic) is done in the same pass.
    C5 runs 4 searches at different seeds rather than one, to cover breadth.

## Task C5: first balance report

- Ruling 142 (C5 scope):
    - Step 1: run the official `time pnpm sim round-robin --seeds 1000` on the final code (criterion 7, Ruling 140).
    - Step 2: run `pnpm sim targets` at full scale (criterion 6).
    - Step 3: 4 searches, archetype speed-rush-blitzr plus the 3 weakest archetypes vs the field, each with budget 20000 at a distinct seed. Report held-out against base.
    - Add the partnerless starter-triangle diagnostic (Ruling 136) as a small committed script under packages/sim/scripts. It is not a target row.
    - Notes: findings ranked by impact, and the first tunable levers to adjust, each with its expected effect and how to test it with the tool (matchup or targets). No retuning.
    - Notes also carry the product flags for Travis:
      - learnsets and Skill Scrolls for the 18 unreachable moves and Prompt Injected (Rulings 112, 113, 120);
      - anti-hallucination content (C2);
      - satire move candidates, a follow-up (Ruling 122, amending the bible's "Phase C decides" wording);
      - Specialist for ghosts;
      - deck size.
    - Commit the real reports in reports/ (round-robin, targets, search) plus docs/superpowers/notes/first-balance-pass.md.

## Checkpoint C and Travis's decisions

- Ruling 143 (Checkpoint C fix wave):
    - I1: the partnerless starter triangle becomes a `targets` row, labelled diagnostic; it does not count toward pass/fail. The official row keeps the plan's Tokenibble partner (option A) until Travis decides.
    - I2 (amends Ruling 133): the temperature dial pools over all 20 archetypes, 50 seeds per side assignment each (2,000 battles), as first mover does. The per-archetype T0-vs-T4 sweep is also reported as diagnostic rows.
    - I3: reword tuning move 5a in the notes. Bible:250 says a graft is at 100% power, and the 1.3× is a content-value target, not a multiplier. Product question 6 stays open.
    - I4: commit /tmp/c5q/diag.ts as packages/sim/scripts/diagnostics.ts, with relative imports and a package.json script.
    - I5: every md and csv gains a content fingerprint (fnv1a64 of canonical ARCHETYPES plus TARGETS setups) and the git SHA plus a dirty flag (read in the CLI layer). The round-robin CSV gains engine version and seed-label columns.
    - I6: the controller commits phase-c-rulings.md.
    - Minors:
      - the worst-matchup overall row no longer double-counts;
      - the seeds column shows scaled counts;
      - `matchup` pools both side assignments by default;
      - add a packages/sim README;
      - freeze the ARCHETYPES array itself;
      - S variant of graft vs spin-up drops the signature (bible: spin-up keeps 3 moves), and reword the species.ts:12 comment so it doesn't imply the rule is enforced.
    - Parked engine minors, fix now (goldens must stay unchanged):
      - C3.5 m1: derive the version cap from VERSION_SLOTS;
      - C3.5 m2: test grid immutability against the setup after the goldens and the memo fixture;
      - C3.5 m3: the trie bound counts stored labels;
      - C4 m1: export orchestratorMoves and have movePool use it.
    - Then re-run the full round-robin (timed) and full targets, replace the committed reports, and update the affected notes sections.
    - Travis decides: the triangle partner, what graft vs spin-up compares, and whether to enforce the spin-up signature rule (with distillation, milestone 8).
- Ruling 144 (Travis, 2026-11-09): the official starter-triangle row keeps Tokenibble as every starter's partner (option A — 'Tokenibble is perfect'). The partnerless triangle stays as a diagnostic row (Ruling 143 I1).
- Ruling 145 (Travis, 2026-11-09, option A): a spun-up subagent joins at the defeated wild model's level, not the orchestrator's. The graft-vs-spin-up target compares G (L8 base team plus graft) against S (L8 base team plus the species spun up at L5, a mid-Deprecated-Forest wild level). The S subagent drops its signature, keeping 3 moves (bible:250). The bible's distillation table gains this rule. It is folded into the running Checkpoint C fix wave.
