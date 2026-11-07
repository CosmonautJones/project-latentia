# Battle Engine & Simulator — Design Spec

- **Project:** Latentia (working codename; the region name, not a final title)
- **Sub-project:** 1 of 5 — the headless battle engine and balance simulator
- **Date:** 2026-11-07
- **Status:** Revision 3 — incorporates two rounds of independent review
- **Source of truth for game rules:** `docs/design-bible.md` (sections "One Context Grid…", "Battles run on eight types…", "Training is example cards…", "Determinism makes ghosts…"). This spec turns those rules into a buildable engine. Where this spec and the bible differ, this spec wins and the bible gets updated.

Normative words: **must** / **must not** are requirements; everything marked *tunable* is a starting value the simulator will adjust.

---

## 1. Why this comes first

Every risky unknown in the game is numerical: L1 headroom, the temperature dial, graft vs spin-up, the type triangle, fight length. A headless, deterministic simulator answers all of them before any art is drawn. The same engine later re-validates ghosts on the server and judges LLM-compiled decks.

### The five sub-projects

| # | Sub-project | Bible milestones | Depends on |
|---|---|---|---|
| **1** | **Battle engine & simulator** (this spec) | 1–3 | — |
| 2 | Game shell & battle scene: Phaser 4 + Vite, integer scaling, portrait/desktop layouts, input, greybox battle scene, grid editor | 4–5 | 1 |
| 3 | Overworld & progression: Tiled loader, movement, greybox maps and puzzles, distillation, XP, evolution | 6–8 | 1, 2 |
| 4 | Slice content, writing, art & audio | 9–12 | 2, 3 |
| 5 | Ghosts, shareables & launch: Supabase, re-simulation, trainer card, PWA, Steam page | 13–14 | 1–4 |

Each sub-project gets its own spec → plan → build cycle.

### Three build phases inside this sub-project

Each phase ends with an **eval checkpoint** (§12) before the next phase starts.

| Phase | Builds | Ends when |
|---|---|---|
| **A. Engine core** | rng, math, content, events, grid, context, status, the round loop with player-commanded actions, replay, golden files | Criteria 1, 2, 4, 7 pass |
| **B. Training** | cards, deck evaluation, intents, traces, levers, Headless Mode, generalization | Criteria 3 and 5 pass |
| **C. Simulator** | archetype decks, sim commands, `sim targets`, first balance report, budgeted deck search | Criterion 6 passes |

---

## 2. Goal and success criteria

**Goal:** a pure-TypeScript package that runs complete, deterministic battles from a setup, a seed and a command source, explains every action, plus a CLI harness that runs thousands of battles and reports balance against the bible's targets.

