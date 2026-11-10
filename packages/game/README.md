# @latentia/game

The Latentia game client: Phaser 4, TypeScript (strict) and Vite. It uses only `@latentia/engine`'s public API.
This is **P1 (Shell)** of the playable-v0 plan (`docs/superpowers/plans/2026-11-10-playable-v0.md`). The scaling,
input, text, flow, save and test harness are real. Lab, Overworld, Battle and End are **stubs**: they show plain
menus (WIN/LOSE, the distill choice, placeholder card presets) so the whole journey can be walked before P2–P4
build the real scenes.

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
- In dialogue, A turns the page once it has finished typing. Holding A or B types 4× faster.
- Held buttons are released when the window loses focus or the page is hidden.

## Layout

The game renders at **320×180** with `pixelArt: true` and is scaled by an **integer number of device pixels** per
game pixel (`src/layout/compute.ts`, unit-tested). So a 390-CSS-px phone at DPR 3 gets 3× = 320 CSS px, and every
game pixel is an exact square of device pixels.

- **Landscape** (the viewport is wider than it is tall): the largest integer scale that fits, centred and
  letterboxed. For example, 1920×1080 gets 6× with no bars, and 1366×768 gets 4× (1280×720 at 43, 24). On touch
  devices the D-pad and A/B overlay the bottom corners at partial opacity.
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

## Flow and saves

- **Flow.** `src/flow/flow.ts` is the v0 journey as a pure state machine: title → lab → rival → walk → wild →
  distill → card tutorial (spin-up only) → trainer → end. Losing a battle restarts that battle. `FlowController`
  applies events, saves, and switches scenes.
- **Saves.** These go in localStorage under `latentia.save.v0`, as `{ schemaVersion: 1, engineVersion, progress }`,
  at every journey step. Continue resumes at the start of the saved step.
  - Corrupt saves and saves from a newer schema are ignored, and the game starts fresh.
  - Older schemas upgrade through `MIGRATIONS` in `src/save/save.ts`, one version at a time.
  - If storage is unavailable (for example in a sandboxed frame), the game plays on with an in-memory store.

## Dev and test hook

In dev and in the test build only, `window.__latentia` exposes:

- `flow()`, `scene()`, `menu()` and `layout()` for reading state;
- `press(button)`, `pick(menuId, index)` and `send(flowEvent)` for injecting actions.

Production builds don't contain it.

## Credits

The Endesga 32 palette is by Endesga ([Lospec](https://lospec.com/palette-list/endesga-32)). The font and all
P1 visuals are generated in code for this project.
