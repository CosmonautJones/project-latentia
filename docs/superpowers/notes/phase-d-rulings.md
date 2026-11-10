# Phase D rulings (normative addendum to the battle engine spec)

These are the controller rulings made while Phase D, the first tuning pass, was built: the partnerless starter triangle and the graft row, the softer type chart, the D3 deck re-baseline and its headline and adoption rules, the D4 content tuning, and the PR plan. They continue the numbering of `phase-a-rulings.md` (1–80), `phase-b-rulings.md` (81–119) and `phase-c-rulings.md` (120–145), with the same normative status: where a ruling and the spec differ, the ruling wins, and a later ruling amends an earlier one where it says so (Ruling 146 supersedes Ruling 144, Ruling 147 amends Ruling 145's graft comparison, and Ruling 150 amends the D3 adoption text). Rulings 146–148 follow Travis's own decisions of 2026-11-10: Tokenibble is the first catch, spin-up is accepted as stronger with a light cost, the type chart is softened to 1.5× and ⅔, and the controller's ranked tuning recommendations are followed. Each ruling is reproduced verbatim from the build ledger and grouped by the task it governs.

## Pre-flight: starter triangle, graft row and type chart (Task D1 and D2)

- Ruling 146: the official starter-triangle row is partnerless (orchestrator only, role-based decks). Tokenibble is the trailhead's first wild model, the first distill and the first spin-up.
- Ruling 147: spin-up is accepted as stronger. Light cost: a new spin-up joins at the wild level with 1 active Example Card slot. The official graft row becomes "graft worth taking": base + graft vs base ≥ 55%. The G-vs-S rows stay as diagnostic rows.
- Ruling 148: type chart X 20000→15000, H 5000→6667, ENGINE_VERSION 0.4.0.

## Task D3: archetype deck re-baseline

- Ruling 149 (headline integrity):
    - A headline card keeps its move AND its condition category (parameters may change), and its per-battle fire rate against the field must be ≥ 50% of its pre-D3 rate.
    - Record the pre-D3 rates as floors in headlines.ts, and test the floors with the same field pass the headline test already runs.
    - Restore parrot's flatter and embeddingo's reasoner (and parrot's glaze if it carries the idea), then re-score. Adopt only if the deck still clears the adoption rule. Fix the stale comment at headlines.ts:10-13.
- Ruling 150 (adoption rule, amends the D3 text): a deck is adopted only if it beats base by ≥ 1 pp on the search's held-out label AND on a second, independent held-out label. Slopling (+0.9 on the reviewer's second set) is re-scored under this rule.
    - Over-band archetypes are deliberately still allowed better decks: content must be balanced against the strongest deck a player can find. This is the reason the search exists. The over-band gap is D4's job.
- Ruling 151 (D3 minors):
    - The search 'keeps 8 cards' test climbs from a deliberately weak synthetic deck, not archetype data.
    - Searched card ids get semantic names in adopted decks.
    - The d3-rebaseline.ts header notes that it reproduces from the pre-D3 field (77335b6).
    - The temperature live-check exclusion is documented as conservative; keep it.
    - Re-run full targets and update the log after the fixes.

## Task D4: content tuning and cadence

- Ruling 152 (D4 scope and ranking): re-rank the levers against post-D3 data, with these failing targets first:
    1. the dominant archetypes vs the field (reasoning-nuke-sagelet, open-swarm-forkling, hallucinat and the rest);
    2. the solo starter triangle (99.3/91.3/100), where starter numbers are the levers: base stats, move power and cost, signature;
    3. the temperature dial (T4 row);
    4. off-by-wasp graft value (signature content value);
    5. worst matchup.
  Method: one engine-content change at a time. Screen with matchup or targets at 0.1–0.25 scale, and confirm every kept change with full-scale targets. Keep a change only if its target moves toward band and no other target leaves band (pass or inconclusive → fail). Stop at all targets pass/inconclusive or 8 kept changes. One ENGINE_VERSION bump (0.4.1) at the end, with goldens re-recorded once and listed. The criterion-5 fixture may need re-tuning; it follows Rulings 108/114 with counterfactuals.
- Ruling 153 (lighter cadence, Travis's 2026-11-10 priority shift to playable v0): D4 gets one review. D5 is the tuning-pass-1 notes, phase-d rulings, the spec §9 text and the PR. The D4.5 perf task is dropped, since the round-robin is at 7m03s against a 10 min limit.

## Pull request

- Ruling 154: the D-tuning PR is squash-merged, so the 4 deliberately red content commits never land individually on main.
