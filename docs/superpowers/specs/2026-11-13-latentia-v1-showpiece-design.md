# Latentia v1: the showpiece web demo

**Status:** draft for Travis's approval (2026-11-13). **Builds on:** v0.1 (branch `game/v0.1`, cf1ffe4..c55622c) and the design bible (`docs/design-bible.md`).

## Intent
v1 is a **showpiece**: a free web demo that shows the Latentia idea off on Travis's portfolio and socials. It is open-sourced "for fun and to get people involved". It is not the start of the paid game. That stays a later decision, which the demo's reception informs (the bible's plan: web demo → Steam premium).

Success looks like this:
- A first-time player on a phone or desktop plays **30–45 minutes** and reaches a satisfying ending: a gym badge and a shareable result.
- They don't get stuck and don't need instructions from outside the game.
- The first minute of battle *feels* good, not only reads clearly.
- A developer who finds the repo can run it, understand it and make a first contribution (for example, adding a species) in an afternoon.

## Goals
1. **Polish first** (the first minute sells it):
   - battle effects for each type, floating damage numbers, screen shake on big hits, creatures sliding in at the start of a fight;
   - sound effects and chiptune music;
   - a painted battle backdrop per area.
2. **Content past Bootcamp Grad, trimmed from the bible's slice:**
   - the north Deprecated Forest with Team Scrape's camp;
   - a small Patchwater;
   - a compact Compile Hall gym (lobby, one puzzle room, arena, leader Gary Rebase);
   - the Green Build Badge;
   - "Route 404: coming in a future update".
3. **Progression:**
   - XP and levels, using the bible's curve;
   - the first evolution gag (v1 → v2 at L6), with "pin version";
   - one off-type coverage move per starter.
4. **The gym as an eval puzzle,** in the approved battle direction: Gary's behaviour is fixed and shown up front, and you win by teaching the card that beats it. This brings in a **training screen** where you view and swap your subagent's cards between fights.
5. **Open source:**
   - code under MIT;
   - art, story, characters and names reserved;
   - a contributor-ready repo (CONTRIBUTING, issue templates, "add a species" guide, good-first-issues).
6. **Release:**
   - merge to `main`;
   - publish on Travis's portfolio at travisjohnjones.com/latentia/ with a project card and a case study, the same way Quantum Forge was published;
   - an end-of-demo **share card**.

## Non-goals (v1)
- The rest of the bible's slice, which is left for contributors or v1.x:
  - the Sunset Server, the Model Graveyard and Hallucinat;
  - the Old v1.2 story quest;
  - Alpha Cobolt;
  - gym rooms 1–2;
  - the hard-mode replays.
- Online features (the ghost Arena, leaderboards, Supabase), daily and weekly modes.
- The temperature dial. It stays hidden (Ruling V12). Its unlock belongs to a future gym.
- Steam or mobile store builds, monetisation, accounts and analytics. The only telemetry is local, in the save.

## Anti-goals (a failure even if it works)
- The game feels grindy, or the player has to grind XP to beat Gary.
- Any real lab, model, product or company name, or anything that echoes an existing franchise's creatures, slogans or capture mechanic. The copy-guard test stays and grows.
- The repo can't be built from a fresh clone, or contributing needs knowledge only Claude sessions have.
- A softlock, or lost progress on a phone. Saves keep the v0/v0.1 guarantees.
- Polish sacrificed to breadth. If time runs short, cut content, not effects and sound.

## Constraints
- Same stack and rules as v0.1:
  - Phaser 4 and TypeScript;
  - the deterministic engine used only through its public API (read-only helpers may be added, with goldens unchanged);
  - the Endesga 32 palette;
  - logical sizes from Ruling V16;
  - the in-image menus, the occluder invariant, `build:single` and the sandboxed iframe;
  - files under ~300 lines;
  - commits authored as CosmonautJones with no Co-Authored-By line.
- **Audio is generated in code** (Web Audio synth and sequencer), with no audio files and no network. It starts only after the first user gesture (browser autoplay rules), has a mute toggle that is saved, and respects the phone's silent switch as far as the browser allows.
- **Content is data:** maps, trainers, dialogue, species art mapping and the gym puzzle all live in content files, so contributors add content without touching systems.
- **Bundle:** `build:single` stays under 5 MiB and loads in under 3 s on a mid-range phone over 4G.

## Approaches considered
- **A. The bible's full slice** (45–75 min, 12 new species, 3 gym rooms; about 2–3 weeks). Rejected for v1: too long a wait for a showpiece, and the polish gets spread thin.
- **B. A polish-first showpiece** (30–45 min, 6 new species, 1 gym room; about 1–1.5 weeks). **Chosen by Travis on 2026-11-13** ("i trust you, let's do it"). Contributors can extend it toward A.
- **C. Polish what exists, then open-source it** (15 min; about 3–4 days). Rejected: it ends before the gym, the most original idea.
- **Licence:** a split licence was chosen over all-open (CC BY for art), so that nobody can re-sell Latentia itself while the code stays open.

## The v1 journey (after Bootcamp Grad, which is unchanged)
1. **North forest.** A short brush band with Nullbeetle and Heisenmoth (wander or skittish, visible encounters) and Embeddingo (`idle_sleep`, the Code-gym answer for Blitzr and Forkling). One optional trainer.
2. **Team Scrape camp.**
   - Grunt A is a mandatory story fight with Scrapion and Nullbeetle. Grunt B is optional.
   - A scraped Slopling is an `aggro` wild.
   - The grunt line: "We're not cutting trees, we're optimising biomass."
   - Redirect-arrow tiles at the gate foreshadow the gym.
3. **Patchwater (small):**
   - the Retraining Center: heal, plus the **training screen**;
   - the petitioner NPC (flavour);
   - the reservoir gauge (flavour, from the water satire);
   - the Compile Hall door.
4. **Compile Hall:**
   - **Lobby:** the receptionist, a guide NPC who answers "Marked as duplicate", and **Dukk**, the rubber-duck hint statue.
   - **One puzzle room, "Debug the Bot"** (bible Room 3). Fix Linty's program by changing one token, and "fix the first error first". Rooms are stateless on entry; B undoes and a long-press resets.
   - **The arena,** described below.
5. **Leader Gary Rebase.** His pre-battle "code review" shows his team's behaviour openly, as an eval puzzle:
   - The field effect **Compile Errors** penalises repeating the same command 3 turns running.
   - Unit Test punishes predictable decks. The lesson is "don't overfit".
   - His team is Spaghettopus v2 (orchestrator) with Vibrat and Agentoad.
   - Levels are tuned to where the player's XP lands (see Balance).
6. **Badge and ending:**
   - the Green Build Badge;
   - "BENCHMARK SATURATED. Benchmark 2: Harder Edition, Coming Soon";
   - the Route 404 sign;
   - the end card from v0, extended with the **share card** (below);
   - after the end card, free roam to replay fights.

## Systems
- **XP and levels:** the bible's curve. XP to the next level is 10 + 6L. Battle XP is 8 + 2 × enemy level, +10 for a first-time species. Show XP gain after each fight, a level-up fanfare, and stat deltas in plain words.
- **Evolution, v1 → v2 at L6:**
  - a short evolution scene with a satirical "changelog" ("v2: now 12% more confident");
  - the art is a palette swap plus a one-piece overlay, from Fable;
  - "Pin version" cancels it, and the choice is saved;
  - each version adds a card slot and upgrades one move, as the bible says.
- **Coverage moves:** one off-type damaging move per starter, chosen by simulation so each starter's worst matchup in the v1 fights improves without flattening the triangle. Target: the starter triangle stays between 55% and 70% for the favoured side, measured with the existing sim.
- **Training screen:**
  - view your subagent's card slots (plain words, as in v0.1);
  - swap among the cards you have unlocked;
  - see what each card does in plain words;
  - optionally run a 3-round "sparring" preview against a dummy.
  - It's reached from the Retraining Center and from the loss panel.
  - New cards unlock from story fights: one from the grunt, one from the gym room.
- **Juice:**
  - one effect per type (Reasoning, Speed, Open, Code, Search, Memory, Vision, Voice) plus guard and status effects;
  - damage numbers, crit stagger, screen shake (with a saved "reduce motion" toggle), a KO fade, slide-ins and a type-coloured hit flash;
  - everything is driven by the existing event playback, so it stays deterministic and skippable at 2× speed.
- **Audio:**
  - a synth SFX set: menu blip, text tick, hit, crit, guard, KO, level-up, evolution, door, step;
  - music: about 4 short chiptune loops (town, forest, battle, gym and leader) written as data for an in-code sequencer.
- **Backdrops:** 4 battle backdrops (trailhead forest, north forest/camp, gym arena, lab) at logical resolution, in layers, so they adapt to both orientations.
- **Share card:**
  - an in-image summary: starter, distill choice, cards used, losses → rematches, turns, the virtual-water receipt and the badge;
  - a **Copy text** button with a spoiler-free emoji grid and the link (the artifact host blocks downloads; clipboard writes work);
  - on the portfolio build, also a "Save image" option where the host allows it.

## Art (Fable, pass 3)
- **6 new battle species** at 96×96, with a 6-frame idle and a 2-frame hit: Nullbeetle, Scrapion, Slopling (scraped variant), Embeddingo, Spaghettopus and Agentoad. Heisenmoth is a stretch goal.
- **v2 overlays** for Sagelet, Blitzr and Forkling.
- **Blitzr fix:** replace the zigzag lightning bolts with swept speed streaks or fast-forward chevrons (Travis left this call to Claude: "i trust you").
- **Tiles** for the north forest, the camp, Patchwater and the gym interior, including the arrow tiles and the Linty terminal.
- **Characters** at 24×32 with 4-direction walks: Team Scrape grunts (two palette variants), Gary Rebase, the receptionist, the guide, the petitioner, and Dukk (a static statue).
- Fixes from the pass-2 notes: side-view heads, and neighbour-aware path/grass edges.
- **The 4 battle backdrops.**

## Balance targets (measured with `measure-loop` and the sim, recorded in content files)
- The route is beatable without grinding. A player who fights every mandatory fight plus about half the optional ones arrives at Gary at roughly the level his team is tuned for. Set his levels from the measured XP, not from the bible's L10.
- **Gary, as an eval puzzle,** measured over 200 seeds per starter:
  - with the "naive" default card, the naive player wins ≤ 40%;
  - with an appropriate card from those available by then, the naive player wins ≥ 70% for every starter;
  - the telegraph-reading player does better than the naive one.
- Grunt A is beatable by a naive player ≥ 75% at the expected level.
- No fight in v1 is unwinnable for any starter: the sim's best available deck wins ≥ 60%.

## Open source
- `LICENSE`: MIT, covering the code.
- `ASSETS-LICENSE.md`: art, music data, story, dialogue, character and creature names, and the Latentia name are © Travis Jones, all rights reserved. Contributions of such content are accepted under a contributor assignment line in CONTRIBUTING.
- A root `README.md` covering: the pitch, a play link, a screenshot or GIF, how to run it, the repo map (engine / sim / game / art), and how to contribute.
- `CONTRIBUTING.md`: setup, tests, commit style, the copy and originality rules, the art pipeline, and **"Add a species in 6 steps"**.
- `.github/ISSUE_TEMPLATE`: bug, species idea and content idea templates.
- 8–12 **good-first-issues** filed after release, drawn from the non-goals (the Graveyard, Hallucinat, Old v1.2, gym rooms 1–2, the Heisenmoth art, translations).
- Internal process files (`.superpowers/`, the implementer reports) stay git-ignored. The design bible and plans stay public.

## Release
1. Before v1 work begins, merge `game/v0.1` into `main` (verified: lint, typecheck, tests and e2e on the merged result).
2. Develop v1 on `game/v1`, cut from `game/v0.1`.
3. When v1 is done:
   - an independent review, a fix pass and a scoped re-review;
   - Travis playtests;
   - merge to `main` and tag `v1.0.0`.
4. Publish on the portfolio:
   - copy `dist-single/index.html` to the Portfolio repo's `public/latentia/`;
   - add the project card and case study (`src/lib/constants.ts`, `work/[project]`), with the GitHub link and screenshots;
   - follow the Portfolio repo's CLAUDE.md (its commit identity and its push-to-main rule);
   - Netlify deploys it.
5. Republish the private artifact link as well.

## Calls made after the builder check (Claude's, for Travis to check)
1. **Compile Errors is an engine rule.**
   - It is added to `@latentia/engine` as a new field effect, active only when a battle setup configures it. Engine 0.5.0.
   - Existing goldens stay byte-identical; new goldens cover the effect.
   - The sim can then measure Gary.
   - This is the one planned exception to "read-only helpers only". It is a new rule, not a change to an existing one.
2. **Progression lives in the game layer.**
   - XP, levels, stat growth, version (v1/v2), "pin version", card-slot counts and the move upgrade are game data.
   - The game hands the engine fully-specified setups (species, level, moves, deck), as it does today.
   - The save schema goes to v5, with migration.
3. **The gym as an eval puzzle.**
   - You still command your starter each turn, and your subagent acts from its card. Gary's deck is shown in his pre-battle "code review".
   - Compile Errors punishes repeating a command 3 turns running.
   - The **Default card** (always the same move) is the "naive card": it walks straight into Compile Errors and Unit Test.
   - The **appropriate card** is an anti-repeat card, "IF I used this move last turn THEN use a different one". The gym's puzzle room awards it (Linty's fixed program becomes the card), so the room teaches the lesson the leader tests.
   - The sim's naive player is the existing one (the starter's strongest affordable move). Targets: the Default card wins ≤ 40%; the anti-repeat card wins ≥ 70% for every starter.
   - **Graft path** (no subagent): the lever is the player's own commands. Target: a "varies its commands" sim player wins ≥ 60%, with a pre-fight hint pointing at it.
