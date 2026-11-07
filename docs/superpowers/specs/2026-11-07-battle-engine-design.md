# Battle Engine & Simulator — Design Spec

- **Project:** Latentia (working codename; the region name, not a final title)
- **Sub-project:** 1 of 5 — the headless battle engine and balance simulator
- **Date:** 2026-11-07
- **Status:** Draft for review
- **Source of truth for game rules:** `docs/design-bible.md` (sections "One Context Grid…", "Battles run on eight types…", "Training is example cards…", "Determinism makes ghosts…"). This spec turns those rules into a buildable engine. Where this spec and the bible differ, this spec wins and the bible gets updated.

---

## 1. Why this comes first

Every risky unknown in the game is numerical: L1 headroom, the temperature dial, graft vs spin-up, the type triangle, fight length. A headless, deterministic simulator answers all of them before any art is drawn. The same engine later runs ghost re-validation on the server and judges LLM-compiled decks. Everything else depends on it.

### The five sub-projects

| # | Sub-project | Bible milestones | Depends on |
|---|---|---|---|
| **1** | **Battle engine & simulator** (this spec) | 1–3 | — |
| 2 | Game shell & battle scene: Phaser 4 + Vite, integer scaling, portrait/desktop layouts, input, greybox battle scene, grid editor | 4–5 | 1 |
| 3 | Overworld & progression: Tiled loader, movement, greybox maps and puzzles, distillation, XP, evolution | 6–8 | 1, 2 |
| 4 | Slice content, writing, art & audio | 9–12 | 2, 3 |
| 5 | Ghosts, shareables & launch: Supabase, re-simulation, trainer card, PWA, Steam page | 13–14 | 1–4 |

Each sub-project gets its own spec → plan → build cycle.

---

## 2. Goal and success criteria

**Goal:** a pure-TypeScript package that runs complete, deterministic battles from a setup, a seed and a command source, explains every action it takes, and a CLI harness that runs thousands of simulated battles and reports balance against the bible's targets.

The sub-project is done when all of these hold:

1. **Determinism:** the golden-file suite produces byte-identical battle logs on Node 22 and headless Chromium.
2. **Replay:** for any recorded battle, `replay(log)` reproduces the same result and event stream.
3. **Legibility:** every subagent action emits a trace naming the card that fired and the cards that were skipped, and intents are available before the player commits.
4. **Robustness:** a fuzz run of 10,000 random legal battles finishes with no exceptions, and every battle ends within the 50-round cap.
5. **Training works:** the "broken deck" scenario (heal card ordered below attack card) loses, and the same deck with the two cards swapped wins, across ≥ 90% of 200 seeds.
6. **Balance harness:** `pnpm sim round-robin` runs ~20 archetype decks × 1,000 seeds per pairing and writes a report that marks every bible balance target as pass or fail. (Hitting the targets is tuning work that happens with this tool; the deliverable is the tool and a first report.)
7. **Performance:** the full round-robin finishes in under 10 minutes on a typical laptop, single process.

---

## 3. Scope

### In scope
- Type chart, stats, stat stages, damage, accuracy and crit math (integer only)
- Temperature dial (orchestrator per round; subagents use a trained temperature)
- Context tokens, headroom, Drift, Compact, /clear, Observation and Junk tokens, forced compaction of loadout pieces
- The Context Grid **data model and pure validation**: piece placement, overlap and bounds checks, the 4-cell headroom floor, adjacency, and the active-card count per subagent
- The 8 statuses and the 3 guard moves
- All 57 launch moves, plus signature moves for the 17 slice species
- Card grammar, deck evaluation, intent preview, re-planning and traces
- Orchestrator levers: Directive, Policy Update, Swap; Headless Mode; Autopilot decks for AI-controlled orchestrators
- Handoff Chain, super-effective cell refund
- Generalization (G), the Eval Suite format, and G-band obedience
- Seeded PRNG with fixed draw discipline, engine versioning, battle logs and replay
- Slice content data sufficient to simulate: 8 types, 57 moves, 17 species with **placeholder** base stats
- The simulation CLI: round-robin, single matchup, temperature sweep, graft-vs-spin-up mirror, fuzz, and a basic hill-climbing deck search

