# Battle Engine & Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@latentia/engine` (a deterministic, integer-only, zero-dependency TypeScript battle engine) and `@latentia/sim` (a CLI balance harness) exactly as the spec defines.

**Architecture:** pnpm monorepo with two packages. The engine is split into ten acyclic units (`rng`, `math`, `content`, `events`, `grid`, `context`, `status`, `cards`, `generalization`, `battle`) behind one `index.ts`. Battles are plain-data state advanced one round at a time; every random decision comes from a fixed slot in a normative draw table, so a log of inputs replays to an identical event-stream hash on every runtime.

**Tech Stack:** Node 22, pnpm 10 workspaces, TypeScript 5 (strict), Vitest 3 (+ browser mode via Playwright), fast-check, ESLint 9 flat config, tsx for scripts and the sim CLI, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-07-battle-engine-design.md` (Revision 3). Game rules the spec references live in `docs/design-bible.md`. **Read both before starting any task.** "§5" etc. refer to the spec.

**Review cadence (standing rule from Travis):** an outside agent always evaluates progress. Every task is implemented by a fresh agent and checked by a separate fresh reviewer against the spec before the next task starts; every phase ends with an independent whole-phase review and a scorecard to Travis.

> **Erratum (Checkpoint B):** where this plan's task text and the normative rulings differ, the rulings win: `docs/superpowers/notes/phase-a-rulings.md` (1–80) and `docs/superpowers/notes/phase-b-rulings.md` (81–119) and `docs/superpowers/notes/phase-c-rulings.md` (120–145). Known stale lines: Directive and Policy Update are applied at entry time, not plan time (Rulings 74 and 91). The `autopilot` command source has worked since B4, and `autopilotUnavailable` is removed (Ruling 95). The Handoff values follow Ruling 97. `activeCards` lives in battle/levers.ts, not plan.ts (moved at Checkpoint B to avoid an import cycle).

## Global Constraints

- Node 22; pnpm workspaces; TypeScript `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `@latentia/engine` has **zero runtime dependencies**.
- Inside `packages/engine/src`, lint bans: `Math.random`, `**` and `**=`, every `Math.*` member **except** `floor, abs, min, max, trunc, imul`, `Date`, `performance`, `Intl`, `localeCompare`, `for…in`, and `/` and `/=` outside `src/math/`.
- All game arithmetic is integer; multipliers are basis points (10000 = ×1.0); floor after every multiplicative step; every intermediate passes `Number.isSafeInteger` (asserted).
- `BattleState` is plain JSON-compatible data; content referenced by id only.
- Every sort comparator ends on canonical creature index (or another unique id).
- Every action consumes exactly six draws (D1–D6) whether or not it acts; two round-start draws (R1, R2) per creature in canonical order, alive or not.
- `lo(d,a) = (d & 0xFFFF) % a`, `hi(d,b) = (d >>> 16) % b`, a, b ≤ 65536.
- Round cap 50; HP-ratio tiebreak per §5 "Cap".
- **Git:** the repo is `CosmonautJones/latentia`. Work on the phase branch (`phase-a-engine-core`, `phase-b-training`, `phase-c-simulator`). Conventional commits, author CosmonautJones, **no Co-Authored-By line**.
- **Golden files:** any task that intentionally changes the event stream runs `pnpm golden:record --update` and lists in its commit message which golden hashes changed and why. A golden failure with no intended change is a bug. `ENGINE_VERSION` stays `0.1.0` within a phase; each phase's PR bumps the minor version (0.2.0, 0.3.0) and re-records.
- **Browsers:** the dev workspace cannot download Playwright browsers. Locally set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and run Vitest browser mode with `instances: [{ browser: 'chromium', launch: { channel: 'chrome' } }]` (uses `/usr/bin/google-chrome`). Chromium and WebKit run in GitHub Actions. Tests that run in the browser must not import `node:*`; load golden JSON via JSON imports or `import.meta.glob`.

## Review Focus

1. **Seed edge cases** — an all-zero seed, uppercase hex, or a 31/33-char seed must be rejected by `parseSeed` with a typed error, never silently produce a degenerate stream. → Task A3.
2. **A side with no legal action** (every creature Rate Limited, skipped or out of moves) must still advance the round and consume draws, never hang or throw. → Task A12a.
3. **Decks with no Default card, or referencing moves the creature doesn't know,** must be rejected by `validateSetup`, not crash evaluation. (A deck with only its Default card is legal.) → Task B2.
4. **Replay of a log whose setup was edited after recording** (same seed) must produce a different hash, and `replay` of a malformed log must return a `ReplayError`, not throw. → Task A14.
5. **Both sides KO'd by the same action** must end as a draw with exactly one `BattleEnd` event. → Task A13.

---

## File Structure

```
package.json                     # root scripts: lint, typecheck, test, test:browser, bench, golden:record, sim
pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .gitignore
.github/workflows/ci.yml         # push: node + chromium + webkit + bench; nightly cron: 10k fuzz
packages/engine/
  package.json  tsconfig.json  vitest.config.ts  vitest.browser.config.ts
  scripts/record-golden.ts  scripts/bench.ts
  src/index.ts                   # the only public surface
  src/math/      bp.ts stats.ts damage.ts accuracy.ts
  src/rng/       seed.ts sfc32.ts draws.ts
  src/events/    types.ts canonical.ts fnv.ts            # dependency-free
  src/content/   ids.ts types.ts temperature.ts statuses.ts primitives.ts moves.ts species.ts
  src/grid/      model.ts validate.ts adjacency.ts
  src/context/   store.ts compaction.ts
  src/status/    apply.ts tick.ts guards.ts
  src/cards/     model.ts conditions.ts targets.ts evaluate.ts
  src/generalization/ score.ts suites/deprecated-forest.ts
  src/battle/    setup.ts state.ts log.ts errors.ts order.ts round.ts resolve.ts effects/*.ts levers.ts end.ts simulate.ts replay.ts invariants.ts
  test/          mirrors src/ ; test/golden/ ; test/properties/ ; test/fuzz/ ; test/scenarios/ ; test/helpers/
packages/sim/
  package.json  src/cli.ts src/types.ts src/runner.ts src/stats.ts src/report.ts src/targets.ts src/search.ts src/commands/*.ts src/archetypes/*.ts
  test/*.test.ts
```

A file over ~300 lines is a signal to split it.

---

# Phase A — Engine core

### Task A1: Workspace, lint rules and CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore`, `.github/workflows/ci.yml`, `packages/engine/{package.json,tsconfig.json,vitest.config.ts,vitest.browser.config.ts,src/index.ts}`
- Test: `packages/engine/test/lint.test.ts`, fixtures in `packages/engine/test/fixtures/lint/`

**Interfaces:**
- Produces: root scripts `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:browser`, `pnpm bench`, `pnpm golden:record`; `@latentia/engine` resolvable by other workspace packages.

