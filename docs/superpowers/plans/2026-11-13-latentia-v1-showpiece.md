# Latentia v1 Showpiece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take v0.1 to a polished 30–45 minute open-source web demo. It ends on the Compile Hall's Green Build Badge and a share card, and it is published on travisjohnjones.com/latentia/.

**Architecture:**
- Polish first: battle effects, then code-generated audio.
- Then systems:
  - one new engine rule, Compile Errors;
  - game-layer progression (XP, levels, v2 evolution, coverage moves);
  - the training screen.
- Then content as data: the north forest, Team Scrape camp, Patchwater, and the Compile Hall with one puzzle room and Gary Rebase.
- Fable's art pass 3 runs in parallel on its own branch and is swapped in near the end. Content builds against placeholders until then.

**Tech Stack:** Phaser 4.2.1, TypeScript (strict), Vite, Vitest, Playwright, Web Audio (no files), and `@latentia/engine` (deterministic, integer basis points).

**Spec:** docs/superpowers/specs/2026-11-13-latentia-v1-showpiece-design.md (approved by Travis 2026-11-13). Also read its "Calls made after the builder check" section. For content details, see the design bible (docs/design-bible.md): the Team Scrape camp row, "Design: the Compile Hall gym" and the species table.

## Global Constraints
- **Branch and worktree:** `game/v1` in /home/claude/latentia-game. Art is on `art/pass-3` in /home/claude/latentia-art.
- **Commits:**
  - authored as CosmonautJones <travisjohn.jones@gmail.com>, with no Co-Authored-By line;
  - commit after every working step;
  - never push, and never dispatch subagents.
- **Engine:**
  - used only through its public API;
  - the one allowed rule change is Task 3's Compile Errors (engine 0.5.0);
  - existing golden hashes must stay byte-identical.
- **Layout:**
  - every scene follows the logical-size rule (Ruling V16: short side 240–270, long side 426–540);
  - menus stay in the image;
  - the occluder invariant must hold for every new HUD, interactive or panel rect (`layout/` exports the occluders);
  - tap targets are ≥ 44 CSS px.
- **Art:** Endesga 32 only. Content tasks use placeholders (generated species placeholders; palette-shifted existing tiles and characters) until Task 10.
- **Copy:**
  - no real lab, model, product or company names;
  - no echoes of an existing franchise's creatures, slogans or capture mechanic;
  - the copy-guard test runs over all new text.
- **Audio:** generated in code, with no audio files and no network. It starts after the first user gesture, has a mute that is saved, and is silent without errors when `AudioContext` is unavailable.
- **Build:** `build:single` stays under 5 MiB and plays inside `<iframe sandbox="allow-scripts">`.
- **Saves:** the schema goes v4 → v5, migrated. Every v4 save step continues correctly.
- **Gates:** files stay under about 300 lines. Root `pnpm lint && pnpm typecheck && pnpm test` and `pnpm --filter @latentia/game e2e` pass at the end of every task.

## Review Focus
1. **A v0.1 player whose save is at `end`** (they beat Bootcamp Grad) loads v1. They expect to continue north into the new content, not to see the old end card forever. Owner: Task 4 (migration test).
2. **Audio on a phone:**
   - The first tap unlocks sound.
   - Mute survives a reload.
   - In the sandboxed iframe, or without `AudioContext`, the game is silent with no console errors.
   Owner: Task 2.
3. **Effects never decide or block:**
   - With reduce-motion on, and at 2× speed, every battle event still plays in order.
   - Input unlocks at the same point it does without effects.
   - The outcome is identical with effects on or off: same seed, same result.
   Owner: Task 1.
4. **The Debug the Bot puzzle on a phone:**
   - The token editor's lines and tokens are tappable at ≥ 44 CSS px, in both orientations, clear of the controls.
   - Long-press B resets on touch as well as on the keyboard.
   Owner: Task 8.
5. **The share card when the clipboard write is refused,** as in the sandbox or an old browser: the text is shown selectable with "Copy failed: select and copy", and nothing crashes. Owner: Task 8.

---

### Task 1: Battle juice (polish first)
**Files:**
- Create: `packages/game/src/battle-ui/fx/` with these modules:
  - `type-fx.ts`: one effect per type (Reasoning, Speed, Open, Code, Search, Memory, Vision, Voice), plus guard and status;
  - `damage-number.ts`;
  - `shake.ts`;
  - `intro.ts`: the slide-ins;
  - `ko.ts`.
