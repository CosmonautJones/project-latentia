# @latentia/game

**Latentia v0**, the first playable version of Latentia: a satirical creature collector where the creatures are AI
agents. You command an orchestrator model in turn-based battles, distill a wild model into a subagent, teach it an
`IF … THEN …` example card, and find out what it does with it. 8-bit art, 320×180, desktop and phone.

The client is Phaser 4, TypeScript (strict) and Vite, and it uses only `@latentia/engine`'s public API. It covers
P1–P5 of the playable-v0 plan (`docs/superpowers/plans/2026-11-10-playable-v0.md`).

## The v0 journey (10–15 minutes)

1. **Title**: New Game, or Continue when a save exists.
2. **Lab**: Prof. Epoch's intro, then pick Sagelet (Reasoning), Blitzr (Speed) or Forkling (Open).
3. **Rival**: Kip brings the counter-type starter, one on one at L5. Losing restarts the fight.
4. **Walk** out of the lab, through Localhost, to the Deprecated Forest trailhead (a sign, an NPC).
5. **Wild Tokenibble** (L3) jumps out of the unindexed-data patch.
6. **Distill** it: **Spin up** (a subagent with one card slot) or **Graft** (its Token Nibble on your grid).
7. **Card tutorial** (spin-up only): teach Tokenibble one of three example cards.
8. **Bootcamp Grad**: lose, read what Tokenibble kept doing (or the graft hint), swap the card, rematch.
9. **End card**: turns, cards fired, losses → swaps → rematches, and the virtual water receipt (satire).

## Run it

From the repo root:

```sh
pnpm install
pnpm --filter @latentia/game dev          # Vite dev server with hot reload (the dev hook is on)
pnpm --filter @latentia/game build        # production build into packages/game/dist
pnpm --filter @latentia/game preview      # serve the production build
pnpm --filter @latentia/game test         # Vitest unit tests (pure modules only)
pnpm --filter @latentia/game typecheck
pnpm --filter @latentia/game e2e          # test build + production build + Playwright tests (Chromium)
pnpm --filter @latentia/game screenshots  # re-shoot test/screenshots/*.png (add `-- --grep journey` for the journey only)
pnpm --filter @latentia/game measure-loop # the core-loop balance measurement (200 seeds; numbers in content/trainers.ts)
```

`CPU_THROTTLE=4 pnpm --filter @latentia/game exec playwright test mobile -g "frame rate"` prints the phone frame rate
with the CPU slowed 4× (the normal run asserts at least 55 fps unthrottled; measured 59.7 on the overworld and 60.3 in
battle at 390×844, DPR 3, and 58.8 / 59.7 at 4×).

The root `pnpm lint`, `pnpm typecheck` and `pnpm test` include this package.