- [ ] **Step 1: Check out the branch:** `git checkout -b phase-a-engine-core` (repo and remote already exist; author config is set).
- [ ] **Step 2: Write the failing test** — `lint.test.ts` runs ESLint's Node API on fixtures linted *as if* at `src/battle/x.ts`:
  - fixtures using `Math.random()`, `2 ** 3`, `x **= 2`, `Math.sqrt(4)`, `Date.now()`, `for (const k in o)`, `a.localeCompare(b)`, `x /= 2`, `a / b` each report ≥ 1 error;
  - `Math.floor`, `Math.max`, `Math.imul` report 0 errors;
  - the `a / b` fixture linted as `src/math/x.ts` reports 0 errors, while `2 ** 3` linted as `src/math/x.ts` still errors.
- [ ] **Step 3: Run** `pnpm --filter @latentia/engine test lint` → FAIL (no config).
- [ ] **Step 4: Implement** the workspace and lint config (`no-restricted-properties`, `no-restricted-globals`, `no-restricted-syntax` with `BinaryExpression[operator='**']`, `AssignmentExpression[operator='**=']` and `ForInStatement` everywhere in `src/`, plus `BinaryExpression[operator='/']` and `AssignmentExpression[operator='/=']` only in files outside `src/math/**`, and a `MemberExpression[object.name='Math']` selector whose property is not in the whitelist). Node tests exclude nothing; `vitest.browser.config.ts` excludes `test/lint.test.ts` and `test/fuzz/**`, and uses the local Chrome instance from Global Constraints (overridable by `BROWSER=chromium|webkit` in CI). CI: job `node` (lint, typecheck, test); job `browser` (matrix chromium, webkit; `npx playwright install --with-deps ${{ matrix.browser }}`; `pnpm test:browser --passWithNoTests`); job `bench` (added as a no-op until A15); a `schedule` cron that runs `FUZZ_N=10000 pnpm test fuzz` nightly.
- [ ] **Step 5: Run** `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 6: Commit** `chore: scaffold workspace, engine lint bans and CI`

### Task A2: Math — basis points, stats, damage, accuracy, crit

**Files:**
- Create: `src/math/bp.ts`, `src/math/stats.ts`, `src/math/damage.ts`, `src/math/accuracy.ts`
- Test: `test/math/{bp,stats,damage,accuracy}.test.ts`

**Interfaces:**
- Produces:
  - `class EngineInvariantError extends Error` (fields `round?`, `actor?`, `seed?`); `idiv(a, b)` (floor division; asserts safe ints and `b !== 0`); `mulBp(x, bp)` (= `idiv(x * bp, 10000)`); `assertSafe(n, label)`.
  - `STAGE_BP = [5714, 6667, 8000, 10000, 12500, 15000, 17500] as const`; `stageBp(stage: number): number` (stage clamped −3…3).
  - `hpAt(baseHp, level)`, `statAt(base, level)`, `effectiveStat(stat, stage)`, `levelFactor(level)`.
  - `effectivePower(i: { base: number; additive: number; conditional: number[]; toolSteps: number; summary: boolean }): number`.
  - `type DamageMods = { type?; t4se?; native?; crit?; roll?; handoff?; specialist?; overfit?; glazed?; observation?; guard?; refusalOrApology? }` (all basis points); `computeDamage(i: { power: number; atk: number; def: number; level: number; mods: DamageMods }): number`.
  - `hitChance(i: { moveAcc; tempMod; drift; accStages; evaStages; robustBonus: number }): number` (clamped 30–100); `CRIT_THRESHOLDS_48 = [0, 1, 2, 4, 8, 24, 48] as const`; `critThreshold(stage)` (stage capped 0…6).

- [ ] **Step 1: Write failing tests:**
  - `statAt(60, 5) === 11`, `hpAt(60, 5) === 21`, `levelFactor(5) === 4`, `levelFactor(20) === 10`.
  - `effectiveStat(100, 1) === 125`, `effectiveStat(100, -1) === 80`, `effectiveStat(100, -3) === 57`.
  - `computeDamage({ power: 60, atk: 11, def: 11, level: 5, mods: {} }) === 5`; with `mods: { handoff: 11000 }` → `6` (spec: a 10% modifier changes L5 damage); with `{ native: 12500 }` → `7`; with `{ type: 20000, crit: 15000 }` → `15`.
  - `effectivePower({ base: 60, additive: 20, conditional: [20000], toolSteps: 1, summary: false }) === 176`; same with `summary: true` → `88`.
  - `hitChance({ moveAcc: 100, tempMod: -15, drift: 5, accStages: 0, evaStages: 0, robustBonus: 0 }) === 45`; clamps at 30 and 100; `robustBonus: 5` adds 5.
  - `critThreshold(0) === 0`, `critThreshold(4) === 8`, `critThreshold(9) === 48`.
  - `computeDamage({ power: 300, atk: 533, def: 2, level: 100, mods: <every field at its max> })` does not throw.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** per §5 "Stats" and "Damage" steps 1–7. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): integer math, stats and fixed-point damage`

### Task A3: RNG — sfc32, seeds and draws

**Files:**
- Create: `src/rng/seed.ts`, `src/rng/sfc32.ts`, `src/rng/draws.ts`
- Test: `test/rng/{seed,sfc32,draws}.test.ts`

**Interfaces:**
- Produces: `type SeedHex = string`; `parseSeed(hex): { ok: true; words: [number, number, number, number] } | { ok: false; error: 'length' | 'charset' | 'allZero' }` — 32 lowercase hex chars split into four **big-endian** 8-char words (`"01234567…"` → `0x01234567`); `type RngState = { a; b; c; d }`; `seedRng(words): RngState` (a, b, c, d = words 0–3, then discard 12 outputs); `nextU32(s): number` (mutates `s`); `lo(d, a)`, `hi(d, b)`; `type ActionDraws = { d1; d2; d3; d4; d5; d6 }`; `drawAction(s): ActionDraws`; `type RoundStartDraws = { r1; r2 }`; `drawRoundStart(s): RoundStartDraws`.