### Out of scope (later sub-projects)
- Any rendering, Phaser or UI, including the grid editor (sub-project 2)
- Overworld, XP awarding, distillation, evolution and leveling (sub-project 3). The engine accepts a creature's level, version and deck as inputs; it does not change them.
- Final species stats, names and flavour text (sub-project 4)
- Supabase, ghost upload/validation service, matchmaking (sub-project 5)
- The LLM strategy compiler (post-slice hybrid)
- Grid pieces marked "Later" in the bible (Heavy Skill, Notes, Adapter, Workflow, Safety Filter, RAG Index, Sampler). The grid model must allow adding new piece kinds without changing existing ones.

---

## 4. Architecture

### Repository layout (pnpm workspaces)

```
latentia/
  packages/
    engine/          # @latentia/engine — zero runtime dependencies
      src/
        rng/         # PRNG + draw discipline
        content/     # types, moves, species, statuses (typed data)
        math/        # basis-point helpers, stats, damage, accuracy, crit
        grid/        # grid model, placement validation, adjacency
        context/     # token store, overflow, compaction
        status/      # status application, ticking, cures
        cards/       # card grammar, condition evaluation, deck evaluator, traces
        generalization/ # G formula, Eval Suite runner
        battle/      # setup validation, round loop, action resolution, win check
        log/         # event types, battle log, replay
        index.ts     # public API
      test/
        golden/      # recorded logs used as golden files
    sim/             # @latentia/sim — CLI harness, archetype decks, reports
  docs/
```

`apps/game` (Phaser) arrives in sub-project 2 and imports `@latentia/engine` only through its public API.

### Units and their boundaries

Each unit has one job, is tested on its own, and only depends on the units listed.

| Unit | Does | Depends on |
|---|---|---|
| `rng` | sfc32 PRNG; `drawAction()` returns the six fixed draws; `drawRoundStart()` returns one draw per creature | — |
| `math` | Basis-point arithmetic, stat calculation, damage, accuracy and crit formulas | — |
| `content` | Typed, frozen data: type chart, moves, statuses, species | — |
| `grid` | Validates a loadout layout; answers adjacency and active-card questions | `content` |
| `context` | Per-creature token store: add, overflow → Drift, compact, clear, forced compaction targets | `grid` |
| `status` | Apply, block, tick, expire and cure statuses | `content` |
| `cards` | Evaluate a deck against a battle view → chosen card, move, target and trace | `content` |
| `generalization` | Compute C, R, H and G for a deck against an Eval Suite | `cards`, `battle` |
| `battle` | Setup validation, the round loop, action resolution, win check | all of the above |
| `log` | Event definitions, the append-only battle log, `replay()` | `battle` |

### Public API (sketch)

```ts
export const ENGINE_VERSION: string;           // semver; bumps on any rule change

export function validateSetup(setup: BattleSetup): ValidationResult;
export function createBattle(setup: BattleSetup, seed: Seed): BattleState;

export function getIntents(state: BattleState): Intent[];        // plan phase
export function submitRound(state: BattleState, cmd: RoundCommand):
  { state: BattleState; events: BattleEvent[] } | { error: CommandError };

export function simulate(setup: BattleSetup, seed: Seed,
  commands: CommandSource): BattleResult;   // runs to completion
export function replay(log: BattleLog): BattleResult;

export function validateGrid(grid: GridLayout, level: number): ValidationResult;
export function activeCardCount(grid: GridLayout, slotId: string, version: Version): number;
export function computeGeneralization(deck: Deck, suite: EvalSuite): GeneralizationReport;
```

`submitRound` never mutates its input. Internally it clones the state once per round (`structuredClone`) and mutates the clone, which keeps sims fast while callers see immutable states. `CommandSource` is either a recorded list of round commands or an Autopilot deck, so the same `simulate` serves ghosts, AI trainers and the harness.

---

## 5. Battle model