**Playwright.** Locally, the tests run on Google Chrome through the `chrome` channel, because the Playwright browser
download is blocked here (the engine's browser tests do the same). In CI (`CI` set) they use Playwright's own
Chromium, which needs `pnpm --filter @latentia/game exec playwright install chromium` first. `e2e` builds with
`vite build --mode test` into `dist-test/` and serves it with `vite preview`; it also runs the production build into
`dist/`, which `test/e2e/dist.spec.ts` checks and serves from a nested path. The tests fail on any console error or
uncaught exception.

## Production build and publishing

`pnpm --filter @latentia/game build` writes a static site to `packages/game/dist` (8 files, about 1.64 MB: Phaser is
1.39 MB of it, 372 kB gzipped; the game 222 kB, 72 kB gzipped). It is made to be published as one static page from
any path, such as a Claude artifact:

- `base: './'` in `vite.config.ts`: every asset URL is relative, so it runs from a sub-directory.
- No network requests beyond its own files: no CDNs, no web fonts (the font is drawn in code), no analytics.
- The dev hook and the test-only probes are compiled out (`import.meta.env.DEV || MODE === 'test'` folds to false).
- A phone viewport (no pinch or double-tap zoom) and the title `Latentia v0`.

`test/e2e/dist.spec.ts` guards all of this: it greps the bundle, then serves `dist/` from `/some/sub/dir/` and plays
from the title into the lab and the first battle with no console errors, no failed requests and nothing fetched from
outside that path.

## Controls

All input goes through one action stream (`src/input/hub.ts`) of six buttons: up, down, left, right, A and B.

| Button | Keyboard | Touch |
|---|---|---|
| Directions | Arrow keys or WASD | The D-pad |
| A (confirm, advance text) | Z or Enter | A |
| B (back, cancel) | X or Esc | B |

- Keys are matched by physical position (`KeyboardEvent.code`), so WASD/ZX sit in the same place on any layout.
  Chords with Ctrl, Cmd or Alt are left to the browser.
- Tapping or clicking a menu item moves the cursor there and confirms it. On a phone every menu (title, choices,
  battle commands, the end card) is a row of DOM buttons in the band, at least 44×44 CSS px, in both orientations.
- In battle, a move, a temperature notch or a target takes two taps on touch: the first selects it and shows its
  hint, the second commits. Keys and the D-pad act at once.
- In dialogue, A while a page is typing finishes it at once; A on a finished page turns it. Holding A or B types
  4× faster. The battle's "why?" popup also closes on B.
- Held buttons are released when the window loses focus or the page is hidden.

## Layout

The game renders at **320×180** with `pixelArt: true` and is scaled by an **integer number of device pixels** per
game pixel (`src/layout/compute.ts`, unit-tested). So a 390-CSS-px phone at DPR 3 gets 3× = 320 CSS px, and every
game pixel is an exact square of device pixels.

- **Landscape** (the viewport is wider than it is tall): the largest integer scale that fits, centred and
  letterboxed. For example, 1920×1080 gets 6× with no bars, and 1366×768 gets 4× (1280×720 at 43, 24). On touch
  devices (touch landscape) the D-pad and A/B sit in 150 CSS px side margins, and the game sits on top at the largest
  scale that also leaves a **menu band** of at least 140 CSS px under it, between the controls (844×390 at DPR 3 gets
  4×, 427×240, with a 150 px band). Menus there are band buttons in two or three columns. If no scale leaves room for
  a band, the menus stay on the canvas; if none leaves the side margins either, the controls overlay the corners.
- **Portrait**: the screen sits at the top, scaled to the width while leaving at least 200 CSS px below it. Below
  it is a DS-style **bottom band** holding the touch controls and `#band-panel`, where every menu goes as DOM
  buttons. A choice panel then keeps only its title and text on the canvas; each band button carries the label and
  a smaller detail line, so nothing shows twice. `layout.menus` (`canvas` or `band`) says which.
- **Rotation** keeps the state: a menu keeps its cursor and an armed two-tap move, a dialogue stays up, and keys keep
  working; choice panels rebuild for the new layout (`test/e2e/mobile.spec.ts`).
- The layout is recomputed on resize, orientation change and DPR change, at most once per frame
  (`src/layout/apply.ts`). Phaser runs in `FIT` mode inside a parent that is sized to the exact integer rect.
- The touch controls are DOM buttons (56–64 CSS px). Their labels are drawn from the game font as inline SVG.

## Text

The font is drawn in code (`src/text/glyphs.ts`): 5×8 glyphs on a 6×10 cell, covering printable ASCII plus
`… → ← ↑ ↓ ✓ × ▶ ▼`. At boot it is rasterised to a canvas texture and registered as a Phaser RetroFont. No
font files and no licences are involved. Text the font can't draw becomes `?`, and smart quotes and dashes become
ASCII. All story text goes through `DialogueBox` (`src/ui/dialogue-box.ts`): a typewriter showing at most 3 lines of
36 characters, per the design bible.

## Battles

The Battle scene (`src/scenes/battle.ts`) drives the engine **only through its public API**:
`validateSetup` → `createBattle` → `getIntents` before each command → `submitRound` → play the returned events.
`src/battle/session.ts` holds the latest engine state and only reads it; sides with an Autopilot deck (Kip, the wild
Tokenibble, the Bootcamp Grad) send no command and are driven by their decks, and so is a player's subagent.

- **Content** (`src/content/battles.ts`, decks in `src/content/trainers.ts`): the rival fight (Kip picks the starter
  that counters yours — Speed > Reasoning > Open > Speed — both L5 and solo, Ruling 146), the wild L3 Tokenibble,
  and the Bootcamp Grad (an L6 Vibrat; on the spin-up path the player brings Tokenibble L3 with a one-card deck). A
  spun-up Tokenibble keeps only Token Burst, Early Exit and Low Latency (its signature stays behind); the three
  tutorial presets are one good, one situational and one bad card, measured in a unit test.
  Every setup is checked with `validateSetup` in `test/unit/battles.test.ts`. Kip's deck is a coin flip between a
  weak jab and Compact, because at L5 a counter-type that attacked every round could not be beaten.
- **UI** at 320×180: foe and player panels (name, level, HP with a lagging ghost chunk, context bar, status chips),
  the intent preview (your subagents' plans in full; a foe's shows "?" unless your side reveals it: Red Team,
  Saliency Map, Socratic Method), the temperature dial (named "T2·1.0", with a tooltip per notch), a move menu with
  context costs (moves that would overflow are greyed with an "overflow → Drift" warning, and stay selectable because
  the engine allows it), **WHY?** (each deck-driven creature's latest CardTrace in plain words, only ever after it
  acted), **LOG** (the last 40 battle lines) and a 1×/2× speed toggle. B backs out of every submenu.
- **Input**: keys and the D-pad act at once; on touch and pointer a move, notch or target takes two taps (the first
  selects it and shows its hint, the second commits). A click or tap on the screen advances dialogue.
- **Layout**: on desktop the menus are on the canvas; on phones (portrait, and touch landscape when the band fits)
  they are DOM buttons in the band (`src/battle-ui/band-menu.ts`, 44 CSS px rows, scrolling on short screens), drawn
  in the game font, while the canvas box keeps the prompt and the highlighted move's hint.
- **First-time hints** explain PROMPT, context (CX, COST, Drift and the DR chip), the dial, WHY? and the intent
  preview (taught at the first battle with your own subagent), once each; the save remembers them (schema v2).
- **Playback**: `src/battle/event-steps.ts` maps every engine event type to UI steps (a text fallback at least;
  the unit test enumerates the event union), and `src/battle/timeline.ts` paces them: windup, a 3-frame hit-stop
  with a white flash, HP drain, status icons, faint, swap, context and Drift. A round's animation fits in 1.4 s at
  1×; each line stays up for its dwell (about 640 ms for a major line) while the animation runs on under it. 2×
  halves both.
- **Result**: a win sends `battleWon`; a loss (or a round-cap draw) sends `battleLost`, which restarts the fight. A
  loss to the trainer also says what the player's deck-driven teammates kept doing (`summarizeTraces`).

## Creature art

- **Sagelet, Blitzr and Forkling** use the Fable style-test idle sheets from the `art/style-test` branch
  (`art/style-test/<starter>-idle-sheet.png`, commit 1766d4c), copied to `public/assets/<starter>-idle.png`: six
  64×64 frames at 100 ms (Blitzr 75 ms), as authored. They are placeholder art by the project's own art pipeline;
  see that branch's `art/style-test/NOTES.md`.
- **Every other species** gets a generated placeholder (`src/battle/creature-art.ts`): a rounded silhouette in its
  type colour with a dark outline, shade on the lower left and its initial, all from Endesga 32, breathing on two
  frames.
- **Back view (v0 stand-in):** the player's creatures are the front art flipped to face right and darkened with a
  multiply tint. Real back sprites come with the final art.

## Overworld

- **The map** is `src/content/maps/localhost.ts`: Prof. Epoch's lab (12×8), then one 48×13 exterior running west to
  east through Localhost, a short path and the Deprecated Forest trailhead (sign, the "unindexed data" patch where
  Tokenibble waits, then Bootcamp Grad in the one-tile gap beyond). 16×16 tiles.
- **Format:** typed character grids, one char per tile, read through `LEGEND` in `src/overworld/map.ts`
  (`W` wall, `K` server rack, `_` floor, `D` door, `R` roof, `.` grass, `,` path, `#` tree, `%` autumn tree, `S`
  sign, `"` the wild patch). Signs, NPCs, the trainer, warps, the encounter and each overworld step's spawn are
  plain data beside the grids, addressed as `{ area, x, y }`. Chosen over Tiled JSON: type-checked, diffable,
  editable by hand.
- **Validation** (`src/overworld/validate.ts`, run in `test/unit/overworld-map.test.ts`): warps land on walkable
  tiles and never on another warp, spawns are walkable, sign tiles have text, NPCs stand on open ground, the
  trainer's sightline is clear, the lab connects to the trainer, the patch can't be walked around, and the trainer
  really blocks the way on.
- **Rules** are pure (`src/overworld/`): `walker.ts` (a tile per step, 250 ms, hold to walk, tap to turn), `rules.ts`
  (collision, what a finished step sets off, what A does), `sight.ts`, `camera.ts` (2×1-tile deadzone, clamped,
  small rooms centred), `reach.ts` (BFS through warps). Tiles and figures are generated from Endesga 32
  (`tile-art.ts`, `figure-art.ts`); the patch sways on 2 frames.
- **Triggers:** the patch starts the wild battle on the first walk only (`reachedTrailhead`); after the distill the
  flow's `forest` step makes the patch calm and Bootcamp Grad's sight (4 tiles) live: "!", it walks over, says its
  line, then `trainerEngaged` starts the battle. Before the distill the Grad only blocks the way with a line.
- **Steps on the map:** `lab` (facing Prof. Epoch: his intro, then the starter panel; B replays him), `walk` (spawns
  in the lab), `cardTutorial` (the cards hint, then the three example cards over the trailhead; B replays the hint)
  and `forest` (spawns in the calm patch). Continue and a won battle land at the step's spawn.

## Flow and saves

- **Flow.** `src/flow/flow.ts` is the v0 journey as a pure state machine: title → lab (Prof. Epoch and the starter
  pick, on the map) → rival → walk → wild → distill → card tutorial (spin-up only) → forest → trainer → debrief → end.
  Losing the rival or wild battle restarts it. `FlowController` applies events, saves, and switches scenes.
- **The core loop (lose → teach → rematch).** Every Bootcamp Grad result opens the debrief (`scenes/debrief.ts`,
  `journey/debrief.ts`). After a loss on the spin-up path it shows what Tokenibble kept doing, from its CardTraces in
  plain words (`journey/kept-summary.ts`), and offers a card swap then a rematch, or a rematch as is. After a win it
  offers the end card, or an optional "try a different card?" replay. On the graft path it gives a per-starter hint
  that names the grafted Token Nibble (`GRAFT_HINTS` in `content/journey-text.ts`: use it once 4 or fewer cells are
  free; for Blitzr, whose hits all cost 1 anyway, turn the dial to T0), and a rematch. The hint is measured: following
  it takes the graft path from 91.5/30.0/88.0% to 99.0/51.5/93.0% (`measure-loop`). Each rematch plays the next trainer seed. The end card opens once the Grad has been
  beaten, so a lost replay can still finish.
- **Telemetry** (`flow/telemetry.ts`) stays local, in the save: trainer losses, card swaps, rematches, and per fight
  its rounds, moves and fired cards (the last 40 fights; the totals keep counting). The end card shows them with the
  virtual water receipt (`journey/receipt.ts`: integer functions of rounds and moves, obviously fake).
- **The end card persists.** BACK TO TITLE keeps the save at the end card, so Continue shows it again (receipt
  included) and NEW GAME starts a fresh run.
- **Saves.** These go in localStorage under `latentia.save.v0`, as `{ schemaVersion: 3, engineVersion, progress,
  hintsSeen }`, at every journey step (and when a first-time hint is shown). Versions: **v1** (P1) progress only;
  **v2** (P2) adds `hintsSeen`; **v3** (P4) adds `trainerBeaten`, `lastFight` and `telemetry` to the progress. `progress` holds the step, starter,
  distill choice, Tokenibble's card, whether the Grad is beaten, the last trainer fight (for the debrief) and the
  telemetry. Continue resumes at the start of the saved step; a trainer fight resumes on the seed it had reached.
  - Corrupt saves and saves from a newer schema are ignored, and the game starts fresh.
  - Older schemas upgrade through `MIGRATIONS` in `src/save/save.ts`, one version at a time: v1 → v2 adds
    `hintsSeen`; v2 → v3 adds the trainer result (a v2 save at the end card counts as beaten) and empty telemetry.
  - Every storage call is guarded (`src/save/browser-storage.ts`). If localStorage is blocked, missing, full or
    starts throwing (a sandboxed frame, Safari private mode), the game plays on with an in-memory store and shows a
    small "SAVES UNAVAILABLE" notice once; Continue then works only within the tab.
- **Bootcamp Grad's tuning** lives in `src/content/trainers.ts`, with the measured win rates and the counterfactuals.
  `scripts/measure-loop.ts` re-measures them: a naive player (its strongest affordable damaging move, T2) through the
  engine's `simulate`, over seeds 0-199 per starter. `test/unit/loop-balance.test.ts` runs the same with fewer seeds
  and looser bars.

## Dev and test hook

In dev and in the test build only, `window.__latentia` exposes:

- `flow()`, `scene()`, `menu()`, `layout()`, `battle()` (phase, round, moves, intents as shown, the why text,
  the log, per-round timings and the result) and `overworld()` (the player's tile and facing, the scene's mode, the
  dialogue on screen, the trainer's tile, fps) and `panel()` (the choice panel on screen: its title, text and rows)
  for reading state;
- `press(button)`, `pick(menuId, index)` and `send(flowEvent)` for injecting actions.

Production builds don't contain it: `main.ts` installs it behind the static `import.meta.env.DEV || MODE === 'test'`
check, which the production build folds away; `test/e2e/dist.spec.ts` greps the bundle to prove it.

## Credits

The Endesga 32 palette is by Endesga ([Lospec](https://lospec.com/palette-list/endesga-32)). The font, the
placeholder creatures, the overworld tiles and figures, and all other visuals are generated in code for this project. The three starter battle idles
come from the Fable style test on the `art/style-test` branch (see "Creature art").