- [ ] **Step 1: Write failing tests:**
  - Known answers (PractRand sfc32: `t = a + b + d; d = d + 1; a = b ^ (b >>> 9); b = c + (c << 3); c = rotl(c, 21) + t; return t`): seed `00000000000000000000000000000001` → first four outputs after the discard `0x514676c3, 0x08a809df, 0x30349d2b, 0xfb52c520`; seed `0123456789abcdef0123456789abcdef` → `0xd26e7837, 0xa333a754, 0x894ea5d8, 0x8ac3871b`.
  - `parseSeed` rejects length 31/33 (`'length'`), uppercase or non-hex (`'charset'`), 32 zeros (`'allZero'`).
  - `drawAction` consumes exactly 6 outputs, `drawRoundStart` exactly 2 (compare against `nextU32` on a copy).
  - `lo(0xABCD1234, 100) === 0x1234 % 100`, `hi(0xABCD1234, 100) === 0xABCD % 100`; property: every output is a uint32.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with `| 0` / `>>> 0`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): sfc32 rng, seed parsing and draw helpers`

### Task A4: Events, canonical JSON and the event-stream hash

**Files:**
- Create: `src/events/types.ts`, `src/events/canonical.ts`, `src/events/fnv.ts`
- Test: `test/events/{canonical,fnv}.test.ts`

**Interfaces:**
- Produces: `type BattleEvent` — discriminated union on `type` with exactly the event names in §5 "Events, logs and hashing"; every event has `round: number`; `ActionStarted` has `actor: number` and `draws: { d1; d2; d3; d4; d5; d6 }`; `ActionSkipped.reason ∈ 'rateLimited' | 'cleared' | 'headless' | 'fainted' | 'leftField' | 'charging'`; `CardTrace` has `firedCardId: string` and `skipped: { cardId: string; reason: 'conditionFalse' | 'insufficientContext' | 'moveDisabled' | 'notActive' | 'disobeyed' }[]`. `canonicalJson(v): string`; `fnv1a64Hex(bytes: Uint8Array): string`; `eventStreamHash(events): string`. **`events/` imports nothing from other engine units** (ids are plain strings/numbers).

- [ ] **Step 1: Write failing tests:** `fnv1a64Hex(enc(""))` → `"cbf29ce484222325"`, `enc("a")` → `"af63dc4c8601ec8c"`, `enc('{"a":1,"b":[2,3]}')` → `"55bed68470220de4"`; `canonicalJson({ b: [2, 3], a: 1 }) === '{"a":1,"b":[2,3]}'`; non-integers, `undefined`, functions, `Map`, `Set` throw; `"B"` sorts before `"a"`; equal hashes for structurally equal arrays built with different key orders.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** FNV-1a 64 with 16-bit limbs (prime `0x100000001b3`, offset `0xcbf29ce484222325`) over `TextEncoder` bytes. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): event types, canonical json and fnv-1a-64 hash`

### Task A5: Content — type chart, temperature, statuses

**Files:**
- Create: `src/content/ids.ts`, `src/content/types.ts`, `src/content/temperature.ts`, `src/content/statuses.ts`
- Test: `test/content/{types,temperature,statuses}.test.ts`

**Interfaces:**
- Produces: `TYPES = ['reasoning','speed','open','code','vision','voice','search','memory'] as const`, `type TypeId`; `typeMultiplierBp(atk, defTypes): number` (product, clamped 2500–30000); `TEMPERATURE` (index 0–4) rows `{ rollMinPct, rollMaxPct, accMod, baseCritStage, selfHallucinationPct, wild: boolean }`; `hallucinationChancePct(temp, hasStatus): number`; `type StatusId` (`hallucinating, promptInjected, rateLimited, overfit, glazed, deprecated, quantized, drift`); `STATUSES` keyed by `StatusId` with `{ major: boolean; durationMin; durationMax }`.

- [ ] **Step 1: Write failing tests:** every chart cell equals the bible's chart (table-driven, all 64); spot checks speed→reasoning 20000, reasoning→speed 5000, memory→reasoning 20000, open→speed 20000; every row and column has exactly two 20000 and two 5000; `typeMultiplierBp('speed', ['reasoning','search']) === 30000`; T0 `{100,100,10,0,0,false}`, T2 `{85,110,0,2,0,false}`, T3 `{75,125,-5,3,5,true}`, T4 `{60,150,-15,4,12,true}`; `hallucinationChancePct(0, true) === 12`, `(2, true) === 25`, `(4, true) === 62`, `(3, false) === 5`.
- [ ] **Step 2–4:** Run → FAIL; implement as frozen `as const` data; run → PASS. **Step 5: Commit** `feat(content): type chart, temperature table and statuses`

### Task A6: Content — effect primitives, moves and slice species

**Files:**
- Create: `src/content/primitives.ts`, `src/content/moves.ts`, `src/content/species.ts`
- Test: `test/content/integrity.test.ts`

**Interfaces:**
- Produces: `type Effect` — union of the §6 primitive kinds (`damage, multiHit, charge, heal, stage, applyStatus, cure, tokens, timedField, nextActionModifier, snapshot, revert, reveal, reorder, copy, guard, shield, stealStage, passive`); each chance field carries `slot: 'd1lo' | 'd1hi' | 'd2lo' | 'd2hi' | 'd3lo' | 'd3hi' | 'd4lo' | 'd4hi' | 'd5lo' | 'd5hi' | 'd6lo' | 'd6hi' | 'r2hi'`. `type MoveDef = { id; type: TypeId | 'system'; power: number | null; cost: number; accuracy: number | null; priority: number; effects: Effect[]; wild?: Effect[]; wildT4?: Effect[]; universal?: true; orchestratorOnly?: true }`; `MOVES`; `type SpeciesDef = { id; types: TypeId[]; base: { hp; compute; robustness; latency }; ctx: number; moves: MoveId[]; signature: MoveId; passive?: Effect; graftShape: [number, number][] }`; `SPECIES`.

- [ ] **Step 1: Write the failing integrity test:** 57 launch moves (48 typed: 6 per type except code 7, memory 5; 9 system) plus one signature per slice species; Compact, `/clear`, Guardrail `universal`; Directive, Policy Update `orchestratorOnly`; Compact `cost 0, priority -2`; `/clear` `priority -3`; Guardrail, Refusal, Captcha Wall `priority 4`; Unit Test `priority 3`; "Hype Train" present, "Hype Cycle" absent; exactly the 17 species marked **S** in the bible's ModelDex table; every move and signature resolves; every `graftShape` has 3–4 orthogonally connected cells; every chance names a slot; no move has a `wild`-doubling flag (T4 behaviour only via `wildT4`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** from the bible's 57-move table and ModelDex rows 1–17. **Signatures the bible doesn't fully specify:** power 50–90, cost 1–3, accuracy 90–100, priority 0, built only from existing primitives and matching the gag text in the ModelDex row; mark each `// placeholder signature`. Simplified slice behaviours per §3. Species base stats are placeholders 40–90 with starter totals within ±5% of each other, marked `// placeholder — tuned in sub-project 4`.
- [ ] **Step 4: Run** → PASS. **Step 5: Commit** `feat(content): effect primitives, launch moves and slice species`

### Task A7: Grid — model, validation, adjacency, active cards

**Files:**
- Create: `src/grid/model.ts`, `src/grid/validate.ts`, `src/grid/adjacency.ts`
- Test: `test/grid/{validate,adjacency}.test.ts`

**Interfaces:**
- Produces: `type PieceKind = 'systemPrompt' | 'skill' | 'tool' | 'exampleCard' | 'subagentSlot' | 'graft' | 'cache'`; `type PlacedPiece = { id; kind; shape: [number, number][]; anchor: [number, number]; rotation: 0 | 90 | 180 | 270; moveId?: string; subagentId?: string }`; `type GridLayout = { width; height; pieces: PlacedPiece[] }`; `GRID_SIZE_BY_LEVEL = [[1,4,4],[4,5,4],[7,5,5],[10,6,5],[13,6,6]]`; `gridSizeFor(level)`; `cellsOf(piece)`; `type ValidationResult = { ok: boolean; errors: { code: string; path: string; message: string }[] }`; `validateGrid(grid, level): ValidationResult`; `neighbours(grid, pieceId): string[]`; `toolStepsFor(grid, pieceId): number`; `activeCardCount(grid, slotId, version: 'v1' | 'v2' | 'v3.5' | 'v4'): number`; `isCompactable(grid, pieceId, summarized: readonly string[]): boolean`.