- Create: `packages/game/src/battle/fx-plan.ts`. This is pure: it maps a playback event to `FxCue[]`.
- Modify: `battle/timeline.ts` and `battle-ui/stage.ts` to schedule cues inside existing event steps.
- Create: `save/settings.ts`, device settings separate from the run save: localStorage key `latentia.settings`, holding `{ reduceMotion: boolean; muted: boolean }`, read and written in try/catch, falling back to memory. Add a "Reduce motion" toggle to the battle system row.
- Tests: `test/unit/fx-plan.test.ts` and an e2e `fx.spec.ts`.

**Interfaces:**
- Produces:
  - `type FxCue = { kind: 'typeHit'|'guard'|'status'|'damageNumber'|'shake'|'crit'|'ko'|'intro'; targetSlot: SlotId; type?: TypeId; amount?: number; crit?: boolean }`
  - `planFx(step: EventStep, opts: { reduceMotion: boolean }): FxCue[]`
  - `loadSettings(): Settings` and `saveSettings(s: Settings): void`, with `Settings = { reduceMotion: boolean; muted: boolean }` (Task 2 uses `muted`)

**Steps:**
- [ ] **Tests for `planFx`:**
  - every engine event type that the playback renders maps to a defined cue list (iterate over the event-type list from `event-steps.ts`);
  - a crit adds `crit` and `shake`;
  - with `reduceMotion`, there are no `shake` cues and no `intro` slide (only a fade);
  - `damageNumber.amount` equals the event's damage.
- [ ] Implement `fx-plan.ts`, then the fx modules. Effects are short (≤ 450 ms at 1×, halved at 2×). They are type-coloured from the palette and never block input beyond the existing step dwell.
- [ ] **E2e:**
  - a Kip fight at 1×, at 2× and with reduce-motion produces the same `battleResult` and the same hook-reported event order (Review Focus 3);
  - no console errors.
- [ ] Screenshots: one mid-hit at 390×844 and at 844×390. View them.
- [ ] Commit.

### Task 2: Audio (code-generated)
**Files:**
- Create in `packages/game/src/audio/`:
  - `engine.ts`: lazy `AudioContext`, unlock on the first gesture, master gain, mute;
  - `sfx.ts`: synth voices for blip, text tick, hit, crit, guard, KO, level-up, evolve, door, step;
  - `sequencer.ts`: plays a `Song` defined as data;
  - `songs/battle.ts`, `songs/town.ts`, `songs/forest.ts`, `songs/gym.ts`.
- Modify: scenes to call `audio.music(id)` and `audio.sfx(id)`. Add a "Sound on/off" item to the title and to the battle system row.
- Tests: `test/unit/sequencer.test.ts`, `test/unit/audio-engine.test.ts` (with a fake `AudioContext`), and an e2e `audio.spec.ts`.

**Interfaces:**
- Produces:
  - `audio.sfx(id: SfxId): void`
  - `audio.music(id: SongId | null): void`
  - `audio.setMuted(m: boolean): void`
  - `type Song = { bpm: number; channels: Channel[] }`, with channels as square, square, triangle and noise, each holding a note list.

**Steps:**
- [ ] **Tests:**
  - `sequencer` schedules the notes of a 1-bar test song at the right times for its bpm;
  - looping wraps the time correctly;
  - `audio-engine`: no `AudioContext` is created before `unlock()`;
  - `setMuted(true)` sets the master gain to 0 and persists to settings;
  - when the constructor throws, every call is a silent no-op.
- [ ] Implement them.
- [ ] **Audio bar:**
  - must have: all the SFX, the **battle** song, and mute;
  - should have: the town, forest and gym songs. If the time-box runs short, these are cut first.
  - Songs are original melodies.
- [ ] **E2e:**
  - in the sandboxed-iframe `build:single`, there are no console errors with audio calls firing;
  - mute persists across a reload;
  - the hook reports `audio.state` as `'locked'` before the first tap and `'running'` after it (in Chromium).
- [ ] Commit.

### Task 3: Engine, the Compile Errors rule (engine 0.5.0)
**Files:**
- Modify: `packages/engine/src/content/primitives.ts` (setup-level rule type), `battle/setup-shape.ts`, `battle/validate-setup.ts`, `battle/resolve.ts` (or the action-resolution step), `events/` (new event), `index.ts` (export) and `package.json` (0.5.0).
- Tests: `packages/engine/test/compile-errors.test.ts`, plus a new golden `golden/compile-errors-*`.