### Sides and roster
- Each side has one **orchestrator** (the player's starter, or the lead creature of an AI trainer or wild model), **0–2 active subagents**, and **0–3 bench** creatures.
- A wild battle is one wild model, optionally with up to 2 companions acting from built-in decks.
- The orchestrator is never benched. If it is KO'd, its side enters **Headless Mode**: subagents keep acting from their decks; the orchestrator's command is skipped. A side loses when every creature on it is KO'd.
- An AI-controlled orchestrator (trainers, ghosts) uses an **Autopilot deck** in place of player commands. Autopilot decks use the same card grammar with up to 12 cards.

### Stats
Five stats: HP, Compute (attack), Robustness (defense), Latency (speed, higher is faster), Ctx (window size). Starting formulas, tunable:

- `HP = floor(2 × baseHP × L / 100) + L + 10`
- `Stat = floor(2 × base × L / 100) + 5`
- Stat stages −3…+3 map to 5714, 6667, 8000, 10000, 12500, 15000, 17500 basis points (the bible's ×1.25 / ×1.5 / ×1.75 and their reciprocals, rounded down).
- A subagent's Ctx is its own window (species value, 10–16, default 12). The orchestrator's in-battle Ctx is its grid **headroom** (empty cells).

### Round structure
1. **Round start.** One round-start draw per creature (split into a tie-break value and a coin value). Statuses that act at round start resolve.
2. **Plan.** Every subagent deck (and every Autopilot deck) is evaluated → one **Intent** per creature (move + target + card id). The player sets temperature and submits the orchestrator's command.
3. **Sort.** Actions sort by priority bracket (+4 to −3), then effective Latency, then the round-start tie-break. The sort is stable and fully specified, so it never depends on engine iteration order.
4. **Resolve each action**, in order: re-validate the card's condition (if false, fall through the deck and mark the intent `replanned`); check statuses (Rate Limited skip, Hallucinating retarget, Prompt Injected replacement); pay context; consume the six action draws; roll accuracy, crit, damage; apply effects; update the Handoff Chain.
5. **End of round.** Statuses tick and expire, Junk tokens land, Deprecated counts down, bench creatures recover 2 context cells, unpaid context converts to Drift, win check.
6. **Cap.** After round 50, the side with the higher total remaining HP% wins; an exact tie is a draw.

### Draw discipline
- PRNG: **sfc32**, seeded from a 128-bit seed (four uint32s). No other source of randomness anywhere in the engine.
- **Every action consumes exactly six uint32 draws in this order:** obedience, status proc, accuracy, crit, roll, rider. They are drawn whether or not they are used, so a changed outcome upstream never shifts later draws.
- When one draw must yield more than one value, it is split with fixed formulas: `lo = d % a`, `hi = (d >>> 16) % b`. Examples: Hallucinating's retarget (lo) and random move (hi) both come from the status-proc draw; a multi-hit move's hit count comes from the roll draw's `hi` and its damage roll from the roll draw's `lo`; status durations ("2–4 rounds") come from the rider draw of the action that applied them.
- Each action's six draws are logged with the action, which powers the "show the rolls" replay view later.

### Math rules
- **Integers only.** All multipliers are basis points (10000 = ×1.0), applied in a fixed order with `Math.floor` after each step. No floating point, no `Math.pow`, no `Math.random`, no `Date`. A lint rule bans those globals inside `packages/engine/src`.
- **Damage:** `floor(floor(Power × Atk / Def × LevelFactor / 50) × Type × Native × Crit × Roll / 10000) + 1` with each multiplication floored in that order, where `LevelFactor = floor(2 × L / 5) + 2`, `Type` is the chart product clamped to 2500–30000, `Native` (same-type bonus) is 12500, `Crit` is 15000 and ignores the defender's positive Robustness stages, and `Roll` comes from the temperature table.
- **Accuracy:** hit if `draw % 100 < clamp(MoveAcc + TempMod − 8 × Drift + 10 × (AccStages − EvaStages), 30, 100)`.
- **Crit stages:** none, 1/48, 1/24, 1/12, 1/6, 1/2, guaranteed — stored as integer thresholds out of 48.
- **Temperature:** the five notches T0–T4 and their roll ranges, accuracy, crit and self-hallucination values come directly from the bible's temperature table. Wild riders trigger at T3+ and at double strength at T4.
- **Handoff Chain:** each consecutive allied hit on the same target in one round adds +10% (cap +30%); any enemy action between them resets it.
- **Efficient Answer:** a super-effective hit frees 1 token from the attacker's window.

### Context (the grid rule)
- The orchestrator's in-battle window **is** its grid headroom. Loadout pieces are fixed at battle start.
- A move costing *n* cells adds *n* tokens, each stamped with an age (round, sequence).
- Buffs are stored as tagged tokens; if a buff token is summarized it loses 1 stage.
- The first sighting of each enemy move adds 1 Observation token (+10% resistance to that move this battle) **only if a cell is free**.
- Paying more than the free cells is allowed: each missing cell adds 1 Drift (max 5).
- Enemy-forced tokens (Filibuster, Memory Leak, Junk) with no free cell compact the **oldest loadout piece that is neither pinned nor cached** into a 1×1 Summary at 50% effect.
- **Compact** (0 cost, priority −2): the oldest 6 tokens become 3 summaries; clears 1 Drift.
- **/clear** (priority −3): wipes all tokens, stat stages and Drift; the orchestrator skips its next command while subagents keep acting.
- Subagents run the same rules on their own Ctx window. Battle end restores everything (the engine reports the restored state; it never mutates the caller's loadout).

### Grid model (data and validation only)
- `GridLayout = { width, height, pieces: PlacedPiece[] }`, where a `PlacedPiece` has a kind, a shape (list of cell offsets), an anchor, a rotation (0/90/180/270), flags (`pinned`, `cached` derived from Cache adjacency) and kind-specific data (e.g., which subagent a slot holds).
- Grid size by orchestrator level: 4×4 (L1), 5×4 (L4), 5×5 (L7), 6×5 (L10), 6×6 (L13). The engine receives the size; choosing which edge grows is a sub-project 3 concern.
- `validateGrid` checks bounds, overlap, uniqueness (one System Prompt, max 4 Skills), and the **headroom floor of 4 empty cells**, returning every error rather than the first.
- Adjacency is orthogonal. A Tool adds +1 effect step to each adjacent Skill.
- **Active cards for a subagent** = `min(versionSlots, ExampleCard pieces orthogonally adjacent to its 2×2 slot)`, where versionSlots are 3 / 5 / 7 / 8 for v1 / v2 / v3.5 Turbo / v4. A shared Example Card counts for both slots it touches. Active cards are the top-N of the deck in priority order; the Default card is always active in addition.
- Slice piece kinds: System Prompt (I3, pinned), Skill (1×2), Tool (1×1), Example Card (1×1), Subagent Slot (2×2), Grafted Move (species-defined 3–4 cells), Cache (1×1), Junk Token (1×1, battle-only), Compaction Summary (1×1, battle-only).

### Statuses and guards
- One major status at a time (Rate Limited, Deprecated, Quantized); volatile statuses stack (Hallucinating, Prompt Injected, Overfit, Glazed, Drift).
- Effects, durations and cures exactly as the bible's status table.
- Guards (Guardrail, Refusal, Unit Test) are priority +4 (Unit Test +3). Consecutive use succeeds at 1/1, then 1/3, then 1/9 (uses the status-proc draw).

### Cards, decks and traces
- **Card:** `{ id, subject, condition, move, target }`. Subjects: self, orchestrator, foe. Conditions come from the bible's 12 categories; thresholds only at 25 / 50 / 75%. Targets: the bible's 8 selectors. All enums — no free text — so decks serialize to small JSON and an LLM can later be constrained to them.
- **Deck:** ordered cards plus a non-removable **Default** card at the bottom.
- **Evaluation:** top to bottom; the first card whose condition holds and whose move is usable (enough context or overflow allowed, not disabled by status) fires.
- **Obedience** comes from the deck's G band: Robust 100%, Stable 95%, Brittle 85% (obedience draw). A Brittle subagent with no matching card repeats its most-represented move instead of Default, and emits a `BrittleRepeat` event (the UI later shows the speech bubble).
- **Specialist:** if ≥ 50% of a deck's cards carry a `recordedFrom` id matching the current opponent, the subagent gets +15% damage against it.
- **Trace:** every subagent and Autopilot action emits `{ firedCardId, skipped: [{ cardId, reason }] }`, with reasons such as `conditionFalse`, `insufficientContext`, `moveDisabled`, `notActive`.
- **Directive** (2 cells, uses the orchestrator's command) replaces one subagent's next action. **Policy Update** (2 cells) inserts a team-wide card at the top of every allied deck for 3 rounds. **Swap** exchanges an active subagent with a bench creature.

### Generalization
- An **Eval Suite** is a fixed list of 12 scenario snapshots (a battle state plus the expected-wasteful-action rules), authored as data per region. The slice ships one suite for the Deprecated Forest.
- `C = distinct condition categories ÷ min(activeSlots, 6)`, capped at 1.
- `R = pairs of cards with the same category and the same move ÷ total card pairs` (0 when fewer than 2 cards).
- `H = share of the 12 Unseen scenarios where a non-Default card fires and the action isn't flagged wasteful`.
- `G = round(100 × (0.35·C + 0.45·H + 0.20·(1 − R)))`, computed in basis points so it is integer-exact.
- Bands: Robust ≥ 70, Stable 40–69, Brittle < 40. "Seen" bars use scenarios derived from the deck's own recorded examples.

### Events and the battle log
- `BattleEvent` is a discriminated union: `RoundStart`, `IntentsPlanned`, `ActionStarted`, `CardTrace`, `MoveUsed`, `Missed`, `Damage`, `Crit`, `TypeEffect`, `StatusApplied`, `StatusBlocked`, `StatusExpired`, `ContextAdded`, `ContextOverflow`, `DriftChanged`, `Compacted`, `PieceCompacted`, `ObservationGained`, `HandoffChain`, `Swapped`, `Fainted`, `HeadlessMode`, `BrittleRepeat`, `RoundEnd`, `BattleEnd`.
- The **battle log** is `{ engineVersion, seed, setupHash, setup, rounds: RoundCommand[] }`. It is replay-complete: `replay(log)` re-runs the battle and returns the same events. Events are derived, never stored as the source of truth.
- A log recorded on a different `ENGINE_VERSION` is refused by `replay()` with a typed error; the caller decides whether to re-simulate (that policy belongs to sub-project 5).

---

## 6. Content data

- Content lives in `packages/engine/src/content/` as typed, `as const` TypeScript modules: `types.ts` (the 8×8 chart in basis points), `moves.ts` (57 launch moves + 17 signatures), `statuses.ts`, `species.ts` (17 slice species).
- Move effects are expressed with a small, closed set of **effect primitives** (damage, multi-hit, heal, stage change, apply status, cure, add tokens, free tokens, reveal intent, swap order, charge/telegraph, conditional power, copy, guard). Every move in the bible maps onto these primitives; a move needing a new primitive means adding the primitive with tests, never special-casing a move inside the battle loop.
- Species stats are **placeholders** chosen so the starter triangle and slice fights land near the bible's targets; sub-project 4 replaces them using this harness.
- A content test checks referential integrity: every move a species knows exists, every signature resolves, the type chart is complete, and each type has exactly two 2× matchups and two ½ resistances.

---

## 7. Error handling

- **Invalid setup or grid:** `validateSetup` / `validateGrid` return every problem as a typed error list (`{ code, path, message }`). `createBattle` refuses invalid setups.
- **Invalid commands** (illegal move, bad target, insufficient context when the move forbids overflow, acting while skipped): `submitRound` returns `{ error }` and leaves the state untouched. It never throws for player-caused problems.
- **Engine bugs** (an invariant breaks, e.g., HP below 0 or token count above window + overflow): the engine throws an `EngineInvariantError` with the round, action and seed. Invariant checks run in every build because sims and ghost validation need to catch them.
- **Termination:** the 50-round cap guarantees every battle ends; the fuzz suite asserts it.

---

## 8. Testing

- **Framework:** Vitest; `fast-check` for property tests; Vitest browser mode (Playwright Chromium) for the cross-runtime golden run.
- **Unit tests** per unit: PRNG known-answer vectors; damage/accuracy/crit tables against hand-computed cases; type-chart regularity; grid validation and adjacency cases; context overflow, compaction order and /clear; each status's apply/tick/cure; deck evaluation order, fall-through and traces; G formula against worked examples.
- **Golden files:** ~30 recorded battles covering every move, status and lever. The log plus a hash of the full event stream are committed; Node and Chromium must match byte-for-byte.
- **Property tests:** HP stays in [0, max]; token counts never exceed the window plus allowed overflow; every battle terminates; `replay(log)` equals the original result; same seed + same inputs → same events.
- **Metamorphic test:** swapping sides with the mirrored setup mirrors the outcome.
- **Scenario tests:** the broken-deck tutorial (criterion 5); Prompt Injected turning an "always strongest attack" deck against its own ally; Headless Mode continuing after an orchestrator KO.
- **Fuzz:** 10,000 random legal battles in CI nightly; 500 on every push.
- **TDD:** each unit is built test-first.

---

## 9. Simulator (`@latentia/sim`)

- Archetype decks defined as data: Speed rush, Reasoning charge-nuke, Open swarm, Code lock, Voice injection, Memory stall, Search anti-hallucination, and mixed builds — about 20 total, each with a fixed team, grid and Autopilot deck.
- Commands:
  - `round-robin --seeds 1000` — every archetype vs every other.
  - `matchup <a> <b> --seeds N` — one pairing, with round-length histogram.
  - `temperature-sweep` — always-T0 vs always-T4 and every notch in between.
  - `graft-vs-spinup` — mirror sims for both distillation choices on the same species.
  - `fuzz --battles N`.
  - `search --archetype <a>` — hill-climbing over 8-card decks to find dominant strategies.
- Each run writes `reports/<command>-<date>.md` and a CSV: win rates with 95% intervals, median rounds, and a pass/fail table against the bible's balance targets (≤ 55% vs field, worst matchup ≥ 30/70, starter triangle ~60/40, T0 vs T4 within ~5 points, graft vs spin-up 45–55%, median fight 5–8 rounds, first-mover 50 ± 2%).
- Runs in one Node process; the round-robin target is under 10 minutes.

---

## 10. Tooling and conventions

- Node 22, pnpm workspaces, TypeScript `strict` with `noUncheckedIndexedAccess`.
- ESLint with `no-restricted-globals` / `no-restricted-properties` banning `Math.random`, `Math.pow`, `Date`, `performance` and floating-point helpers inside `packages/engine/src`.
- `@latentia/engine` has zero runtime dependencies, so it runs unchanged in the browser, a Capacitor WebView, a desktop wrapper and a Supabase Edge Function.
- Conventional commits, authored as CosmonautJones.

---

## 11. Decisions made in this spec (not in the bible)

1. Concrete stat formulas, LevelFactor, and basis-point values for stages.
2. sfc32 as the PRNG, the bit-splitting rule for multi-value draws, and one round-start draw per creature.
3. Side composition: orchestrator + 0–2 active subagents + 0–3 bench; wild battles allow up to 2 companions.
4. `structuredClone`-per-round immutability at the API boundary.
5. Move effects as a closed set of primitives.
6. Version-mismatched logs are refused, not silently re-simulated.
7. The 50-round cap resolves on total remaining HP%; an exact tie is a draw.

## 12. Open questions (resolved by this sub-project's harness, not before)

- Is the 4-cell headroom floor at L1 fun or punishing? (Fallback lever: an off-grid scratchpad of 2–4 cells.)
- Should G-band obedience apply in ranked ghost battles?
- Final placeholder stats for the 17 slice species.