4. **Art runs in parallel.**
   - Fable pass 3 runs alongside the code tasks on `art/pass-3`.
   - Content tasks build and test against placeholders: generated species placeholders (existing), plus palette-shifted versions of existing tiles and characters.
   - An integration task swaps in the final art. Nothing blocks on art.
5. **Audio has a minimum bar.**
   - Must have: the full SFX set, the battle loop and the mute toggle.
   - Should have: the town, forest and gym loops.
   - If time runs short, the extra loops are cut before any effects work.
   - "Feels good" is judged by Travis at playtest; until then, every sound gets an e2e check that it plays without errors.
6. **The puzzle's first-error rule is hard, and funny.**
   - A wrong edit runs Linty visibly. He crashes ("Stack overflow — respawning at line 1"), and the room resets after a beat.
   - Dukk gives one hint sentence, never the solution.
   - The state is: the program, the selected line, the edit used (yes/no), and running/idle.
7. **The portfolio publish is the last build task.** Claude does it, following the Quantum Forge precedent and the Portfolio repo's CLAUDE.md: its commit identity, its push-to-main rule, and checking the Netlify deploy.

## Left to the builder
- Effect and audio implementation details, the sequencer format, the exact music.
- The map layouts for the north forest, the camp, Patchwater and the gym, within the bible's descriptions.
- The exact coverage moves (from the engine's existing moves where possible), and the exact unlockable cards.
- The training-screen layout (in-image, both orientations, inside the occluder invariant).
- Splitting the work into tasks.