- [ ] **Step 1: Write failing tests:** 4×4 with System Prompt (I3) + Skill + Tool + Slot + 1 Example Card validates (headroom 5); a second Skill → `headroomFloor`; two System Prompts → `systemPromptCount`; five Skills → `skillCount`; overlap → `overlap`; out of bounds → `bounds`; all errors returned together; rotation 90 of an L-tromino yields the rotated cells; `activeCardCount`: 3 adjacent cards → v1 3, v2 3; 6 adjacent → v2 5, v4 6; a card touching two slots counts for both; `toolStepsFor` counts adjacent Tools; `isCompactable` false for System Prompt, any 1×1 piece, a piece next to a Cache, an already-summarized piece; true for a 1×2 Skill.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): context grid model and validation`

### Task A8: Context — tokens, overflow, forced compaction, Compact and /clear

**Files:**
- Create: `src/context/store.ts`, `src/context/compaction.ts`
- Test: `test/context/{store,compaction}.test.ts`

**Interfaces:**
- Consumes: `GridLayout`, `isCompactable`, `cellsOf` (A7); `BattleEvent` (A4).
- Produces: `type Token = { kind: 'cost' | 'junk' | 'observation' | 'summary'; buff?: { stat: string; stages: number }; seq: number }`; `type ContextState = { window: number; tokens: Token[]; drift: number; summarizedPieces: string[]; removedSlots: string[]; nextSeq: number }`; `freeCells(ctx)`; and, each taking `round: number` for its events and the owner's canonical index `actor`: `pay(ctx, n, round, actor, buff?)`, `forceTokens(ctx, n, grid | null, round, actor): { events: BattleEvent[]; compactedPieceIds: string[] }`, `addObservation(ctx, round, actor)`, `compact(ctx, round, actor)`, `clearAll(ctx, round, actor)`, `freeOldestNonJunk(ctx, round, actor)`, `recover(ctx, n, round, actor)` — all returning `BattleEvent[]` unless noted.

- [ ] **Step 1: Write failing tests:** pay 3 with 5 free → 2 free, no Drift; pay 4 with 2 free → 0 free, Drift +2 and one `DriftChanged`; Drift caps at 5; `forceTokens` with no free cell compacts the lowest-index compactable piece (1×2 Skill at index 1 before a 2×2 Slot at index 3), the token takes a freed cell, `PieceCompacted` emitted; no compactable piece → +1 Drift; `grid === null` (subagent) → +1 Drift; a compacted Slot's id lands in `removedSlots`; `compact` pairs the six oldest (1,2),(3,4),(5,6) → 3 summaries, −1 Drift; with 5 tokens → (1,2),(3,4),(5); summarizing a buff-tagged token emits `StageChanged` −1; Observation added only when a cell is free; `clearAll` empties tokens and Drift; `freeOldestNonJunk` skips junk; `recover(ctx, 2, …)` removes the two oldest tokens.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): context tokens, overflow and compaction`

### Task A9: Statuses and guards

**Files:**
- Create: `src/status/apply.ts`, `src/status/tick.ts`, `src/status/guards.ts`
- Test: `test/status/{apply,tick,guards}.test.ts`

**Interfaces:**
- Produces: `type StatusInstance = { id: StatusId; remaining: number; source?: number; injected?: { moveId: string; target: number } }`; `type StatusHolder = { index: number; statuses: StatusInstance[]; stages: Record<string, number>; isOrchestrator: boolean }` (the minimal shape `CreatureState` in A10 extends); `applyStatus(h, inst, round): BattleEvent[]`; `tickStatuses(h, round): { events: BattleEvent[]; forceBench: boolean; ko: boolean }`; `cureStatus(h, id, round): BattleEvent[]`; `statusDamageMods(h, targetIndex): { overfit?: number; glazed?: number }`; `quantizedAdjust(h): { stageDelta: -1; costDelta: -1 } | null`; `GUARD_THRESHOLDS_729 = [729, 243, 81, 27, 9, 3] as const`; `guardSucceeds(consecutive, d3): boolean`.

- [ ] **Step 1: Write failing tests:** Rate Limited blocks Quantized (`StatusBlocked`); Hallucinating + Glazed stack; re-applying Hallucinating → `StatusBlocked`; Drift re-application is not blocked; duration `2 + hi(d6, 3)` gives 2–4; expiry emits `StatusExpired`; Deprecated at 0 → `forceBench: true` for a subagent with a bench, `ko: true` for an orchestrator; Quantized → all stages −1 and move costs −1 (min 0); Overfit → 11500 vs same target, 7000 vs others; Glazed → 7000 vs its glazer only; `guardSucceeds(0, any)` true; `guardSucceeds(1, d)` iff `lo(d, 729) < 243`; `guardSucceeds(6, 0)` false.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): statuses and guard falloff`

### Task A10: Battle setup, state, log types and canonical order

**Files:**
- Create: `src/battle/setup.ts`, `src/battle/state.ts`, `src/battle/log.ts`, `src/battle/invariants.ts`
- Test: `test/battle/setup.test.ts`

**Interfaces:**
- Produces:
  - `type Deck = unknown & { readonly __brand: 'Deck' }` and `type Card = unknown & { readonly __brand: 'Card' }` — opaque until B1 replaces them with real types in `cards/model.ts` (B1 re-points these imports).
  - `type Version = 'v1' | 'v2' | 'v3.5' | 'v4'`; `type CreatureSetup = { id: string; species: string; level: number; version: Version; moves: string[]; deck?: Deck; generalization?: number; trainedTemperature?: 0 | 1 | 2 | 3 | 4; recordedFoes?: string[] }`.
  - `type SideSetup = { orchestrator: CreatureSetup; active: CreatureSetup[]; bench: CreatureSetup[]; grid: GridLayout | null; autopilot?: { deck: Deck; temperature: 0 | 1 | 2 | 3 | 4 }; opponentId: string }`; `type BattleSetup = { a: SideSetup; b: SideSetup; kind: 'trainer' | 'wild' | 'ghost' }`.
  - `type OrchestratorAction = { kind: 'move'; moveId: string; target: number; injection?: { moveId: string; target: number } } | { kind: 'directive'; subagent: number; moveId: string; target: number } | { kind: 'policyUpdate'; card: Card } | { kind: 'swap'; out: number; in: number } | { kind: 'none' }`; `type SideCommand = { temperature: 0 | 1 | 2 | 3 | 4; action: OrchestratorAction }`; `type RoundCommand = { a?: SideCommand; b?: SideCommand }` (Autopilot sides omit theirs).
  - `type BattleLog = { engineVersion: string; seed: SeedHex; setup: BattleSetup; rounds: RoundCommand[] }` in `battle/log.ts`.
  - `type CreatureState = StatusHolder & { speciesId; side: 'a' | 'b'; slot: 'orchestrator' | 'active' | 'bench'; hp; maxHp; stats; context: ContextState; guardStreak; fainted; … }`; `type BattleState = { round; rng: RngState; creatures: CreatureState[]; sides; fields; ended: boolean; result?: 'a' | 'b' | 'draw' }`.
  - `validateSetup(setup): ValidationResult`; `createBattle(setup, seed): BattleState` (throws `SetupError` with the errors on invalid input); `assertInvariants(state): void`.

- [ ] **Step 1: Write failing tests:** canonical order A orch, A active1, A active2, A bench1–3, then B; 3 active → `activeCount`; 4 bench → `benchCount`; unknown species or move → `unknownId`; grid errors surface with path prefix `a.grid`; invalid seed → `SetupError`; the state survives `canonicalJson` and deep-equals its `structuredClone`; HP from `hpAt`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): battle setup, plain-data state and canonical order`

