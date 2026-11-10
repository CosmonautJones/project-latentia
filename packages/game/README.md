# @latentia/game

The Latentia game client: Phaser 4, TypeScript (strict) and Vite. It uses only `@latentia/engine`'s public API.
It covers **P1 (Shell)** and **P2 (Battle scene v0)** of the playable-v0 plan
(`docs/superpowers/plans/2026-11-10-playable-v0.md`). The scaling, input, text, flow, saves, test harness and the
**battles** are real. Lab, Overworld, End and the distill choice are still **stubs** (plain menus) so the whole
journey can be walked before P3–P4 build them.

## Run it

From the repo root:

```sh
pnpm install
pnpm --filter @latentia/game dev          # Vite dev server with hot reload (the dev hook is on)
pnpm --filter @latentia/game build        # production build into packages/game/dist
pnpm --filter @latentia/game preview      # serve the production build
pnpm --filter @latentia/game test         # Vitest unit tests (pure modules only)
pnpm --filter @latentia/game typecheck
pnpm --filter @latentia/game e2e          # test build + Playwright smoke tests (Chromium)
pnpm --filter @latentia/game screenshots  # re-shoot test/screenshots/*.png
```

The root `pnpm lint`, `pnpm typecheck` and `pnpm test` include this package.

**Playwright.** Locally, the tests run on Google Chrome through the `chrome` channel, because the Playwright browser
download is blocked here (the engine's browser tests do the same). In CI (`CI` set) they use Playwright's own
Chromium, which needs `pnpm --filter @latentia/game exec playwright install chromium` first. `e2e` builds with
`vite build --mode test` into `dist-test/` and serves it with `vite preview`. The tests fail on any console error
or uncaught exception.

## Controls

All input goes through one action stream (`src/input/hub.ts`) of six buttons: up, down, left, right, A and B.

| Button | Keyboard | Touch |
|---|---|---|
| Directions | Arrow keys or WASD | The D-pad |
| A (confirm, advance text) | Z or Enter | A |
| B (back, cancel) | X or Esc | B |

- Keys are matched by physical position (`KeyboardEvent.code`), so WASD/ZX sit in the same place on any layout.
  Chords with Ctrl, Cmd or Alt are left to the browser.
- Tapping or clicking a menu item moves the cursor there and confirms it.
- In dialogue, A while a page is typing finishes it at once; A on a finished page turns it. Holding A or B types
  4× faster. The battle's "why?" popup also closes on B.
- Held buttons are released when the window loses focus or the page is hidden.

## Layout

The game renders at **320×180** with `pixelArt: true` and is scaled by an **integer number of device pixels** per
game pixel (`src/layout/compute.ts`, unit-tested). So a 390-CSS-px phone at DPR 3 gets 3× = 320 CSS px, and every
game pixel is an exact square of device pixels.

- **Landscape** (the viewport is wider than it is tall): the largest integer scale that fits, centred and
  letterboxed. For example, 1920×1080 gets 6× with no bars, and 1366×768 gets 4× (1280×720 at 43, 24). On touch
  devices the scale steps down until 150 CSS px are free on each side, and the D-pad and A/B sit there (844×390 at
  DPR 3 gets 5×); only when no scale leaves that room do they overlay the corners at partial opacity.
- **Portrait**: the screen sits at the top, scaled to the width while leaving at least 200 CSS px below it. Below
  it is a DS-style **bottom band** holding the touch controls, plus an empty `#band-panel` reserved for battle menus
  and the grid editor.
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
- **Layout**: in landscape the menus are on the canvas; in portrait they are DOM buttons (44 CSS px rows, scrolling
  on short phones) in the bottom band (`src/battle-ui/band-menu.ts`), drawn in the game font. Touch landscape steps
  the game scale down so the D-pad and A/B sit beside the game, not over it.
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

## Flow and saves

- **Flow.** `src/flow/flow.ts` is the v0 journey as a pure state machine: title → lab → rival → walk → wild →
  distill → card tutorial (spin-up only) → trainer → end. Losing a battle restarts that battle. `FlowController`
  applies events, saves, and switches scenes.
- **Saves.** These go in localStorage under `latentia.save.v0`, as `{ schemaVersion: 2, engineVersion, progress,
  hintsSeen }`, at every journey step (and when a first-time hint is shown). Continue resumes at the start of the
  saved step. v1 saves upgrade to v2 with no hints seen.
  - Corrupt saves and saves from a newer schema are ignored, and the game starts fresh.
  - Older schemas upgrade through `MIGRATIONS` in `src/save/save.ts`, one version at a time (v1 → v2 adds
    `hintsSeen`).
  - If storage is unavailable (for example in a sandboxed frame), the game plays on with an in-memory store.

## Dev and test hook

In dev and in the test build only, `window.__latentia` exposes:

- `flow()`, `scene()`, `menu()`, `layout()` and `battle()` (phase, round, moves, intents as shown, the why text,
  the log, per-round timings and the result) for reading state;
- `press(button)`, `pick(menuId, index)` and `send(flowEvent)` for injecting actions.

Production builds don't contain it.

## Credits

The Endesga 32 palette is by Endesga ([Lospec](https://lospec.com/palette-list/endesga-32)). The font, the
placeholder creatures and all other visuals are generated in code for this project. The three starter battle idles
come from the Fable style test on the `art/style-test` branch (see "Creature art").
