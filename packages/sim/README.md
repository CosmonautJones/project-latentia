# @latentia/sim

The balance simulator for the Latentia battle engine (`@latentia/engine`). It plays seeded battles between 20
archetype teams through the engine's public API and scores them against the design bible's balance targets
(spec §9). Every run is deterministic: the same code, command and flags give the same numbers.

Run commands from the repository root:

```sh
pnpm sim <command> [options]
```

## Commands

| command | what it does | example |
|---|---|---|
| `round-robin [--seeds N]` | every archetype against every other, both side assignments: 190 unordered and 380 ordered pairings, N battles per ordered pairing (default 1000) | `pnpm sim round-robin --seeds 1000` |
| `matchup <a> <b> [--seeds N] [--one-sided]` | one pairing. By default N battles with `a` on each side, pooled (2N in all). `--one-sided` runs only the N with `a` on side a. `a` = `b` plays an archetype against its mirror | `pnpm sim matchup speed-rush-blitzr open-swarm-forkling --seeds 1000` |
| `fuzz [--battles N]` | N random legal battles (default 500), each replayed from its log; exits 1 on any exception, invariant error or replay mismatch | `pnpm sim fuzz --battles 10000` |
| `targets [--seeds-scale k]` | every balance target, each with its own setup, at k × its §9 seed count (default 1) | `pnpm sim targets --seeds-scale 0.1 --tag scratch` |
| `search --archetype <id> --budget N [--seed <hex>]` | hill-climbs the archetype's Autopilot deck against the other 19 within N battles, then re-scores the base and final decks on held-out seeds | `pnpm sim search --archetype code-lock-nullbeetle --budget 20000` |

Every command also takes `--tag <tag>`. Unknown flags, repeated flags and stray arguments are errors (exit 2), so a
typo never starts a run at its defaults. `pnpm sim` with no command prints the usage.

### Approximate run times

These were measured on the development container (about 1.2 ms per battle, one process):

| run | battles | time |
|---|---|---|
| `round-robin --seeds 1000` | 380,000 | about 7.5 min |
| `targets` (scale 1) | about 420,000 | about 8 min, nearly all of it the round-robin inside it |
| `search --budget 20000` | 20,672 (with held-out) | about 30 s |
| `targets --seeds-scale 0.01` | about 4,000 | a few seconds |

Run one heavy command at a time: two concurrent runs slow each other, and the round-robin's wall time is a tracked
criterion.

## Reports

Each run writes `reports/<command>-<YYYY-MM-DD>[-<tag>].md` and a `.csv` beside it at the repository root. A rerun on
the same day with the same tag overwrites them. `reports/` is committed.

**The `--tag scratch` convention.** Any tag containing `scratch` (for example `--tag scratch` or
`--tag scratch-blitzr`) matches the `reports/*scratch*` ignore rule, so exploratory runs never end up in a commit.
Use plain tags (such as the archetype id for searches run the same day) only for reports you mean to commit.

### Reproducibility

Every `.md` header and every `.csv` row records where its numbers came from:

- **engine version**: `@latentia/engine`'s `ENGINE_VERSION`;
- **seed scale**: what the run's seed count means for that command (`--seeds-scale` for targets, seeds per ordered
  pairing for round-robin, seeds per side for matchup, battles for fuzz, k for search);
- **content fingerprint**: FNV-1a 64 of the canonical JSON (keys sorted) of `ARCHETYPES`, the `TARGETS` table and
  every target setup object. Two reports with the same fingerprint ran on the same sim content;
- **git SHA and dirty flag**: the checked-out commit, and whether anything outside `reports/` differed from it
  (modified, staged or untracked files). Only a clean SHA pins the engine content (species, moves, type chart) too.

The CSV ends every row with `engine_version, seed_scale, content_fingerprint, git_sha, git_dirty`. The round-robin
CSV also has a `seed_label` column: battle i of that pairing ran on `seedFor(seed_label, i)`.

To reproduce a committed report, check out its SHA (it must say `clean`), confirm the fingerprint, and rerun the
command line printed in its header.

## Reading the targets report

*2026-11-10: the starter-triangle row (partnerless) and the graft row ("a graft is worth taking", ≥ 55%) are as set by Rulings 146–147; earlier descriptions of them are superseded by Rulings 146–147.*

A rate is the side's score, with a draw counting 0.5, and its interval is the 95% Wilson interval. Each row gets one
verdict against its target's band:

- **pass**: the point estimate and the whole interval lie inside the band;
- **fail**: the point estimate lies outside the band;
- **inconclusive**: the point is inside but the interval crosses an edge. More seeds would settle it.

Fight length is judged on its point (the median) alone. A target takes its worst row's verdict.

Only **target** rows count toward pass, fail and inconclusive. Two other kinds of row are shown with their reading
against the band, but never counted:

- **summary**: restates a target row. Worst matchup's "overall" row repeats the worst of the 20 per-archetype rows.
- **diagnostic**: helps read a target, but is not the target itself.
  - Graft vs spin-up's G-vs-S rows (Ruling 147). S is the spun-up subagent at L5 with 1 active Example Card and no
    signature. Spin-up is intended to be the stronger choice, so these read low against the "graft worth taking"
    band by design.
  - The per-archetype temperature sweep shows which teams the pooled dial row hides.

The summary table gives each target's §9 seed count beside the **seeds run**, the counts actually played at the run's
seed scale.

## Diagnostic scripts

These print Markdown to stdout and write no report.

- `pnpm --filter @latentia/sim triangle-solo`: the official starter triangle (orchestrator only, Ruling 146), 2,000
  battles per matchup, with the median rounds. It uses the targets command's seed labels, so its points reproduce the
  targets report's triangle rows exactly.
- `pnpm --filter @latentia/sim diagnostics <graft | hallu | temp> [--seeds N]` (`scripts/diagnostics.ts`). An
  unknown argument is a usage error (exit code 2), as in the sim commands. `--seeds N` replaces the battle count
  (per side assignment for `graft` and `temp`, per ordered pairing for `hallu`; defaults 1,000, 250 and 50):
  - `graft`: G and S against the base team, and G against the current S (L5, 1 card, no signature) and two older
    forms of S (at L8, with and without its signature);
  - `hallu`: how often each side has a Hallucinating creature, and how often the anti-hallucination cards fire;
  - `temp`: T0 vs T4 for every archetype, 500 battles each.

  Each subcommand uses its own `c5diag:` seed labels. The `hallu` and `temp` numbers cited in
  `docs/superpowers/notes/first-balance-pass.md` reproduce at the default counts; the `graft` ones predate Ruling 147
  (S had 2 active cards then; the note says so, "superseded by Rulings 146–147").
- `pnpm --filter @latentia/sim smoke --seeds N`: a quick round-robin sample with structural correlations.

## Layout

- `src/archetypes/`: the 20 archetypes (L8, 1 orchestrator + 2 active + 1 bench, gridded, on Autopilot decks), deeply
  frozen.
- `src/target-setups.ts`: each target's own setup (partnerless starter sides, the base team, graft and spin-up variants,
  temperature pairs).
- `src/targets.ts`: the §9 targets table and `measureTargets`.
- `src/round-robin.ts`, `runner.ts`, `stats.ts`: battles, scores, Wilson intervals and verdicts.
- `src/search.ts`, `mutations.ts`, `sfc32.ts`: the deck search.
- `src/report.ts`, `fingerprint.ts`: report rendering and provenance.
- `src/cli.ts`: the only place that reads the date, the wall clock and git.