### Task A11: Turn order and round skeleton

**Files:**
- Create: `src/battle/order.ts`, `src/battle/round.ts`, `src/battle/end.ts`, `src/battle/errors.ts`
- Test: `test/battle/{order,round,end}.test.ts`

**Interfaces:**
- Produces: `type ActionEntry = { actor; priority; latency; tieBreak; moveId; target; cardId?; replanned?: boolean }`; `sortActions(entries): ActionEntry[]`; `type CommandError = { code: 'unknownMove' | 'illegalTarget' | 'actorSkipped' | 'directiveOnFainted' | 'notOrchestratorMove' | 'battleEnded'; message: string }` in `battle/errors.ts`; `submitRound(state, cmd): { state; events } | { error: CommandError }` — clones once, runs round start → plan → sort → resolve (calls `resolveAction` from A12a; until then a stub that only emits `ActionStarted`) → end of round. Non-commanded creatures use a **default intent** (first usable move at the lowest-HP foe), replaced by decks in B2. `checkEnd(state): BattleEvent[]`; `autofillBench(state, round): BattleEvent[]`.

- [ ] **Step 1: Write failing tests:** sort by priority, then latency desc, then tieBreak desc, then canonical index asc (craft an all-equal case); every creature, including KO'd ones, takes R1/R2 each round (count `nextU32` calls); each sorted entry consumes 6 draws; empty active slot auto-fills from bench in order at end of round; round-50 cap compares `ΣhpA × ΣmaxB` vs `ΣhpB × ΣmaxA` (craft a 1-HP-difference case and an exact tie → draw); an unknown move → `{ error: { code: 'unknownMove' } }` and the input state deep-equals its pre-call snapshot; a Directive aimed at a subagent built directly with `hp: 0, fainted: true` → `directiveOnFainted`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): turn order, round loop and win check`

### Task A12a: Resolution pipeline, damage, hallucination and Drift

**Files:**
- Create: `src/battle/resolve.ts`, `src/battle/effects/damage.ts`, `src/battle/effects/multiHit.ts`
- Test: `test/battle/resolve.test.ts`, `test/battle/effects/{damage,multiHit}.test.ts`

**Interfaces:**
- Consumes: A2, A5–A6, A8, A9, A11.
- Produces: `resolveAction(state, entry, draws, events): void`; `type EffectContext = { state; actor: number; target: number; draws: ActionDraws; move: MoveDef; temperature: 0 | 1 | 2 | 3 | 4; events: BattleEvent[]; round: number }`; `applyDamage(ctx, effect)`, `applyMultiHit(ctx, effect)`; `applyEffect(ctx, effect)` dispatcher (unknown kinds throw `EngineInvariantError` until A12b/A13 add them).

- [ ] **Step 1: Write failing tests** (fixed seeds, asserted events):
  - hit/miss from `lo(d3, 100)` vs `hitChance`; Robust +5 only vs a foe not in `recordedFoes`;
  - crit from `lo(d4, 48)` with the temperature's base stage; Reasoning moves get +1 crit stage at T0/T1;
  - roll basis points `rollMinPct*100 + lo(d5, width)*100`; T0 always 10000;
  - Wild riders fire at T3+ only; `wildT4` replaces `wild` at T4; T4 super-effective applies 12500;
  - a super-effective hit frees the attacker's oldest non-Junk token; first sighting of an enemy move gives the defender an Observation (9000 next time that move hits it);
  - Handoff 11000/12000/13000 over three allied hits on one target, reset by an enemy action; multi-hit shares one roll and counts once; hit count from `hi(d5, span)`;
  - Overfit and Glazed modifiers applied via `statusDamageMods`; a compacted Skill deals 50% power (`summary: true`); a Tool step raises a heal by 10%;
  - Hallucinating retarget uses `hi(d3, living − 1)` over combatants excluding the user; Drift random move keeps a legal original target;
  - Rate Limited skip when `lo(d2, 100) < 25` emits `ActionSkipped { reason: 'rateLimited' }` and still consumes draws;
  - **a side whose every creature is Rate Limited and skipped** still advances to the next round (Review Focus 2);
  - a creature KO'd before its entry emits `ActionSkipped { reason: 'fainted' }` and still consumes draws.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): resolution pipeline, damage and multi-hit`

### Task A12b: Guards, charge, heal, stage, status, tokens, Swap and /clear

**Files:**
- Create: `src/battle/effects/{guard,charge,heal,stage,status,tokens,swap}.ts`
- Modify: `src/battle/resolve.ts` (dispatcher entries), `src/battle/round.ts` (bench recovery, Swap/Early Exit at +3, /clear skip)
- Test: `test/battle/effects/{guard,charge,heal,stage,status,tokens,swap}.test.ts`, `test/battle/end.test.ts` (additions)

**Interfaces:**
- Produces: `applyGuard`, `applyCharge`, `applyHeal`, `applyStage`, `applyStatusEffect`, `applyCure`, `applyTokens`, `applySwap` with the `EffectContext` signature. Swap (orchestrator command) and Early Exit resolve at priority +3; the incoming creature is the chosen bench creature (Swap) or the first living bench creature (Early Exit).

- [ ] **Step 1: Write failing tests:** Captcha Wall makes a Speed move a miss and halves others; Guardrail halves damage and blocks status moves; Refusal blocks one attack and sets a 5000 penalty on the user's next move; guard streak uses `guardSucceeds`; Deliberate telegraphs, a hit while charging costs −30 power, the charging creature's next command is `actorSkipped`; heals cap at max HP; stages clamp −3…+3; Prompt Injected stores the inflicter's `injection` choice (or the default: victim's highest-power move vs the victim's lowest-HP ally) and replaces the victim's next action; Filibuster adds 2 Junk to the target; a compacted Slot force-benches its subagent to the **end** of the bench (bench length may become 4); bench creatures recover 2 cells per round; `/clear` wipes tokens, stages and Drift and the orchestrator's next command emits `ActionSkipped { reason: 'cleared' }`; Swap at +3 resolves before a +1 move and the swapped-in creature does not act this round.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): guards, status, tokens, swap and /clear`