**Interfaces:**
- Produces:
  - `BattleSetup.rules?: { compileErrors?: { limit: 3 } }`
  - event `{ kind: 'compileError'; actor: SlotId; move: string }`
- Semantics: when a creature is about to resolve the same move id it resolved in each of its previous `limit − 1` actions, consecutively, that action **fails**. It costs no context, emits `compileError`, and resets the streak. This applies to every creature on both sides. With `rules` absent, behaviour is byte-identical to 0.4.2.

**Steps:**
- [ ] **Tests:**
  - with `compileErrors` set, a creature using the same move 3 actions running fails on the 3rd with a `compileError` event, and its 4th action is unaffected;
  - alternating A, B, A, B never triggers it;
  - foe and ally slots are both affected;
  - with `rules` absent, every existing golden hash is unchanged (run the full golden suite);
  - setup validation rejects `limit` other than 3.
- [ ] Implement it. Add `previewDamage`-style documentation to the engine's public API notes.
- [ ] Bump to 0.5.0, then run engine, sim and game tests.
- [ ] Commit.

### Task 4: Progression: XP, levels, save v5
**Files:**
- Create: `packages/game/src/progress/xp.ts` (pure), `progress/level-up.ts` (stat deltas in plain words) and `scenes/xp-panel.ts` (an after-fight overlay).
- Modify: `save/save.ts` and `save/progress-shape.ts` (v5: per-creature `{level, xp, version, pinned, cardsUnlocked}`), `flow/flow.ts` (the new steps, below), `content/battles.ts` (setups read levels from progress).
- Tests: `test/unit/xp.test.ts`, `test/unit/save-v5.test.ts`, `test/unit/flow-v1.test.ts`.

**Interfaces:**
- Produces:
  - `xpToNext(level: number): number = 10 + 6 * level`
  - `battleXp(enemyLevel: number, firstSpecies: boolean): number = 8 + 2 * enemyLevel + (firstSpecies ? 10 : 0)`
  - `applyXp(c: CreatureProgress, xp: number): { next: CreatureProgress; levelsGained: number }`
  - Flow `STEPS` gains `'north'`, `'camp'`, `'patchwater'`, `'gymLobby'`, `'gymPuzzle'`, `'gymLeader'` and `'badge'`, in that order after `'debrief'`. `'end'` stays last. `OVERWORLD_STEPS` adds the new overworld steps.

**Steps:**
- [ ] **Tests:**
  - `xpToNext(10) === 70`;
  - reaching L12 from L1 sums to 506;
  - `battleXp(10, false) === 28`;
  - `applyXp` handles multiple level-ups in one award;
  - v4→v5 migration at every v4 step;
  - **a v4 save at `end` with `trainerBeaten` migrates to step `north`** (Review Focus 1);
  - the v1 flow has no dead ends and every step is reachable;
  - Continue resumes at each new step.
- [ ] Implement it. Levels feed the engine setups. Base stats scale by level through the engine's existing level factor; the game passes `level` only.
- [ ] Add the XP panel after every won fight: XP gained, the bar filling, "Level up! L6" with SFX, and plain-word deltas.
- [ ] Commit.

### Task 5: Evolution v2 and coverage moves
**Files:**
- Create: `progress/evolution.ts` (pure) and `scenes/evolve.ts`.
- Modify: `content/species-versions.ts` (new: per-starter v2 data, a card slot +1 and one move upgrade from the bible), `scenes/` hooks after the XP panel, and the starters' learnsets in `content/` (the coverage move).
- Create: `scripts/pick-coverage.ts`, a sim script.
- Tests: `test/unit/evolution.test.ts`, `test/unit/coverage.test.ts`.

**Interfaces:**
- Consumes: Task 4's `CreatureProgress`.
- Produces:
  - `shouldEvolve(c: CreatureProgress): boolean`, true when the level is ≥ 6, the version is `'v1'`, and the creature isn't pinned;
  - `evolve(c): CreatureProgress`;
  - `versionLabel(speciesId, version): string`, e.g. "Sagelet v2".

**Steps:**
- [ ] **Tests:**
  - evolution triggers at L6, not when pinned, and only once;
  - the "Pin version" choice persists;
  - v2 adds exactly one card slot and the listed move upgrade;
  - `versionLabel('sagelet','v2') === 'Sagelet v2'`.
