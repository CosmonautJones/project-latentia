# First Tuning Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the slice's balance targets toward their bands with the smallest set of content and rule changes. Apply Travis's decisions of 2026-11-10 and verify every change with `@latentia/sim`.

**Architecture:** This is content and rules tuning on top of the finished engine (0.3.0) and simulator.
- **Changes that touch the engine:**
  - type-chart magnitude
  - species and move numbers
  - the temperature table

  Each of these bumps ENGINE_VERSION and re-records the goldens once, with every changed hash listed.
- **Changes that touch only the simulator:**
  - target setups
  - archetype decks

  These need no engine change.
- **Measurement:** every tuning step is measured, not assumed. Run `pnpm sim targets` before and after, and record each step in a tuning log.

**Tech Stack:** TypeScript, pnpm, Vitest, `@latentia/engine`, `@latentia/sim`.

**Spec:** docs/superpowers/specs/2026-11-07-battle-engine-design.md. Rev 3.3 plus Rulings 1–145. This pass adds Rulings 146+.

## Global Constraints
- **Engine rules.** All engine Global Constraints from the battle-engine plan apply verbatim: lint bans, integer basis points, determinism, golden rules.
- **Engine versioning.** Any change to engine content or rules bumps ENGINE_VERSION. Use **0.4.0** for this pass, bump it once, and re-record goldens once at the end of D2. A later engine change in this pass re-records again and lists its hashes.
- **Simulator rules (Ruling 126).** The simulator may use floats in stats and may use Date only in the CLI. Reports carry provenance: content fingerprint, git SHA, engine version and seed scale.
- **Travis's decisions (2026-11-10):**
  - Tokenibble is the first wild catch, not a bundled partner.
  - Spin-up is accepted as the stronger choice, and it carries a light cost.
  - The type chart softens: super-effective 2× → 1.5×, resisted ½ → ⅔.
  - Follow the controller's ranked recommendations (first-balance-pass notes, section d).
- **No content beyond what each task names.** New moves, learnsets and the satire candidates are out of scope.

## Tasks

### Task D1: Rules and targets for Travis's decisions (sim + docs, no engine change)
- Ruling 146: the official starter-triangle row becomes partnerless. Each starter is orchestrator-only with the role-based decks, 2,000 per matchup, both assignments pooled. The Tokenibble-partner rows are removed. Bible changes:
  - the beat sheet: the rival fight is starter vs starter; Tokenibble is the first wild model at the trailhead, the first distill and the first spin-up into the example-card tutorial;
  - the species table: "Bundled intern" becomes "First wild model (trailhead)".
- Ruling 147: graft vs spin-up.
  - Spin-up is accepted as stronger, because the extra action is the draw.
  - Light cost: a freshly spun-up subagent joins at the wild level (Ruling 145) with **1** active Example Card slot. It gains slots through level, Clean distill and grid expansion.
  - The official target becomes **"a graft is worth taking"**: base team + graft vs base team alone, ≥ 55%, for the same 3 species, 2,000 each.
  - The old G-vs-S rows become diagnostic, with S at L5, 1 active card and no signature.
  - Update the bible's distillation table, balance-targets table (bible:602), and spec §9 graft row via the ruling. The spec text is amended in the D5 docs pass.
- Verify: sim tests; `pnpm sim targets --seeds-scale 0.1 --tag scratch` to check that the new rows produce verdicts.

### Task D2: Type-chart magnitude (engine 0.4.0)
- Ruling 148: X 20000 → 15000 and H 5000 → 6667 in content/types.ts. Keep regularity: every type still has exactly two strong and two weak matchups. Update the content test's pinned values and the bible chart text.
- Bump ENGINE_VERSION to 0.4.0. Re-record every golden whose hash changes and list old → new for each. Expect almost all of them to change.
- Verify:
  - lint, typecheck and tests, FUZZ_N=10000, bench;
  - `pnpm sim targets` full scale, compared against the 2026-11-10 baseline in the tuning log;
  - `pnpm --filter @latentia/sim triangle-solo`.

### Task D3: Re-baseline archetype decks with search (sim only)
- Tuning move 0. For every archetype, run `pnpm sim search --archetype <id> --budget 20000` at a fixed seed, under the new chart. Adopt the final deck only if its held-out score beats the base by ≥ 1 pp. Keep every archetype's idea and headline cards; the headline test must still pass. Record each adoption in the tuning log.
- Verify: archetype tests, headline test, full targets.

### Task D4: Iterative content tuning (engine content)
Work through the ranked moves from first-balance-pass §d, re-ranked against the post-D2/D3 data. One change at a time:
- Deprecatter stats or Nostalgia Trip
- Hallucinat Compute
- T4 accuracy
- Distilled Strike
- Drift penalty

For each:
1. Measure with the named matchup command and the targets rows.
2. Keep the change only if it moves its target toward the band without pushing another target out of band.
3. Log it.

Stop when every target passes or is inconclusive, or after 8 kept changes, whichever comes first. One ENGINE_VERSION bump (0.4.x) covers the whole of D4, with goldens re-recorded once at the end.

### Task D5: Report, docs and checkpoint
- Write docs/superpowers/notes/tuning-pass-1.md with the before and after verdict tables, the tuning log, and what is still open.
- Commit reports.
- Docs pass: spec §9 rows, bible numbers, phase-d rulings.
- Checkpoint D: hard gates, an independent review, a fix wave and a re-review, a scorecard for Travis, then the PR (merge only on Travis's ask).

## Review Focus
- A tuning change that improves one target by pushing another out of band. Every step must check the full targets table, not just its own row.
- Overfitting to the slice's fixed archetype set. D3 and D4 changes must hold on held-out seeds, and the search's held-out check must agree.
- Golden churn hiding a real behaviour bug. Each re-record lists hashes, and the reason must be content values only.
- Criterion 7 regression. A softer chart lengthens fights, so the round-robin must be re-timed after D2 and must stay under 10 min.
- The starter triangle tuned to 60/40 by accident of deck templates rather than type. The solo row uses role-based decks identical in shape for all three starters.