### Task A13: Remaining effect primitives and slice passives

**Files:**
- Create: `src/battle/effects/{timedField,nextActionModifier,snapshot,reveal,reorder,copy,shield,stealStage,passive}.ts`
- Test: `test/battle/effects/*.test.ts`

**Interfaces:**
- Same `apply<Kind>(ctx, effect)` signature. `passive` triggers: `'battleStart' | 'firstMove' | 'roundEnd' | 'statusIncoming' | 'notKoThisRound'`; chance procs read `hi(r2, 100)` from that round's round-start draws.

- [ ] **Step 1: Write failing tests:** Memory Leak adds 1 Junk per round for 3 rounds then `FieldEffectEnded`; Saliency Map emits `Revealed` for 3 rounds; Temperature Spike forces T4 for 2 rounds; Embedding Cache makes the next move cost 0; Bounding Box makes the next move unable to miss; Segfault's 20% (`lo(d6,100) < 20`) makes the target's next move fail; Save State reverts HP on the first KO within 3 rounds; Screenshot saves then reverts stages; Rerank swaps two entries once; Fork copies the target's best buff; Episodic Replay repeats the last allied move; Forkling's shield absorbs one hit (`ShieldAbsorbed`); Scrapion steals one positive stage (`StageStolen`); Sagelet's Disclaimer blocks the first incoming status; Blitzr's Move Fast gives +1 priority to its first move and a 15% recoil proc on `hi(r2, 100) < 15`; Slopling gains +1 stage each round it isn't KO'd; **both sides KO'd by one action** — a crafted state with both sides at low HP where Blitzr's recoil proc fires on its KO hit → draw with exactly one `BattleEnd` (Review Focus 5).
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): remaining effect primitives and slice passives`

### Task A14: simulate, replay, properties and fuzz

**Files:**
- Create: `src/battle/simulate.ts`, `src/battle/replay.ts`, `test/properties/{determinism,invariants,metamorphic}.test.ts`, `test/fuzz/fuzz.test.ts`, `test/helpers/arbitraries.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Produces: `ENGINE_VERSION = '0.1.0'`; `type CommandSource = { kind: 'recorded'; rounds: RoundCommand[] } | { kind: 'scripted'; next: (state: BattleState) => RoundCommand } | { kind: 'autopilot' }` (`'autopilot'` returns `{ error }` until B4); `simulate(setup, seed, commands): BattleResult` where `BattleResult = { winner: 'a' | 'b' | 'draw'; rounds: number; events: BattleEvent[]; hash: string; log: BattleLog }`; `replay(log): BattleResult | { error: ReplayError }`, `ReplayError = { code: 'version' | 'malformed' | 'invalidSetup' }`; arbitraries `arbLegalSetup`, `arbSeed`, `arbScriptedCommands`. `index.ts` exports **the Phase A subset** of §4: `ENGINE_VERSION, validateSetup, createBattle, submitRound, simulate, replay, validateGrid, activeCardCount, eventStreamHash, fnv1a64Hex` and their types (B2 adds `getIntents`, B5 adds `computeGeneralization`).