- [ ] The evolution scene shows a satirical changelog per starter: 3 short lines, original jokes ("v2: now 12% more confident"). It has "Evolve" and "Pin v1" options. Until Task 10 the art is a palette swap of the v1 sprite.
- [ ] **Coverage moves:**
  - `pick-coverage.ts` tries each starter's candidate off-type moves from the engine's existing moves;
  - choose one per starter so that each starter's worst v1 matchup (Kip, Grunt A, Gary) improves and the starter triangle stays 55–70% for the favoured side (existing sim, 1000 seeds);
  - record the chosen moves and their numbers in a comment in the content file;
  - the test asserts the triangle band using a smaller seed count, run loosely.
- [ ] Commit.

### Task 6: Training screen
**Files:**
- Create: `scenes/training.ts` and `training/sparring.ts` (pure: runs N rounds with the engine against a dummy and returns plain-word lines).
- Modify: `content/cards.ts` (new or extended: unlockable cards with plain-word text), the loss panel (link to Training), and Patchwater's Retraining Center (Task 7 places the NPC).
- Tests: `test/unit/sparring.test.ts`, `test/unit/card-unlocks.test.ts`, an e2e `training.spec.ts`.

**Interfaces:**
- Produces:
  - `openTraining(from: 'debrief' | 'center')`
  - `unlockCard(id: CardId)`
  - `sparringPreview(deck: Deck, seed: number, rounds: 3): string[]`
  - card ids include `'antiRepeat'`: `{ subject: 'self', condition: { category: 'cooldown', rounds: 1 }, move: <slot move A> }`, with the Default card using move B, which makes the subagent alternate A and B.

**Steps:**
- [ ] **Tests:**
  - `sparringPreview` is deterministic for a seed and returns 3 lines;
  - an unlocked card appears in the list and a locked one doesn't;
  - swapping saves;
  - the card count is bounded by the creature's slots (Task 5);
  - the `antiRepeat` deck never resolves the same move 3 actions running under Compile Errors (engine sim, 50 seeds).
- [ ] The UI is in the image in both orientations, inside the occluder invariant: slots, the card list with plain words, "Spar (3 rounds)".
- [ ] E2e: open from the loss panel, swap, spar, back.
- [ ] Commit.

### Task 7: North forest, Team Scrape camp, Patchwater (content)
**Files:**
- Create: `content/maps/forest-north.ts`, `content/maps/patchwater.ts`, `content/npcs-v1.ts`, `content/trainers-v1.ts` (Grunt A mandatory, Grunt B and one forest trainer optional) and `content/wilds-v1.ts`.
- Modify: `content/battles.ts`, `overworld/` (the `aggro` and `idle_sleep` behaviours if missing, and the redirect-arrow tiles as decoration only), plus the warps from the trailhead.
- Tests: `test/unit/maps-v1.test.ts` (map validation, reachability, no softlock tiles), `test/unit/trainers-v1.test.ts` (setups validate), and an e2e `journey-v1.spec.ts` (part 1).

**Steps:**
- [ ] **Wilds** (visible encounters, as the bible says):
  - Nullbeetle (wander) and Heisenmoth (skittish), L3–5;
  - Embeddingo (idle_sleep), L5;
  - a scraped Slopling (aggro), L5–6.