1. **Determinism:** the golden-file suite produces an identical **event-stream hash** on Node 22, Playwright Chromium and Playwright WebKit (WebKit stands in for the iOS WebView).
2. **Replay:** for every golden battle, `replay(log)` reproduces the same result and the same event-stream hash.
3. **Legibility:** every deck-driven action emits a trace naming the card that fired and every skipped card with a reason. Intents are available before the player commits.
4. **Robustness:** 10,000 random legal battles finish with no exceptions, no invariant errors, and every battle ends by the round cap.
5. **Training works:** against a fixed opponent (the slice's first Deprecated Forest trainer at fixed levels), the "broken deck" scenario (heal card ordered below attack card) wins ≤ 10% of 200 seeds, and the same deck with those two cards swapped wins ≥ 90%.
6. **Balance harness:** `pnpm sim targets` measures every bible balance target with its own setup and writes a report marking each **pass / fail / inconclusive** (§9). Hitting the targets is tuning work done with this tool; the deliverable is the tool and the first report.
7. **Performance:** mean ≤ 1.2 ms per simulated battle (micro-benchmark gate), so the full round-robin (380 ordered pairings × 1,000 seeds) runs in under 10 minutes in one process with headroom. Phase A measures player-commanded battles; Phases B and C re-measure on a deck-driven set (Autopilot on both sides).

---

## 3. Scope

### In scope
- Type chart, stats, stat stages, damage, accuracy and crit math (integer, fixed-point)
- Temperature dial (orchestrator per round; subagents use a trained temperature)
- Context tokens, headroom, Drift, Compact, /clear, Observation and Junk tokens, forced compaction of loadout pieces
- The Context Grid **data model and pure validation**
- The 8 statuses and the guard moves
- All 57 launch moves, plus signature moves and passives for the 17 slice species, expressed through effect primitives (§6)
- Card grammar, deck evaluation, intents, re-planning, traces, obedience
- Directive, Policy Update, Swap, Headless Mode, bench auto-fill, Autopilot decks
- Handoff Chain, Efficient Answer refund, Specialist bonus
- Generalization (G) and the Eval Suite format
- sfc32 PRNG with a normative draw table, engine versioning, canonical event hashing, battle logs and replay
- Slice content with **placeholder** species stats
- The simulation CLI (§9)

### Out of scope (later sub-projects or later versions)
- Rendering, Phaser, UI, the grid editor (sub-project 2)
- Overworld, XP awarding, distillation, evolution, leveling (sub-project 3). The engine takes level, version and deck as inputs and never changes them.
- Final species stats and flavour text (sub-project 4)
- Supabase, ghost services, matchmaking (sub-project 5)
- The LLM strategy compiler (post-slice)
- **Summons/decoys and items.** There is no item system and no mid-battle creature creation in v1. The slice uses simplified versions (§6): Forkling's decoy is a one-hit shield, Slopling's multiplying is a stacking buff, Vibrat's "spawns a wild bug" adds Junk tokens, Scrapion's theft steals one positive stat stage.
- Grid pieces marked "Later" in the bible. The grid model must accept new piece kinds without changing existing ones.
- The Preview-tier "Deprecated move" quirk (an evolution feature).

---

## 4. Architecture

### Repository layout (pnpm workspaces)

```
latentia/
  packages/
    engine/              # @latentia/engine — zero runtime dependencies
      src/
        rng/             # sfc32, draw table helpers
        math/            # the only place `/` and basis-point helpers live
        content/         # type chart, moves, statuses, species (typed, frozen data)
        events/          # event + log types, canonical JSON, FNV-1a-64 hash
        grid/            # layout model, validation, adjacency, active cards
        context/         # token store, overflow, compaction
        status/          # apply, block, tick, expire, cure
        cards/           # card grammar, condition evaluation, deck evaluator, traces
        generalization/  # C, R, H, G and the Eval Suite runner
        battle/          # setup validation, round loop, action resolution, replay
        index.ts         # public API
      test/golden/       # golden battle logs + expected event hashes
    sim/                 # @latentia/sim — CLI harness, archetype decks, reports
  docs/
```

`apps/game` (Phaser) arrives in sub-project 2 and imports `@latentia/engine` only through `index.ts`.

### Units and dependencies (acyclic)

| Unit | Does | Depends on |
|---|---|---|
| `rng` | sfc32; `drawAction()` → six draws; `drawRoundStart()` → two draws per creature | — |
| `math` | Fixed-point and basis-point arithmetic, stat formulas, damage, accuracy, crit | — |
| `content` | Type chart, moves, statuses, species | — |
| `events` | `BattleEvent` union, `BattleLog`, canonical JSON, event-stream hash | — |
| `grid` | Validate layouts; adjacency; active-card counts | `content` |
| `context` | Per-creature token store: add, overflow → Drift, compact, clear, forced compaction | `grid`, `events` |
| `status` | Apply, block, tick, expire, cure | `content`, `events` |
| `cards` | Evaluate a deck against a read-only battle view → card, move, target, trace | `content`, `math` |
| `generalization` | C, R, H, G from a deck, an Eval Suite and active slots | `cards`, `content` |
| `battle` | Setup validation, round loop, actions, win check, `replay` | all units except `generalization` |

`generalization` evaluates Eval Suite snapshots with `cards` only. It never runs a battle. **G is a setup input**: the caller computes it with `computeGeneralization` and passes it in. Sub-project 5's ghost server recomputes it before accepting an upload.

### Public API (sketch)

```ts
export const ENGINE_VERSION: string;   // semver; bumps on any rule or content change

export function validateSetup(setup: BattleSetup): ValidationResult;
export function createBattle(setup: BattleSetup, seed: SeedHex): BattleState;

export function getIntents(state: BattleState): Intent[];
export function submitRound(state: BattleState, cmd: RoundCommand):
  { state: BattleState; events: BattleEvent[] } | { error: CommandError };

export function simulate(setup: BattleSetup, seed: SeedHex, commands: CommandSource): BattleResult;
export function replay(log: BattleLog): BattleResult | { error: ReplayError };

export function validateGrid(grid: GridLayout, level: number): ValidationResult;
export function activeCardCount(grid: GridLayout, slotId: string, version: Version): number;
export function computeGeneralization(deck: Deck, suite: EvalSuite, activeSlots: number): GeneralizationReport;
export function eventStreamHash(events: readonly BattleEvent[]): string;   // 16 hex chars
```

### State representation
- `BattleState` **must** be plain JSON-compatible data: numbers, strings, booleans, arrays and plain objects. No classes, functions, `Map`, `Set`, `undefined` values, or references to content objects — content is referenced by id only.
- `submitRound` clones its input once (`structuredClone`) and mutates the clone, so callers always see immutable states.
- `simulate` clones the setup's state once, then mutates in place for the whole battle.

---

## 5. Battle model

### Sides and roster
- Each side has one **orchestrator**, **0–2 active subagents** and **0–3 bench** creatures. A wild battle is one wild model plus up to 2 companions acting from built-in decks.
- **Canonical order** (used for draws, ties and iteration everywhere): side A orchestrator, A active slot 1, A active slot 2, A bench 1–3, then side B in the same order. Every creature has a fixed canonical index for the whole battle.
- The orchestrator is never benched. If it is KO'd, its side enters **Headless Mode**: its command is skipped and its subagents keep acting from their decks.
- **Bench auto-fill:** at end of round, each empty active slot is filled by the first living bench creature in bench order.
- A side loses when every creature on it is KO'd. Both sides KO'd in the same action → draw.
- AI-controlled orchestrators (trainers, ghosts) use an **Autopilot deck**: the same card grammar, up to 12 cards.

### Stats (*tunable*)
- Five stats: HP, Compute (attack), Robustness (defense), Latency (speed, higher is faster), Ctx (window size).
- `HP = floor(2 × baseHP × L / 100) + L + 10`; `Stat = floor(2 × base × L / 100) + 5`.
- Stat stages −3…+3 → **5714, 6667, 8000, 10000, 12500, 15000, 17500** basis points (nearest integer to ×1/1.75, ×1/1.5, ×1/1.25, ×1, ×1.25, ×1.5, ×1.75). Effective stat = `floor(stat × stageBp / 10000)`.
- A subagent's Ctx is its own window (species value 10–16, default 12). The orchestrator's in-battle window is its grid **headroom**.

### Round structure
1. **Round start.** Take two round-start draws for **every** creature in canonical order, alive or not (draw table below). Resolve round-start effects.
2. **Plan.** Evaluate every subagent deck and every Autopilot deck → one `Intent` per creature (move, target, card id). Apply Directive and Policy Update from the `RoundCommand` (see Levers), then re-derive intents. The player's command sets temperature and the orchestrator's action.
3. **Sort.** Order actions by priority bracket (+4 … −3), then effective Latency (descending), then round-start tie-break value (descending), then canonical index (ascending). The order is fixed after Sort; only an explicit Rerank changes it. Sorted entries belong to **creatures**, not slots: a creature that leaves the field mid-round (Swap, Early Exit, force-bench) skips its entry but still consumes its draws, and a creature that arrives mid-round does not act until the next round.
4. **Resolve each action.** Every creature in the sorted list consumes its **six action draws whether or not it acts** — including Rate Limited skips, the /clear skip, Headless skips and creatures KO'd before their turn. Then, if it acts: re-validate the card; check statuses; pay context; roll; apply effects; update the Handoff Chain.
5. **End of round.** Statuses tick and expire; timed field effects tick; Deprecated counts down; bench creatures recover 2 context cells; empty slots auto-fill; win check.
6. **Cap.** After round 50, compare remaining HP across all creatures with integers: side A wins if `ΣhpA × ΣmaxB > ΣhpB × ΣmaxA`, side B wins if less, draw if equal.

### Draw table (normative)

PRNG: **sfc32** (Chris Doty-Humphrey's Small Fast Counter, 32-bit variant, as published in PractRand). The seed is 32 hex characters → four uint32 words, in order. The first 12 outputs are discarded after seeding. No other randomness source exists in the engine.

Each draw `d` is a uint32 and yields at most two values: `lo(d, a) = (d & 0xFFFF) % a` and `hi(d, b) = (d >>> 16) % b`, with a, b ≤ 65536. A probability check "p%" passes when the value `< p`, with modulus 100.

**Round start (two draws per creature, canonical order):**

| Draw | lo | hi |
|---|---|---|
| R1 | tie-break value (`& 0xFFFF`, no modulus) | seeded coin (mod 2) |
| R2 | seeded-random-foe pick (mod living foes at plan time) | passive proc (mod 100) — species passives with a chance (e.g., Blitzr's 15%) |

**Per action (six draws, in this order, per creature in sorted order):**

| Draw | lo | hi |
|---|---|---|
| D1 obedience | obedience check (mod 100) | Drift random-move check (mod 100; chance = 5% × Drift stacks) |
| D2 status | Rate Limited skip check (mod 100; 25%) | hallucination check (mod 100; chance = Hallucinating status T0 12 / T1–T2 25 / T3–T4 50, plus self-hallucination T3 5 / T4 12, capped at 100) |
| D3 accuracy | accuracy check (mod 100), **or** guard success (mod 729) for guard moves | hallucination retarget (mod living combatants **excluding the user**, canonical order) |
| D4 crit | crit check (mod 48) | random-move pick (mod usable moves) for hallucination or Drift. A Drift random move keeps the original target if legal, otherwise uses the move's default selector |
| D5 roll | damage roll (mod roll width for the temperature) | multi-hit count (mod hit-count span) |
| D6 rider | move secondary-effect check (mod 100; Segfault 20%, Adversarial Patch 30%, …) | status duration or secondary magnitude (mod span; e.g., Hallucinating 2–4 → `2 + hi % 3`) |

Every action's six raw draws are recorded on its `ActionStarted` event, which powers the later "show the rolls" view.

### Damage (fixed point, normative order)
Damage is carried at ×10000 precision so small modifiers matter at slice levels.

1. **Effective power `P`**, in this order, each multiplicative step `P = floor(P × m / 10000)`: start from the move's base power → add additive bonuses (Chain of Thought, Long-Term Recall, Leaderboard Flex) → conditional multipliers (e.g., Proof by Contradiction ×2 = 20000, Wild ×1.5 = 15000) → Tool steps (11000 each) → Compaction Summary (5000).
2. `LF = floor(2 × L / 5) + 2`.
3. `d = floor(P × Atk × LF × 10000 / (Def × 50))` using effective Atk and Def. A crit ignores the defender's positive Robustness stages.
4. Apply each modifier `m` (basis points) in this exact order with `d = floor(d × m / 10000)`, skipping any that don't apply: **Type** (chart product, clamped 2500–30000) → **T4 super-effective** (12500) → **Native** same-type (12500) → **Crit** (15000) → **Roll** (temperature roll, as basis points) → **Handoff** (11000 / 12000 / 13000) → **Specialist** (11500) → **Overfit** (11500 same target / 7000 other) → **Glazed** (7000 vs its glazer) → **Observation** (9000) → **Guard** (Guardrail, or Captcha Wall against a non-Speed move: 5000) → **Refusal penalty / Earnest Apology** (5000 / 7000). A Captcha Wall block of a Speed move counts as a miss.
5. `damage = floor(d / 10000) + 1`.
6. Every intermediate value **must** satisfy `Number.isSafeInteger`; the engine asserts it. Two basis-point values are never multiplied without dividing by 10000 in between.
7. Multi-hit moves roll accuracy, crit and damage roll once and apply them to every hit; the whole move counts as one Handoff hit.

A unit test **must** show that a 10% modifier changes damage for a typical L5 attacker.

### Accuracy, crit and temperature
- **Accuracy:** hit when `lo(D3, 100) < clamp(MoveAcc + TempMod − 8 × Drift + 10 × (AccStages − EvaStages), 30, 100)`. Robust subagents get +5 against foes not in their recorded examples.
- **Crit:** temperature sets the base crit stage (T0 = 0, T1 = 1, T2 = 2, T3 = 3, T4 = 4); move and type bonuses add stages; the cap is 6. Stage thresholds out of 48: 0, 1, 2, 4, 8, 24, 48. Crit when `lo(D4, 48) < threshold`. (Reasoning's T0/T1 bonus is +1 stage.)
- **Temperature:** the five notches T0–T4 and their roll ranges, accuracy modifiers and self-hallucination chances come from the bible's temperature table. A roll range `a–b%` becomes roll basis points `a×100 + lo(D5, b−a+1)×100`; T0 has width 1 (always 100%).
- **Wild riders** fire automatically at T3+ with no draw. Each move defines its own `wild` effect and optional `wildT4` effect; T4 does not double a value implicitly.

### Context (the grid rule)
- The orchestrator's in-battle window is its grid headroom. Loadout pieces are fixed at battle start.
- Tokens are stored in an ordered list; age order = insertion order.
- A move costing *n* cells adds *n* tokens. A buff move's cost tokens are tagged with the buff — they are not extra tokens. If a tagged token is summarized, the buff loses 1 stage.
- **Overflow:** when a payment needs more cells than are free, each missing cell immediately adds 1 Drift (max 5). Overflow is never stored as tokens.
- The first sighting of each enemy move adds 1 Observation token if a cell is free; otherwise nothing happens.
- **Forced tokens** (Junk from Filibuster, Memory Leak, Context Rot): if a cell is free, the token takes it. Otherwise the **compactable loadout piece with the lowest index** in `GridLayout.pieces` becomes a 1×1 Summary, freeing its other cells, and the token takes one of them. A piece is **compactable** only if it is not pinned, not orthogonally adjacent to a Cache, covers **at least 2 cells**, and is **not already a Summary**. If nothing is compactable (and always for subagents, which have no loadout), the forced token adds 1 Drift instead.
- **Summary effects by piece kind** (only multi-cell kinds can compact): Skill or Grafted Move → that move at 50% power. Subagent Slot → the slot is **removed from the active slots for the rest of the battle** and its subagent is force-benched. System Prompt is pinned and never compacts. 1×1 pieces (Tool, Example Card, Cache) never compact.
- **Force-benching** (by compaction or Deprecated) moves the creature to the **end** of the bench order; the bench may exceed 3 during a battle.
- **Compact** (0 cost, priority −2): pairs the six oldest tokens as (1,2), (3,4), (5,6) into three summary tokens (with fewer than six, pair what exists; an odd last token stays). Summaries can be compacted again. Clears 1 Drift.
- **/clear** (priority −3): removes all tokens, stat stages and Drift. The orchestrator's next command is skipped (it still consumes its draws). Subagents keep acting.
- **Efficient Answer:** a super-effective hit removes the attacker's oldest non-Junk token.
- Subagents run the same rules on their own Ctx window. Battle end restores everything in the reported result; the caller's loadout is never mutated.

### Grid model (data and validation only)
- `GridLayout = { width, height, pieces: PlacedPiece[] }`. A `PlacedPiece` has `id`, `kind`, `shape` (cell offsets), `anchor`, `rotation` (0/90/180/270) and kind-specific data (e.g., which subagent a slot holds). The array order is the compaction order.
- Grid size by orchestrator level: 4×4 (L1), 5×4 (L4), 5×5 (L7), 6×5 (L10), 6×6 (L13). The engine receives the size; choosing the growing edge belongs to sub-project 3.
- `validateGrid` returns **every** error: bounds, overlap, exactly one System Prompt, at most 4 Skills, and the **headroom floor of 4 empty cells**.
- Adjacency is orthogonal. A Tool adds one **effect step** (+1000 bp to the primary magnitude: power for damage moves, percentage for heals; no effect on stage-only moves) to each adjacent Skill.
- **Active cards for a subagent** = `min(versionSlots, Example Cards orthogonally adjacent to its 2×2 slot)`, with versionSlots 3 / 5 / 7 / 8 for v1 / v2 / v3.5 Turbo / v4. A shared Example Card counts for both slots. Active cards are the top-N of the deck; Default is always active in addition.
- Slice piece kinds: System Prompt (I3, pinned), Skill (1×2), Tool (1×1), Example Card (1×1), Subagent Slot (2×2), Grafted Move (species-defined, 3–4 cells), Cache (1×1), plus the battle-only Junk Token and Compaction Summary (1×1).

### Statuses and guards
- One major status at a time (Rate Limited, Deprecated, Quantized). Volatile statuses (Hallucinating, Prompt Injected, Overfit, Glazed) stack with each other; Drift stacks with itself. Re-applying a held status other than Drift emits `StatusBlocked`.
- Effects, durations and cures follow the bible's status table; random durations use D6 `hi` of the applying action.
- **Prompt Injected:** the inflicter's choice (move and target from the victim's moveset) is fixed when the status is applied — from the inflicter's command (player) or its deck's injection preference (deck/Autopilot), defaulting to the victim's highest-power move against the victim's lowest-HP ally.
- **Deprecated:** at 0 the creature is force-benched at 1 HP, or KO'd if it is an orchestrator or there is no bench.
- **Guards** (Guardrail, Refusal, Captcha Wall at +4; Unit Test at +3) share one consecutive-use counter per creature. With k = consecutive guard uses before this one, success is `lo(D3, 729) < [729, 243, 81, 27, 9, 3][k]` (1/1, 1/3, 1/9, 1/27, 1/81, 1/243); k ≥ 6 always fails. Any non-guard action resets the counter.

### Cards, decks and traces
- **Card:** `{ id, subject, condition, move, target, allowOverflow?, recordedFrom? }`. All fields are enums or ids — no free text.
- Subjects: self, orchestrator, foe. A **foe** condition holds if **any** living foe matches; the target selector then picks among foes.
- Conditions: the bible's 12 categories. Percent thresholds are 25 / 50 / 75 only, written as `below` (`<`) or `atLeast` (`≥`), compared by cross-multiplication (`hp × 100 < max × 25`).
- Targets: the bible's 8 selectors. "Seeded random foe" uses the creature's R2 `lo` pick at plan time, so it shows in the intent.
- **Evaluation:** top to bottom over active cards, then Default. A card fires when its condition holds and its move is usable. A move costing more cells than are free is skipped with `insufficientContext` unless the card has `allowOverflow: true`.
- **Obedience:** Robust 100%, Stable 95%, Brittle 85% (`lo(D1, 100)`). On a failed roll the creature uses the **next matching card below** the one that fired (or Default).
- **Brittle repeat:** when no non-Default card matches, a Brittle creature uses its most-represented move in the deck (ties → first in deck order) and emits `BrittleRepeat`.
- **Re-planning:** at resolution, if the intent's condition is now false or its target fainted, evaluation continues from the next card down, and the intent is marked `replanned`.
- **Specialist:** if ≥ 50% of a deck's cards have `recordedFrom` equal to the current opponent id, the creature deals +15% damage to that opponent.
- **Trace:** every deck-driven action emits `CardTrace { firedCardId, skipped: [{ cardId, reason }] }`, reasons ∈ `conditionFalse`, `insufficientContext`, `moveDisabled`, `notActive`, `disobeyed`.

### Orchestrator levers (timing is normative)
- **Directive** (2 cells, uses the orchestrator's action): applied at plan time; replaces one allied subagent's intent for this round with the given move and target.
- **Policy Update** (2 cells, uses the orchestrator's action): the `RoundCommand` carries one card. It is inserted above every allied deck's active cards for rounds *r* to *r*+2. It uses no card slot.
- **Swap** and **Early Exit** resolve at priority +3. The incoming creature is the chosen bench creature (Swap) or the first living bench creature (Early Exit).

### Generalization
- An **Eval Suite** is 12 scenario snapshots per region (a read-only battle view plus "wasteful action" rules, e.g., healing at full HP), authored as data. The slice ships one suite (Deprecated Forest).
- Default cards are excluded from C, R and the pair count.
- `C = min(1, distinct condition categories ÷ min(activeSlots, 6))`.
- `R = card pairs with the same category and the same move ÷ total card pairs` (0 with fewer than 2 cards).
- `H = scenarios where a non-Default card fires and the action is not wasteful ÷ 12`.
- `G = round_half_up(100 × (0.35·C + 0.45·H + 0.20·(1 − R)))`, computed as an exact rational with integers.
- Bands: Robust ≥ 70, Stable 40–69, Brittle < 40.

### Events, logs and hashing
- `BattleEvent` is a discriminated union: `RoundStart`, `IntentsPlanned`, `ActionStarted` (with raw draws), `CardTrace`, `MoveUsed`, `Missed`, `Damage`, `Crit`, `TypeEffect`, `StatusApplied`, `StatusBlocked`, `StatusExpired`, `StatusCured`, `StageChanged`, `StageStolen`, `Healed`, `ActionSkipped { reason }`, `GuardResolved`, `ShieldAbsorbed`, `FieldEffectStarted`, `FieldEffectEnded`, `Revealed`, `ContextAdded`, `DriftChanged`, `Compacted`, `PieceCompacted`, `ObservationGained`, `HandoffChain`, `Swapped`, `Fainted`, `HeadlessMode`, `BrittleRepeat`, `RoundEnd`, `BattleEnd`.
- **BattleLog** = `{ engineVersion, seed, setup, rounds: RoundCommand[] }`. It holds inputs only; events are derived by replay.
- **Canonical JSON:** object keys sorted by UTF-16 code unit, no whitespace, integers only (the engine never emits non-integers).
- **Event-stream hash:** FNV-1a 64-bit over the **UTF-8 bytes** (`TextEncoder`) of the canonical JSON of the event array, multiplied with 16-bit limbs (no BigInt), rendered as 16 lowercase hex characters. Known-answer vectors: `""` → `cbf29ce484222325`, `"a"` → `af63dc4c8601ec8c`.
- `replay()` refuses a log whose `engineVersion` differs from `ENGINE_VERSION` with a typed `ReplayError`; the re-simulation policy belongs to sub-project 5.

---

## 6. Content data and effect primitives

- Content lives in `packages/engine/src/content/` as typed `as const` modules: `types.ts` (8×8 chart in basis points), `moves.ts` (57 launch moves + slice signatures), `statuses.ts`, `species.ts` (17 slice species, **placeholder** stats).
- Every move is data built from a closed set of **effect primitives**. A move that needs new behaviour gets a new primitive with tests — never a special case in the battle loop.

| Primitive | Covers (examples) |
|---|---|
| `damage` (power, accuracy, priority, conditional power) | most attacks; Proof by Contradiction, Leaderboard Flex, Long-Term Recall, Chain of Thought |
| `multiHit` (min, max, per-hit power) | Speculative Decoding, Swarm of Fine-Tunes, Agentoad's Tool Call |
| `charge` (telegraphed, rounds, interrupt penalty) | Deliberate, Deep Research |
| `heal` (percent) | Community Patch, Hotfix, Earnest Apology |
| `stage` (stat, delta, who) | Step-Back Prompt, Low Latency, Hype Train, Permissive License |
| `applyStatus` / `cure` | Throttle, Infinite Loop, Flattery, Ground Truth, Citation Needed |
| `tokens` (add Junk to target / free own) | Filibuster, Refactor, Efficient Answer |
| `timedField` (effect, rounds, who) | Memory Leak, Saliency Map, Temperature Spike |
| `nextActionModifier` (who, modifier) | Refusal's penalty, Segfault, Embedding Cache, Bounding Box |
| `snapshot` / `revert` | Save State, Screenshot |
| `reveal` (intents, deck card, rounds) | Socratic Method, Stack Trace, Red Team |
| `reorder` | Rerank |
| `copy` (buff / last ally move) | Fork, Episodic Replay, Merge Conflict |
| `guard` (kind) | Guardrail, Refusal, Unit Test, Captcha Wall |
| `shield` (hits) | Forkling's decoy (simplified) |
| `stealStage` | Scrapion's theft (simplified) |
| `passive` (trigger, effect, chance) | Disclaimer, Move Fast, Slopling's stacking buff (simplified), Vibrat's Junk (simplified) |

- A content test checks: every species' moves and signature exist; the chart has all 64 cells; every row **and** column has exactly two 20000 and two 5000 entries (verified for the bible's chart); every move maps to known primitives; every chance and duration names its draw slot.

---

## 7. Error handling

- **Invalid setup or grid:** `validateSetup` / `validateGrid` return every problem as `{ code, path, message }`. `createBattle` refuses invalid setups.
- **Invalid commands** (illegal move or target, acting while skipped, Directive on a KO'd subagent): `submitRound` returns `{ error }` and leaves state untouched. It never throws for caller mistakes.
- **Engine bugs** (HP outside [0, max], tokens beyond the window, a non-safe integer, a cycle in turn order): throw `EngineInvariantError` with round, action, canonical index and seed. Invariant checks run in every build.
- **Termination:** the 50-round cap guarantees every battle ends.

---

## 8. Testing

- **Tools:** Vitest; `fast-check` for properties; Vitest browser mode with Playwright Chromium and WebKit for the cross-runtime golden run.
- **Unit tests** per unit, written first (TDD): sfc32 known-answer vectors after the 12-output discard; draw-table slot usage; damage worked examples including the L5 10%-modifier test; accuracy and crit thresholds; chart regularity; grid validation, adjacency and active cards; context overflow, forced compaction order, Compact pairing, /clear; each status; deck evaluation, fall-through, obedience and traces; G worked examples.
- **Golden files:** ~30 recorded battles covering every move, status and lever. Each stores its log and expected event-stream hash; all three runtimes must match.
- **Property tests:** HP stays in [0, max]; tokens never exceed the window; every battle terminates; `replay(log)` hash equals the original; same seed and inputs → same hash; every action consumes exactly six draws.
- **Metamorphic test:** swapping sides with the mirrored setup mirrors the outcome.
- **Scenario tests:** the broken-deck tutorial (criterion 5); Prompt Injected turning an "always strongest attack" deck against its own ally; Headless Mode with bench auto-fill.
- **Fuzz:** 500 random legal battles on every push; 10,000 nightly.
- **Micro-benchmark:** mean ms per battle over a fixed 2,000-battle set; fails above 1.2 ms.

---

## 9. Simulator (`@latentia/sim`)

- ~20 archetype decks as data (Speed rush, Reasoning charge-nuke, Open swarm, Code lock, Voice injection, Memory stall, Search anti-hallucination, mixed builds), each with team, grid and Autopilot deck.
- **Commands:**
  - `round-robin --seeds 1000`: 20 archetypes → 190 unordered pairings, each run with both side assignments = **380 ordered pairings**.
  - `matchup <a> <b> --seeds N`: one pairing with a round-length histogram.
  - `targets`: measures every bible balance target, each with its own defined setup (below).
  - `fuzz --battles N`.
  - `search --archetype <a> --budget 20000`: hill-climbing over 8-card decks, capped at a fixed number of simulated battles.
- **Targets and sample sizes:**

| Target | Setup | Seeds | Pass band |
|---|---|---|---|
| Any archetype vs the field | round-robin, pooled over all of the archetype's battles | 1,000 per ordered pairing | ≤ 55% |
| Worst single matchup | round-robin, per unordered pairing with both sides pooled | 2,000 per pairing | ≥ 30% |
| Starter triangle | each starter vs its counter, both sides, slice-level teams | 2,000 | 55–65% for the favoured side |
| Temperature dial | always-T0 vs always-T4, same teams, both sides | 2,000 | within 5 points of 50% |
| Graft vs spin-up | mirror teams differing only in that choice | 2,000 | 45–55% |
| Fight length | round-robin | all | median 5–8 rounds |
| First mover | perfect mirror, side A vs side B | 10,000 | 48–52% |

- A draw counts as 0.5 wins. Each result shows a 95% Wilson interval. A target **passes** when the point estimate is inside the band and the interval lies inside it, **fails** when the point estimate is outside, and is **inconclusive** when the estimate is inside but the interval crosses an edge.
- Each run writes `reports/<command>-<date>.md` and a CSV.

---

## 10. Tooling and conventions

- Node 22, pnpm workspaces, TypeScript `strict` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- ESLint inside `packages/engine/src` bans: `Math.random`, `Math.pow`, `**`, `Math.sqrt`/`log`/`exp`/trig and other transcendental `Math.*`, `Date`, `performance`, `Intl`, `localeCompare`, `for…in`, and the `/` operator outside `math/` (integer division goes through `math/` helpers).
- Every sort comparator ends on the canonical creature index (or another unique id), so ties never depend on engine sort stability.
- `@latentia/engine` has zero runtime dependencies.
- Conventional commits, authored as CosmonautJones, on a feature branch per phase; each phase lands as a pull request.

---

## 11. Decisions made in this spec (not in the bible)

1. Stat formulas, LevelFactor and stage basis points.
2. sfc32 with a 12-output discard, the normative draw table, two round-start draws per creature.
3. Fixed-point damage at ×10000 with a fixed modifier order.
4. Side composition, canonical order, bench auto-fill, HP-ratio round-cap rule.
5. G is a setup input computed by the caller.
6. Plain-data state; clone per `submitRound`, once per `simulate`.
7. Effect primitives; summons and items simplified for v1.
8. Version-mismatched logs are refused, not silently re-simulated.
9. FNV-1a-64 over canonical JSON as the cross-runtime equality check.
10. Shared guard counter with 1/3ⁿ falloff.

## 12. Eval checkpoints

Each phase ends with a checkpoint before the next phase starts:

- **Hard gates** (automated): all unit, property, scenario and golden tests pass on Node, Chromium and WebKit; fuzz run clean; lint and type-check clean; the micro-benchmark under its limit (from Phase A on).
- **Independent review:** a reviewer that did not write the code checks the phase against this spec and reports findings ranked by severity. Blockers and majors are fixed before the phase closes.
- **Scorecard for Travis:** what was built, which success criteria now pass, test counts, benchmark numbers, open risks, and what the next phase does.

## 13. Open questions (answered by this sub-project's harness, not before)

- Is the 4-cell headroom floor at L1 fun or punishing? (Fallback: an off-grid scratchpad of 2–4 cells.)
- Should G-band obedience apply in ranked ghost battles?
- Final placeholder stats for the 17 slice species.