- [ ] **Step 1: Write failing tests:**
  - determinism: two `simulate` calls → equal `hash`; `replay(result.log).hash === result.hash`;
  - editing the logged setup (one move changed) → different hash (Review Focus 4); `replay({})` → `{ error: { code: 'malformed' } }`; wrong version → `'version'`;
  - invariants over 200 random battles: HP in [0, max], tokens ≤ window, rounds ≤ 50, exactly 6 draws per `ActionStarted`;
  - metamorphic (statistical): for two distinct fixed teams X and Y over 2,000 seeds, X's win rate as side A and as side B differ by ≤ 5 points;
  - fuzz: 500 random legal battles (`FUZZ_N` raises it) with no exception.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): simulate, replay and property/fuzz suites`

### Task A15: Golden files, cross-runtime run and benchmark

**Files:**
- Create: `test/golden/scenarios.ts` (~30 named setups + scripted commands covering every Phase-A-reachable move, status and lever), `test/golden/*.json` (log + expected hash), `test/golden/golden.test.ts`, `scripts/record-golden.ts`, `scripts/bench.ts`
- Modify: `vitest.browser.config.ts` (include golden, property and unit tests), `.github/workflows/ci.yml` (real `bench` job), root `package.json`

**Interfaces:**
- Produces: `pnpm golden:record [--update]` (refuses to overwrite without `--update`); `pnpm bench` — a tsx script that runs a fixed set of 2,000 battles (`seedFor`-style deterministic seeds, `CommandSource` `{ kind: 'scripted' }` picking each orchestrator's first usable move), prints mean ms/battle, exits non-zero above 1.2.

- [ ] **Step 1: Write the golden test:** for each JSON (loaded by JSON import), `replay(log).hash === expectedHash`; a coverage test asserts every Phase-A-reachable move id and status id appears in some golden event stream.
- [ ] **Step 2: Run** → FAIL (no files). **Step 3: Record** with `pnpm golden:record`, hand-inspect two event streams for plausibility, commit.
- [ ] **Step 4: Run** `pnpm test`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm test:browser` (local Chrome) and `pnpm bench` → PASS; push the branch; CI's chromium and webkit jobs pass with the same hashes.
- [ ] **Step 5: Commit** `test(engine): golden battles, cross-runtime hashes and benchmark`

### Checkpoint A — eval gate

- [ ] **Hard gates:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:browser && FUZZ_N=10000 pnpm test fuzz && pnpm bench` pass locally; CI green on node, chromium, webkit.
- [ ] **Independent review:** a fresh reviewer (did not write the code) checks the branch against the spec; fix every blocker and major.
- [ ] **Scorecard to Travis:** criteria 1, 2, 4, 7; test count; fuzz count; ms/battle; golden count; open risks; Phase B preview. Bump `ENGINE_VERSION` to `0.2.0`, re-record goldens, open PR `phase-a-engine-core → main`.

---

# Phase B — Training

### Task B1: Card model, conditions and target selectors

**Files:**
- Create: `src/cards/model.ts`, `src/cards/conditions.ts`, `src/cards/targets.ts`
- Modify: `src/battle/setup.ts` (replace the opaque `Deck`/`Card` with imports from `cards/model.ts`)
- Test: `test/cards/{conditions,targets}.test.ts`

**Interfaces:**
- Produces: `type Card = { id: string; subject: 'self' | 'orchestrator' | 'foe'; condition: Condition; move: string; target: TargetSelector; allowOverflow?: true; recordedFrom?: string; injection?: { moveId: string; target: TargetSelector } }`; `type Condition` — union tagged by `category` ∈ `hp, status, foeType, foeLastMove, turn, cooldown, allyHp, field, foeBuffed, contextFill, telegraphing, coin`, thresholds `{ op: 'below' | 'atLeast'; pct: 25 | 50 | 75 }`; `type TargetSelector = 'self' | 'orchestrator' | 'lowestHpAlly' | 'orchestratorTarget' | 'lowestHpFoe' | 'foeWeakToMove' | 'highestAtkFoe' | 'randomFoe'`; `type Deck = { cards: Card[]; default: Card }`; `type BattleView` (read-only projection for one creature, built by `viewFor(state, actor, roundStart)`); `holds(card, view): boolean`; `resolveTarget(sel, view, moveId): number | null`.

- [ ] **Step 1: Write failing tests:** HP `below 50`: `hp 50 / max 101` true, `51 / 101` false (cross-multiplication); `foe` subject holds when any living foe matches; `coin` reads `hi(r1, 2)`; `randomFoe` reads `lo(r2, livingFoes)`; `foeWeakToMove` picks the highest type multiplier, then canonical index; KO'd creatures are never targets.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(cards): card grammar, conditions and target selectors`

### Task B2: Deck evaluation, intents, obedience and traces

**Files:**
- Create: `src/cards/evaluate.ts`
- Modify: `src/battle/round.ts` (deck evaluation replaces the default intent; re-plan at resolve), `src/battle/setup.ts` (deck validation), `src/index.ts` (export `getIntents`)
- Test: `test/cards/evaluate.test.ts`, `test/battle/intents.test.ts`

**Interfaces:**
- Produces: `type Band = 'robust' | 'stable' | 'brittle'`; `bandFor(g: number): Band`; `obeys(band, d1): boolean`; `evaluateDeck(deck, view, activeN, opts: { startAfter?: string; band: Band }): { cardId; moveId; target; trace: CardTrace }`; `getIntents(state): Intent[]`, `Intent = { actor; moveId; target; cardId; replanned: boolean }`.

- [ ] **Step 1: Write failing tests:** top-down first match; only top-N active + Default evaluated, others traced `notActive`; cost > free cells without `allowOverflow` → `insufficientContext`; Brittle obedience fails when `lo(d1, 100) >= 85` and takes the next matching card below, traced `disobeyed`; Brittle with no non-Default match repeats its most-represented move (tie → first in deck) with `BrittleRepeat`; intents exist before `submitRound` and equal what fires when nothing changes; when the intent's target faints first, evaluation continues from the next card and marks `replanned`; `validateSetup` rejects a deck with no Default, an unknown move, or a move the creature doesn't know, and accepts a Default-only deck (Review Focus 3). Re-record goldens (event stream changes) per Global Constraints.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(cards): deck evaluation, intents, obedience and traces`

### Task B3: Directive, Policy Update, Headless Mode, Specialist

**Files:**
- Create: `src/battle/levers.ts`
- Modify: `src/battle/round.ts`, `src/battle/effects/damage.ts`
- Test: `test/battle/levers.test.ts`

**Interfaces:**
- Produces: `applyDirective(state, side, subagent, moveId, target, round)`; `applyPolicyUpdate(state, side, card, round)` (inserted above every allied deck's active cards for rounds r..r+2, no slot used); `specialistApplies(deck, opponentId): boolean` (≥ 50% of cards `recordedFrom === opponentId`).

- [ ] **Step 1: Write failing tests:** Directive costs 2 cells and replaces the subagent's intent at plan time; the Policy Update card fires for exactly rounds r, r+1, r+2; orchestrator KO → `HeadlessMode`, later orchestrator commands are ignored, subagents keep acting, bench auto-fills; Specialist applies 11500 only against the matching opponent id; a deck card's `injection` choice is used when its Deepfake Call lands.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): directive, policy update, headless mode and specialist`

### Task B4: Autopilot decks

**Files:**
- Modify: `src/battle/round.ts`, `src/battle/simulate.ts`, `src/battle/replay.ts`, `src/battle/setup.ts`
- Test: `test/battle/autopilot.test.ts`

**Interfaces:**
- Produces: a side with `autopilot: { deck, temperature }` and no `SideCommand` is commanded each Plan phase by evaluating its Autopilot deck (≤ 12 cards) for the orchestrator at the configured temperature; `simulate(setup, seed, { kind: 'autopilot' })` runs every side without a command on Autopilot. **Autopilot sides stay omitted in `log.rounds`; `replay` re-evaluates the deck**, so its `CardTrace` events reproduce.

- [ ] **Step 1: Write failing tests:** a 13-card Autopilot deck fails validation; a both-autopilot battle completes, its log rounds are `{}` per round, and `replay(log).hash === result.hash`; Autopilot orchestrators emit `CardTrace`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(engine): autopilot decks for ai and ghost orchestrators`

### Task B5: Generalization and the Deprecated Forest Eval Suite

**Files:**
- Create: `src/generalization/score.ts`, `src/generalization/suites/deprecated-forest.ts`
- Modify: `src/index.ts` (export `computeGeneralization`)
- Test: `test/generalization/score.test.ts`

**Interfaces:**
- Consumes: `evaluateDeck`, `BattleView` (B1–B2) on snapshots only — never runs a battle.
- Produces: `type WastefulRule = { kind: 'healAtFull' | 'buffAtMax' | 'cureWithoutStatus' | 'compactWhenEmpty' }`; `type EvalScenario = { id; view: BattleView; wasteful: WastefulRule[] }`; `type EvalSuite = { id; scenarios: EvalScenario[] }` (12 Unseen scenarios); `computeGeneralization(deck, suite, activeSlots): { c: [number, number]; r: [number, number]; h: [number, number]; g: number; band: Band }` (c, r, h as integer numerator/denominator).

- [ ] **Step 1: Write failing tests:** Default excluded from C, R and pairs; worked example — 4 cards, 3 distinct categories, **activeSlots 4** → C = 3/4; exactly one same-category-same-move pair of 6 → R = 1/6; 9 of 12 scenarios fire a non-Default non-wasteful card → H = 3/4; G = round_half_up(100 × (0.35·3/4 + 0.45·3/4 + 0.20·5/6)) = **77** (and with activeSlots 5 → C = 3/5, G = **71**); bands: 69 stable, 70 robust, 39 brittle; a 1-card deck → R = 0; healing at full HP is wasteful.
- [ ] **Step 2–4:** Run → FAIL; implement with integer rationals; run → PASS. **Step 5: Commit** `feat(engine): generalization score and forest eval suite`

### Task B6: Training scenarios and deck-driven benchmark

**Files:**
- Create: `test/scenarios/{broken-deck,prompt-injection,headless}.test.ts`, `test/scenarios/fixtures.ts` (the first Deprecated Forest trainer at fixed levels), golden additions for deck-only moves and levers
- Modify: `scripts/bench.ts` (deck-driven set, `{ kind: 'autopilot' }` on both sides)

- [ ] **Step 1: Write failing tests:**
  - broken deck (heal card below attack card) vs the forest trainer wins ≤ 20/200 seeds; swapped order wins ≥ 180/200 (criterion 5). If placeholder stats prevent this, adjust only the fixture levels or placeholder stats, explain why in the test file, and re-record goldens;
  - an "always strongest attack" deck under Prompt Injected damages its own ally (assert the `Damage` target's side);
  - Headless Mode with bench auto-fill finishes the battle;
  - golden coverage now includes every move and every lever.
- [ ] **Step 2–4:** Run → FAIL; implement fixtures; run → PASS; `pnpm bench` (deck-driven) ≤ 1.2 ms.
- [ ] **Step 5: Commit** `test(engine): training scenarios and deck-driven benchmark`

### Checkpoint B — eval gate

- [ ] **Hard gates:** all Checkpoint A gates; criteria 3 and 5 green; deck-driven benchmark ≤ 1.2 ms; goldens re-recorded and matching on Node, Chromium and WebKit.
- [ ] **Independent review** against the spec; fix blockers and majors.
- [ ] **Scorecard to Travis** (with a sample trace and the broken-deck result). Bump `ENGINE_VERSION` to `0.3.0`, re-record, PR `phase-b-training → main`.

---

# Phase C — Simulator

### Task C1: Sim package, runner and statistics

**Files:**
- Create: `packages/sim/{package.json,tsconfig.json,src/types.ts,src/runner.ts,src/stats.ts,src/cli.ts}`, `packages/sim/test/{stats,runner}.test.ts`

**Interfaces:**
- Consumes: `simulate`, `fnv1a64Hex`, `ENGINE_VERSION`, `SideSetup` from `@latentia/engine`.
- Produces: `type Archetype = { id: string; side: SideSetup }` (in `src/types.ts`); `seedFor(label, i): SeedHex` (FNV of `` `${label}:${i}` `` expanded to 32 hex, never all-zero); `runMatch(a: Archetype, b: Archetype, seeds: number, label: string): MatchStats` with `{ winsA; winsB; draws; rounds: number[] }`; `winRate(s)` (draw = 0.5); `wilson95(wins, n): [number, number]`; `verdict(point, interval, band: [number, number]): 'pass' | 'fail' | 'inconclusive'`; `pointVerdict(point, band)`.

- [ ] **Step 1: Write failing tests:** `wilson95(500, 1000)` ≈ `[0.4691, 0.5309]` (±0.0005); `verdict` inconclusive when the point is inside and the interval crosses an edge; `seedFor` deterministic and unique across 10,000 labels; `runMatch` totals equal `seeds`.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(sim): runner, seeds and wilson statistics`

### Task C2: Archetype decks

**Files:**
- Create: `packages/sim/src/archetypes/{index,speed-rush,reasoning-nuke,open-swarm,code-lock,voice-injection,memory-stall,search-anti-hallu,mixed}.ts`, `packages/sim/test/archetypes.test.ts`

**Interfaces:**
- Produces: `ARCHETYPES: Archetype[]` — 20 entries, slice species only, every side passes `validateSetup`, every grid passes `validateGrid` at its level, every side uses `autopilot`.

- [ ] **Step 1: Write the failing test:** 20 archetypes with unique ids; all valid; every type appears among some team member's types in at least 2 archetypes.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(sim): twenty archetype decks`

### Task C3: Commands, reports and `sim targets`

**Files:**
- Create: `packages/sim/src/commands/{round-robin,matchup,fuzz,targets}.ts`, `packages/sim/src/report.ts`, `packages/sim/src/targets.ts`, `packages/sim/test/{report,targets,matchup}.test.ts`

**Interfaces:**
- Produces: CLI `pnpm sim round-robin --seeds 1000`, `pnpm sim matchup <a> <b> --seeds N`, `pnpm sim fuzz --battles N`, `pnpm sim targets [--seeds-scale k]`; each writes `reports/<command>-<YYYY-MM-DD>.md` and `.csv` (the date comes from the CLI layer). `TARGETS` exactly as §9, with these setups:
  - **Starter triangle:** each starter at L8 as orchestrator with Tokenibble (L8) as its subagent and the standard L8 starter grid, vs the starter it beats, same build; both side assignments pooled; 2,000 battles; band 55–65% for the favoured side.
  - **Temperature dial:** one fixed mixed archetype mirrored; side X's Autopilot `temperature` is 0, side Y's is 4; both assignments pooled; 2,000; within 45–55%.
  - **Graft vs spin-up:** for each of 3 slice species, variant G grafts its signature as a graft piece (its `graftShape`) into the archetype grid; variant S holds it as a subagent in a 2×2 slot with 3 adjacent Example Cards; otherwise identical; 2,000 per species; 45–55%.
  - **Vs field:** pooled over all of an archetype's round-robin battles; ≤ 55%. **Worst matchup:** per unordered pairing, both sides pooled, 2,000 battles; ≥ 30%.
  - **Fight length:** median of round counts over the round-robin, **point-only verdict** (`pointVerdict`), band 5–8.
  - **First mover:** perfect mirror, 10,000 seeds; 48–52%.

- [ ] **Step 1: Write failing tests:** round-robin over 3 tiny archetypes → 3 unordered / 6 ordered pairings; the report lists every target with point, interval (or "point only") and verdict; `targets --seeds-scale 0.01` runs inside a test; `matchup` writes a round-length histogram whose bucket counts sum to N.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(sim): round-robin, matchup, fuzz and targets commands`

### Task C4: Budgeted deck search

**Files:**
- Create: `packages/sim/src/search.ts`, `packages/sim/src/commands/search.ts`, `packages/sim/test/search.test.ts`

**Interfaces:**
- Produces: `searchDeck(base: Archetype, field: Archetype[], budget: number, seed: SeedHex): { deck: Deck; winRate: number; battlesUsed: number; history: number[] }` — hill climbing over 8-card decks with single mutations (replace a card, change condition, change move, reorder), scored vs the field; stops at `budget` battles.

- [ ] **Step 1: Write failing tests:** never exceeds `budget`; deterministic for a seed; accepted-step win rates are non-decreasing.
- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS. **Step 5: Commit** `feat(sim): budgeted hill-climbing deck search`

### Task C5: First full balance report

**Files:**
- Create: `reports/round-robin-<date>.md`, `reports/targets-<date>.md`, `docs/superpowers/notes/first-balance-pass.md`

- [ ] **Step 1:** `pnpm sim round-robin --seeds 1000`; record wall time (criterion 7: < 10 minutes).
- [ ] **Step 2:** `pnpm sim targets`; every target row has a verdict (criterion 6).
- [ ] **Step 3:** `pnpm sim search --archetype speed-rush --budget 20000`; note whether a dominant deck appears.
- [ ] **Step 4:** Write the notes file: which targets fail or are inconclusive, and which *tunable* values to adjust first. Do **not** retune in this task.
- [ ] **Step 5: Commit** `docs(sim): first balance report`

### Checkpoint C — eval gate

- [ ] **Hard gates:** all prior gates, the criterion 6 report, and criterion 7 wall time < 10 minutes.
- [ ] **Independent whole-branch review** against the spec; fix blockers and majors.
- [ ] **Scorecard to Travis** with the targets table and the recommended first tuning moves; PR `phase-c-simulator → main`. Sub-project 1 complete.