- [ ] **Grunt A:** Scrapion and Nullbeetle. Line: "We're not cutting trees, we're optimising biomass." Beating him unlocks a card (Task 6's `unlockCard`) and sets `flags.camp.gruntA`.
- [ ] **Patchwater:**
  - the Retraining Center: heal, plus the training NPC;
  - the petitioner NPC;
  - the reservoir gauge sign, with the water satire;
  - the Compile Hall door, locked until `camp.gruntA`.
- [ ] **Balance:** Grunt A naive win ≥ 75% at the expected level (measure through `measure-loop`, with a new row).
- [ ] **Tests:**
  - every map validates;
  - every warp is two-way where it should be;
  - the path from the trailhead to the Compile Hall door exists;
  - no NPC blocks a 1-tile chokepoint;
  - the copy guard passes.
- [ ] Commit.

### Task 8: Compile Hall, Gary Rebase, badge, share card
**Files:**
- Create:
  - `content/maps/compile-hall.ts` (lobby, puzzle room, arena; each 20×11);
  - `puzzle/debug-bot.ts` (pure: the program, edits, run, the first-error rule);
  - `scenes/debug-bot.ts` (UI);
  - `content/gym.ts` (Gary's setup with `rules.compileErrors`, his shown deck and his pre-fight "code review" text);
  - `scenes/badge.ts`;
  - `share/share-card.ts` (pure text) and `scenes/share.ts`.
- Modify: `scenes/end.ts` (it now follows the badge and links to Share), `measure-loop` (Gary rows).
- Tests: `test/unit/debug-bot.test.ts`, `test/unit/share-card.test.ts`, `test/unit/gym-balance.test.ts`, an e2e `journey-v1.spec.ts` (part 2, through to the end card) and `puzzle-touch.spec.ts`.

**Interfaces:**
- Consumes: Task 3's `rules.compileErrors`, Task 6's `unlockCard('antiRepeat')`.
- Produces:
  - `runProgram(p: Program): { path: Pos[]; result: 'goal' | 'crash' }`
  - `applyEdit(p, line, token): Program`
  - `shareText(stats: RunStats): string`

**Steps:**
- [ ] **Debug the Bot tests:**
  - Linty's program `MOVE 8 · TURN RIGHT · MOVE 2 · TURN LEFT · MOVE 5` crashes;
  - changing `MOVE 2` to `MOVE 3` reaches the goal;
  - on the second terminal, fixing the later bug first crashes ("fix the first error first"), and fixing the earlier one succeeds;
  - only one edit is allowed;
  - a reset restores the original program.
- [ ] **Puzzle UI:**
  - up/down picks a line and left/right cycles its token; touch taps the line, then the token (Review Focus 4);
  - B undoes and a long-press resets, on the keyboard and on the touch B button;
  - a crash shows "Stack overflow — respawning at line 1" and resets after a beat;
  - Dukk gives one hint sentence;
  - success awards `antiRepeat` with a plain-word explanation, "Linty's fix: never repeat yourself 3 times".
- [ ] **Gary:**
  - Spaghettopus v2 (orchestrator) with Vibrat and Agentoad, his deck including Unit Test ("punishes predictable decks");
  - his levels are set from the measured XP on arrival (record the arrival-level distribution: mandatory fights plus half the optional ones);
  - his pre-fight panel shows his deck in plain words and states the Compile Errors rule.
- [ ] **Balance test (`gym-balance.test.ts`, loose seeds; the full 200 seeds per starter goes in `measure-loop`):**
  - the Default card wins ≤ 40%;
  - `antiRepeat` wins ≥ 70% for every starter;
  - on the graft path, the "varies commands" player wins ≥ 60%;
  - the telegraph reader beats naive.
- [ ] **Badge scene:**
  - the Green Build Badge;
  - the post line "BENCHMARK SATURATED. Benchmark 2: Harder Edition, Coming Soon";
  - then the Route 404 sign in Localhost reads "coming in a future update".
- [ ] **Share card:**
  - `shareText` gives a spoiler-free line plus an emoji grid of fights (win, or loss → rematch), the receipt and the link `travisjohnjones.com/latentia/`;
  - a Copy button uses `navigator.clipboard.writeText` from a tap;
  - on refusal, the text is shown selectable with "Copy failed: select and copy" (Review Focus 5);
  - test: the text is deterministic for given stats.
- [ ] The end card follows the badge. Free roam stays available afterwards.
- [ ] **E2e:** the full v1 journey on the spin-up path in portrait 390×844 (through the puzzle, Gary, badge, share and end), and a graft-path run on desktop.
- [ ] Commit.

### Task 9: Fable art pass 3 (parallel from the start; /home/claude/latentia-art, branch `art/pass-3` cut from `origin/main`)
**Deliverables** (same pipeline and specs as pass 2: `packages/art/src/pass2.mjs`, the drawing kit, manifest, contact sheets):
- **Battle sprites:** Nullbeetle, Scrapion, Slopling (scraped variant), Embeddingo, Spaghettopus and Agentoad at 96×96, each with a 6-frame idle and a 2-frame hit. Heisenmoth is a stretch goal.
- **v2 overlays** for Sagelet, Blitzr and Forkling: a palette swap plus one piece ("more chrome, more badges").
- **Blitzr fix:** replace the zigzag bolts with swept speed streaks or fast-forward chevrons (spec "Art"; the originality concern from pass 2).
- **Tiles** (24×24):
  - forest-north and camp: tents, crates, a cage, redirect-arrow tiles;
  - Patchwater: buildings, the reservoir gauge, the plaza;
  - the Compile Hall interior: floor, walls, Linty's terminal, the Dukk statue, the arena.
- Neighbour-aware path/grass edge tiles.
- **Characters** (24×32, 4 directions × idle + 2 walk): Team Scrape grunts (2 palette variants), Gary Rebase, the receptionist, the guide, the petitioner. Dukk is a single static frame.
- Fixes to the pass-2 side-view heads (the player, Kip, the Professor).
- **Battle backdrops:** 4 layered backdrops (trailhead, north forest/camp, gym arena, lab) at 540×270, plus a 270×540 portrait variant, or a layered design that crops cleanly to both.
- Order: the Blitzr fix and the 6 species first, then the backdrops, tiles and characters, then the head fixes.

### Task 10: Art integration and backdrops
**Files:**
- Modify: `packages/game` art sync (`scripts/sync-art.ts`), the manifest mapping module, `battle-ui/stage.ts` (a backdrop layer, chosen by battle id), the evolution scene (v2 overlays), and the maps (new tile kinds and edge auto-tiling).
- Tests: the existing manifest-coverage test, extended to every new frame and tile; a backdrop-selection unit test.

**Steps:**
- [ ] Merge `origin/art/pass-3` into `game/v1`, then run `sync-art`.
- [ ] Replace every placeholder. The edges auto-tile from neighbours.
- [ ] Backdrops render behind the field in both orientations, cropping without stretching, and never under an interactive rect.
- [ ] Update `ART_REACH` and its PNG check for the new species.
- [ ] Screenshots of every new scene at the five review sizes. View them.
- [ ] Commit.

### Task 11: Open-source readiness
**Files:**
- Create: `LICENSE` (MIT, © 2026 Travis Jones, code only), `ASSETS-LICENSE.md` (the text from the spec's "Open source" section), a root `README.md`, `CONTRIBUTING.md`, and `.github/ISSUE_TEMPLATE/{bug,species-idea,content-idea}.yml`.
- Modify: `.gitignore`, so `.superpowers/` and the implementer reports stay ignored. Check this with `git ls-files`.

**Steps:**
- [ ] The README covers:
  - the pitch;
  - a play link (the portfolio URL);
  - one screenshot or GIF from `test/screenshots`;
  - quick start (`pnpm i`, `pnpm --filter @latentia/game dev`);
  - the repo map (engine, sim, game, art, docs);
  - the licence summary;
  - a contributing link.
- [ ] CONTRIBUTING covers:
  - setup and tests;
  - the commit style;
  - the originality and copy rules;
  - the art pipeline;
  - the contributor line: "By contributing content you assign its copyright to the project owner";
  - **"Add a species in 6 steps"**: engine species entry, learnset, art sources and build, `sync-art`, a wild or trainer placement, tests. It's verified by following it end to end for Heisenmoth's art if pass 3 drew it, otherwise as a dry run with a placeholder.
- [ ] Test: a fresh clone into /tmp, then `pnpm i --frozen-lockfile && pnpm test && pnpm --filter @latentia/game build:single` succeeds.
- [ ] Commit.

### Task 12: Final review and playtest build (controller)
- [ ] Run a whole-branch review (most capable model), one fix dispatch, and a scoped re-review.
- [ ] Run `build:single` and republish the private artifact (slug 5bb19d5b-967a-445e-b1d3-673d45eb02df), retitled "Latentia v1".
- [ ] Travis playtests. His feedback goes through one more fix pass if needed.

### Task 13: Release (controller, after Travis's go-ahead from the playtest)
- [ ] Open a PR from `game/v1` to `main`. Merge it after Travis's go-ahead from the playtest, with CI green. Tag `v1.0.0`.
- [ ] **Portfolio:**
  - copy `dist-single/index.html` into the Portfolio repo's `public/latentia/index.html`;
  - add the project card and case study (`src/lib/constants.ts`, `src/app/(public)/work/latentia/page.tsx`) with the GitHub link and 3–4 screenshots;
  - run the Portfolio tests;
  - follow the Portfolio repo's CLAUDE.md for commit identity and pushing;
  - check the Netlify deploy and load travisjohnjones.com/latentia/ once.
- [ ] File 8–12 good-first-issues from the spec's non-goals.
