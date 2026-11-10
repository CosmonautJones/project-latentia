# Command One Model, Train the Rest

The design is built around one moment: you command a parody "frontier model" each turn, while two subagents act on their own from example cards you taught them. Everything else is built to make that moment fast to read, funny and fair. One **Context Grid** is the creature's loadout before battle, the place where training happens, and the clock during battle. Packing more power in beforehand means running out of room sooner in the fight. A deterministic, integer-only TypeScript battle engine makes four things cheap: async ghost PvP, balancing by simulation, cheat-proof replays, and the later hybrid mode, where an LLM *compiles* plain-English strategy into the same card format and never plays the battle itself. The evidence backs three structural bets. Players sample demos for a median of about **14 minutes**, and **10–20%** of them wishlist. Gambit-style if-then lists are a proven, mobile-shippable way to "program" allies. Bounded async ghost runs (Super Auto Pets, Backpack Battles) hold players without synchronous servers. The first playable slice runs 45–75 minutes, followed by an endless ghost ladder. It covers Professor Epoch's lab in **Localhost**, the **Deprecated Forest** route with Team Scrape's camp, and the **Compile Hall** Code Benchmark gym, and it ships **17 of 41 species**. The largest legal risks are the capture mechanic and naming. Nintendo is litigating monster-capture patents against Palworld, so creatures are *distilled*, never caught with a thrown ball. No real lab, model or product names appear, and "Pro Max" is retired from the evolution gag. How to read this bible: sentences with an inline link are sourced findings; **everything without a citation is an original design proposal**, and every number in a design table is a starting value to tune in the headless simulator.

## A muted three-second clip has to sell "you command one, they act from training"

### Evidence: demos get minutes, and the best ones hold players for an hour

Demo players decide fast. In a Zukowski survey of about 130 games, the **median demo playtime was 14 minutes**. Developers design about 30 minutes, and demos from top-grossing games held players for a median of 38–65 minutes. Replayable demos held 18.5 minutes against 14 for linear ones ([Steam Page Analyzer](https://www.steampageanalyzer.com/blog/how-long-should-a-steam-demo-be)). Most demos see **10–20% of players wishlist**, and festival players give many demos a 1–5 minute try, so tutorials should be minimal ([HTMAG](https://howtomarketagame.com/2024/06/24/do-demos-help-earn-wishlists-steam-next-fest-june-2024/)). The most actionable finding is about timing: demos launched months before a Next Fest earned about **2.5× the median wishlists** of fest-week shadow drops ([Steam Page Analyzer](https://www.steampageanalyzer.com/blog/how-long-should-a-steam-demo-be)). Mark Brown adds three points. Demos should err easy, build a memorable early synergy, and aim for a 30–90 minute median ([GMTK](https://gmtk.substack.com/p/how-to-make-a-great-steam-next-fest)). Zukowski's line, "to play it is to understand it," is the case for shipping the web demo first ([GamesRadar](https://www.gamesradar.com/games/valve-knows-it-i-know-it-and-you-need-to-know-it-steam-expert-tells-indie-devs-to-give-away-demos-because-actually-playing-a-game-beats-all-other-marketing)). Backpack Battles followed this path. A small free itch.io browser demo in June 2023 came before **640,000 units in its first month** on Steam ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)).

### Design: the pitch and the first ten minutes

The pitch: *"Pick an outdated frontier model. Teach its subagents by example. Pack its context window. Beat the benchmarks, and the internet."* Every trailer, GIF and Steam capsule should open on a battle, not the professor. The clip should show three things in order: the orchestrator takes a command, two subagent sprites visibly act on their own, and a readable payoff lands. The payoff can be a "CONTEXT OVERFLOW" burst, a Team Scrape model hallucinating into its own ally, or a distillation flash.

The beat sheet below merges the retention research's minute targets with the level research's spaces. The game opens *in the lab*, not the bedroom. The player's home and Mom become an optional heal stop, so the first battle can land within two minutes.

| Time | Beat | Space | What it teaches |
|---|---|---|---|
| 0:00–0:45 | Skippable cold open: Prof. Ilse Epoch says *"Here. A frontier model. Well, it WAS frontier. About six weeks ago."* You pick Sagelet, Blitzr or Forkling | Lab interior (16×12) | Starter choice and the tone |
| ~1:30 | Rival Kip Velocity picks the counter-type and battles you, starter vs starter, one on one. Your starter commands every move | Lab | Commanding, the type chart, one command at a time |
| ~3:00–4:00 | **Tokenibble** is the first wild model, at the Deprecated Forest trailhead. Win, then **distill** it: it is your first distill, and the natural first **spin-up**, into your first subagent | Trailhead brush | Visible encounters, distillation, subagents (split control, the intent icon) |
| ~4:00–5:00 | The example-card tutorial: teach Tokenibble its first card. The 4×4 grid is tight, so drop something, or choose graft over spin-up for the next distill | Grid editor | Example cards, the packing "aha" |
| ~8:00–10:00 | Optional pre-seeded ghost at the trailhead kiosk ("fight a cached run from a beta tester") | Trailhead | Async PvP exists |
| 12–25 min | Trainers, Team Scrape camp, the Sunset Server checkpoint, side paths | Deprecated Forest | Type matchups, deck tuning |
| 25–50 min | Patchwater plaza, then the Compile Hall's three puzzle rooms and leader Gary Rebase | Gym | Puzzle verbs, "don't be predictable" |
| After the badge | Ghost ladder unlocks, plus a trainer card, a share GIF, a Wishlist button and locked "Route 404" signs | Patchwater | Replay loop and conversion |

### Design: loops that pay out when a re-packed team wins a rematch

The minute-to-minute loop is explore, encounter, battle, distill, train, pack, and repeat. It pays out when a re-packed team beats a gym or ghost it previously lost to. The session loop is one story step or one bounded ghost run with a result card. The weekly loop is a **Weekly Benchmark**: a rotating rule modifier such as "context halved," "open-weights only" or "temperature locked hot," with its own pool and leaderboard. This copies Super Auto Pets' Weekly Pack, which rotates every week and matches only within its own mode ([SAP Wiki](https://superautopets.wiki.gg/wiki/The_Basics)). The daily loop is a **Daily Seeded Prompt**: everyone gets the same rental team and ghost gauntlet, one attempt counts, practice is unlimited, and the result is a spoiler-free share grid. Wordle's daily limit came from wanting "three minutes of your time a day, and that's it." Its emoji grid was productized from a player's own habit, and its author deliberately left a URL out of it ([Game Developer](https://gamedeveloper.com/gdc2022/josh-wardle-reflects-on-the-the-unconventional-road-to-wordle-s-success)). Seasons run 6–8 weeks and add a "model release" event creature and cosmetic rewards. The post-game adds a **Benchmark Tower** (a streak gauntlet), a **Rental Factory** (rental agents, so no grind advantage), rare "Golden-weights" palette variants, a ModelDex that requires a training milestone rather than a bare catch, and a formal **Hallucination Run** toggle in which fainted models are sunset permanently. Coromon shipped a built-in Nuzlocke mode, and its roguelite spin-off uses procedural runs plus a community storyline, which shows that formalizing fan challenge rules works ([Nintendo Life](https://www.nintendolife.com/news/2022/03/video-pokemon-style-monster-battler-coromon-showcases-nuzlocke-mode-out-on-switch-march-31st); [Niche Gamer](https://nichegamer.com/coromon-rogue-planet-announced)).

The game deliberately excludes punishing login streaks, energy gates, expiring currency, power-granting passes, creatures that are gone forever, and default push notifications. A premium price removes any reason to use them.

### Design: where procedural generation earns its keep

The engine is deterministic and the simulator can already search for decks, so seeded generation is cheap wherever it serves the theme. It is used in these places:

- The **Daily Seeded Prompt** and the **Weekly Benchmark** (above).
- **Generated Eval Suites.** Beyond each region's fixed 12 scenarios, the game generates fresh held-out scenarios from a seed. This is literally how model evaluation works, and it stops players memorising the test.
- **Generated opponents.** The deck search builds trainer and ghost decks, which fill the Arena's seed pool so it never looks empty at low population.
- A post-game **seeded roguelite tower** with generated floors.

It is **not** used for story maps, puzzle rooms, jokes or creature stats. Those are hand-made, because the writing and the creatures' personalities are the product, and creatures have no hidden stats (see Progression).

### Design: ghost matchmaking that avoids The Bazaar's complaint

The proven async shape is a bounded run against snapshots of other players. Super Auto Pets Arena runs until 10 wins with 5 lives and draws opponents "from a database of teams that other players created, matched on the same turn" ([SAP Wiki](https://superautopets.wiki.gg/wiki/The_Basics)). Backpack Battles runs until 10 wins or 5 losses, serves harder opponents at higher rank, and keeps modified runs out of the ranked pool ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)). The failure to avoid comes from The Bazaar's players, who met Legend-rank ghosts while in Bronze, said the ladder "isn't really 'ranked'", and asked for Elo-style matching with visible season end dates ([r/PlayTheBazaar](https://redlib.belloworld.it/r/PlayTheBazaar/comments/1gp09du/are_there_plans_to_implement_a_true_skill_based/lwmsguj)). Hearthstone Battlegrounds designers expected early elimination "like battle royale," so a loss feels like a re-queue, not a setback ([Game Developer](https://gamedeveloper.com/design/why-the-i-hearthstone-i-devs-wanted-to-make-an-auto-battler)).

The design is called **the Arena**. A run lasts until 10 wins or 3–5 losses. Ghosts are snapshotted at checkpoints (after each badge, and each round of a run) and keyed by ruleset and season, checkpoint index and rating bucket. They are served from the nearest bucket, widening the search as needed, then falling back to dev-authored seed ghosts so the pool never looks empty at low population. Matching uses a hidden Glicko-2 or Elo rating, separate from a mostly cosmetic visible tier. Rewards are identity items only. On next launch, a "your ghost won 7 fights while you were away" summary gives a reason to return without push notifications. LLM-compiled decks get **their own pool at launch**. That pool merges into the main one only if telemetry shows it wins at parity.

| Demo KPI | Target | Basis |
|---|---|---|
| Time to first battle / first distill / first grid decision / first ghost | under 2 / 4 / 6 / 12 min | Beat sheet above |
| Median playtime | 38+ min ("Gold" tier); 14 min is the median baseline to beat | [Steam Page Analyzer](https://www.steampageanalyzer.com/blog/how-long-should-a-steam-demo-be) |
| Wishlist clicks per demo player | 15–20%+ | [HTMAG](https://howtomarketagame.com/2024/06/24/do-demos-help-earn-wishlists-steam-next-fest-june-2024/) |
| D1 return (stretch) | 15–16%, the PC top-quartile D1; on mobile, top-quartile is ~30% D1 and 6–7% D7 | [GameAnalytics via GameDev Reports](https://gamedevreports.substack.com/p/gameanalytics-mobile-and-pc-game) |
| Ghost health | % who upload a team, median pool per bucket, "came back to see results" rate | Proposal |

Shareables follow from this. The game should produce a plain-text daily grid, an auto-clipped 6–10 second battle GIF with a 9:16 option, a trainer card, and a "beat my team" challenge link, which is the one place a URL belongs. Creator watchability matters more than share buttons: Vampire Survivors went from 14 to 1,143 concurrent players on the day one 30-minute YouTube video went up ([Vice](https://www.vice.com/en/article/how-vampire-survivors-went-from-obscurity-to-27000-people-playing-at-once)). There is no share-to-unlock.

## One Context Grid is the loadout, the training rig and the battle clock

The battle research proposed a 12-cell context meter per creature. The progression research proposed a packing grid that grows from 4×3 to 6×6 as the loadout. They merge into one rule.

> **The grid rule.** The orchestrator's Context Grid is a single budget. Before battle, the pieces you place are your *loadout*. The empty cells are your *headroom*. In battle, the orchestrator's moves, buffs and observations fill the headroom, and when it runs out you overflow into Drift. Subagents bring **their own** context windows, which is the point of a subagent. Holding one still costs a 2×2 slot in your grid, and every example card that trains it costs a cell. A tightly packed loadout is stronger and overflows sooner.

The rule matches how real agents work: few-shot examples and tools eat context, and delegating work to subagents preserves the orchestrator's window. Packing power and keeping headroom pull against each other, which gives every loadout decision a battle consequence.

### Evidence: placement must change power, and touch caps the width

Packing works when *where* a piece sits changes its power. Backpack Battles items buff their neighbours and combine when adjacent; for example, a sword plus two whetstones goes from 2–4 to 10–12 damage ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)). Backpack Hero's lead says the inventory grew out of strategic card *placement* in deckbuilders ([Shacknews](https://www.shacknews.com/article/132048/backpack-hero-lead-on-game-influences-challenges)). Touch sets the ceiling: Android asks for 48 dp targets and iOS for 44 pt ([NZ Government a11y guidance](https://govtnz.github.io/web-a11y-guidance/ka/accessible-ux-best-practices/mobile-apps/mobile-app-a11y-by-feature-type/touch-and-pointer-target-sizing.html)). On a 360 dp portrait phone with margins, 6 columns gives about 54 dp per cell and 7 columns is borderline, so **portrait caps at 6 columns**.

### Design: grid growth, pieces and in-battle fill

The grid starts at 4×4 instead of 4×3, so the L1 loadout keeps a working headroom. The first expansion lands at L4, just *after* the first forced packing choice. On each expansion level the player picks which edge grows. On other levels they pick a perk: +1 Pinned cell, +1 Cache, or +5% adjacency.

| Orchestrator level | Grid | Cells | Label | Typical loadout and headroom |
|---|---|---|---|---|
| 1 | 4×4 | 16 | "4K context" | System Prompt 3 + Skill 2 + Tool 1 + subagent slot 4 + 1 Example Card = 11, headroom 5 |
| 4 | 5×4 | 20 | "8K" | Room for a graft or a second skill |
| 7 | 5×5 | 25 | "16K" | Two active subagents become viable |
| 10 | 6×5 | 30 | "32K" | Reached around the Code gym victory |
| 13 | 6×6 | 36 | "128K" | Portrait-safe maximum (post-gym ladder) |
| Post-demo | 7×6, then 8×6 | 42, 48 | "200K", "1M Preview" | Landscape/desktop, or scroll in portrait |

A **headroom floor of 4 cells** makes the loadout screen refuse layouts that leave less ("you need room to think"). At L1, adding a second Skill drops headroom to 3, and the first distill brings a 4-cell slot or a 3–4-cell graft, so the player must trade. This is the designed aha.

| Piece | Shape | Rule | In slice? |
|---|---|---|---|
| System Prompt | I3, unique, pinned | Sets the starter's base stats and grants its signature move | Yes |
| Skill | 1×2 | One commandable move (max 4 Skill pieces) | Yes |
| Tool | 1×1 | +1 effect step to adjacent Skills | Yes |
| Example Card | 1×1 | Activates one deck card for *each* subagent slot it touches; a shared piece counts for both | Yes |
| Subagent Slot | 2×2 | Holds an active subagent | Yes |
| Grafted Move | Irregular 3–4 cells, set by species | A distilled signature move; the awkward shape is its cost | Yes |
| Cache | 1×1 | Orthogonal neighbours are immune to forced compaction | Yes |
| Junk Token | 1×1, enemy-inserted | Occupies a cell and does nothing | Yes |
| Compaction Summary | 1×1, auto | A compacted piece at 50% effect until battle end | Yes |
| Heavy Skill | L-tromino | Strong move; charges when adjacent to a Tool | Later |
| Notes | 1×1 | +x% against one type; stacks when adjacent | Later |
| Adapter | 1×2 | Must touch a slot; tweaks one subagent's stat or move | Later |
| Workflow | S/Z tetromino | Using one end Skill queues the other at −30% | Later |
| Safety Filter | T tetromino | Blocks the first Prompt Injected each battle | Later |
| RAG Index | L tetromino | Doubles adjacent Notes | Later |
| Sampler | 1×1 | Adjacent Skills get +crit and −accuracy | Later |

The in-battle fill rules below are deterministic. Every token shows a faint age number, so compaction never surprises.

| Event | Effect on the orchestrator's headroom |
|---|---|
| Orchestrator move costing *n* cells | Adds *n* context tokens, oldest numbered first |
| Buff gained | Stored as a tagged token. If it gets summarized, it loses 1 stage ("the details got blurry") |
| First sighting of a new enemy move | Adds 1 **Observation** token (+10% resistance to that move this battle), but only if a cell is free |
| Enemy flood (Filibuster, Memory Leak) | Adds Junk tokens. With no free cell, the **oldest non-pinned, non-cached loadout piece** compacts to a 50% Summary |
| Paying more than your free cells | Allowed. Each missing cell adds 1 **Drift** stack (max 5) |
| Super-effective hit ("Efficient Answer") | Frees 1 token |
| **Compact** (0 cost, priority −2) | Turns the oldest 6 tokens into 3 summaries and clears 1 Drift |
| **/clear** (priority −3) | Wipes all tokens, stat stages and Drift. The orchestrator skips next round; subagents keep acting |
| Battle end | The grid restores fully |

The asymmetry is intentional and easy to learn: **overflow you choose costs Drift, and overflow the enemy forces costs loadout.** Subagents use the same token, Drift, Compact and /clear rules on their own window (Ctx stat: 12 standard, 10–16 by species). Their decks can hold a "context ≥ 75% → Compact" card, and a benched subagent frees 2 cells per round. If simulation shows L1 headroom is too punishing, the fallback lever is a fixed off-grid "scratchpad" of 2–4 cells. That change would not touch the packing puzzle.

## Battles run on eight types, one meter, a temperature dial and split control

### Evidence: one legible resource per decision is what reviewers praise

Each well-received innovation in the genre adds **one legible resource per decision**. Temtem's stamina lets you overspend into HP, which Game Informer called "a clever solution to spamming powerful attacks" ([Game Informer](https://www.gameinformer.com/review/temtem/competitive-evolution)). The exact rule is that overexertion costs HP per missing point and forces a Rest-only next turn ([Temtem wiki](https://temtem.wiki.gg/wiki/Stamina)). Cassette Beasts refunds +1 AP for a type-advantage hit ([Cassette Beasts wiki](https://wiki.cassettebeasts.com/wiki/AP)). Monster Sanctuary's combo counter rewards allies who stack hits ([Turn Based Lovers](https://turnbasedlovers.com/review/monster-sanctuary-2/)). Criticism clusters on unreadable webs and long fights. Cassette Beasts' type chemistry is "dizzying and hard to keep track of," its late fights drag, and it has no speed-up ([RPGamer](https://rpgamer.com/review/cassette-beasts-review/)). Digimon bosses come down to "who hits harder and heals faster" ([Kotaku](https://kotaku.com/digimon-story-time-stranger-the-kotaku-review-2000630341)). Pokémon Showdown proves the replay model: a seed plus an input log reproduces a battle exactly ([Showdown RNG](https://pokemonshowdown.com/pages/rng)).

The battle design follows from those lessons. Context is the only move-cost resource, with no mana. Overflow is soft and punishing, Temtem-style. Super-effective hits refund a cell. A **Handoff Chain** gives each consecutive allied hit on the same target within a round after the first +15% more (+15% on the 2nd hit, +30% cap on the 3rd), and an enemy action in between breaks the chain. Type effects are damage-only, with no immunities in v1. Normal fights aim for 5–8 rounds, with 2× and 4× speed toggles, since ghost battles are watched rather than played.

### The type chart is regular, so it can be learned in an hour

Every type has exactly two 1.5× targets and two ⅔ resistances, so no type is strictly safe. (Ruling 148 softened the chart from 2× and ½ to 1.5× and ⅔, stored as 15000 and 6667 basis points.) The decided starter triangle, **Speed > Reasoning > Open > Speed**, is embedded in the chart. Each starter's second strength gives it early coverage: Speed hits Search, Reasoning hits Code, and Open hits Voice.

| ATK \ DEF | Rea | Spd | Opn | Cod | Vis | Voi | Sea | Mem |
|---|---|---|---|---|---|---|---|---|
| **Reasoning** | 1 | ⅔ | **1.5** | **1.5** | 1 | 1 | 1 | ⅔ |
| **Speed** | **1.5** | 1 | ⅔ | 1 | ⅔ | 1 | **1.5** | 1 |
| **Open** | ⅔ | **1.5** | 1 | 1 | ⅔ | **1.5** | 1 | 1 |
| **Code** | ⅔ | 1 | 1 | 1 | **1.5** | 1 | ⅔ | **1.5** |
| **Vision** | 1 | **1.5** | **1.5** | ⅔ | 1 | ⅔ | 1 | 1 |
| **Voice** | 1 | 1 | ⅔ | 1 | **1.5** | 1 | **1.5** | ⅔ |
| **Search** | 1 | ⅔ | 1 | **1.5** | 1 | ⅔ | 1 | **1.5** |
| **Memory** | **1.5** | 1 | 1 | ⅔ | 1 | **1.5** | ⅔ | 1 |

Each edge has an in-world reason. Reasoning finds the edge case in your code. Speed answers before the chain of thought finishes. Open forks your fast tier for free. Memory beats Reasoning through benchmark contamination ("it memorized the answers"). Search beats Code because the answer was on a forum all along. Dual types multiply (floored in basis points), so the range is 0.4444–2.25: two resistances give 6667 × 6667 → 4444, and two weaknesses give 15000 × 15000 → 22500 (Ruling 148). A same-type move gets ×1.25, deliberately lower than the mainline games so off-type coverage stays viable. The UI shows labels, never raw multipliers. The final boss Monocultra is the one exception: it takes 1× from everything, then resists whichever type you repeat.

### Core numbers: integer math, five stats, and temperature that reshapes variance

There are five stats: HP, Compute (Atk), Robustness (Def), Latency (Spd, higher is faster) and Ctx (window size; for the orchestrator, grid headroom). Physical and special are merged into one damage axis. Stat stages run from −3 to +3 (×1.25, ×1.5, ×1.75 and their reciprocals) and are stored as basis points. Damage is `floor(floor(Power × Atk/Def × LevelFactor / 50) × Type × Native × Crit × Roll / 10000) + 1`. Every multiplier is an integer in basis points, applied in a fixed order with a floor after each step, so browser, mobile WebView and Steam builds produce byte-identical results. Accuracy is `rngInt(100) < clamp(MoveAcc + TempMod − 8×Drift + 10×(AccStages − EvaStages), 30, 100)`. Crit stages map to none, 1/48, 1/24, 1/12, 1/6, 1/2 and guaranteed. A crit deals ×1.5 and ignores positive Def stages, a model borrowed from Pokémon's tiers ([Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Critical_hit)).

The player sets the orchestrator's **temperature** each round as a free action, and it locks when the orchestrator acts. Subagents have a *trained* temperature, set on the deck screen. Expected damage stays nearly flat across the dial, so the choice is about variance: go hot when you need a KO you can't otherwise reach, and go cold to close out a lead. Hot also unlocks qualitative "Wild" riders that cold never gets, so it is not merely a gamble. Move buttons show the damage range ("38–57" at T4 against "47" at T0).

| Notch (UI value) | Label | Damage roll | Accuracy | Crit | Self-hallucination | Special |
|---|---|---|---|---|---|---|
| T0 (0.0) | Greedy | 100% fixed | +10 | 0 | 0% | Wild riders never trigger; Reasoning +1 crit stage |
| T1 (0.5) | Cool | 95–105% | +5 | 1/48 | 0% | Reasoning +1 crit stage |
| T2 (1.0) | Default | 85–110% | 0 | 1/24 | 0% | — |
| T3 (1.5) | Warm | 75–125% | −5 | 1/12 | 5% | Wild riders trigger |
| T4 (2.0) | Unhinged | 60–150% | −10 | 1/6 | 12% | Wild riders at double strength; super-effective ×1.25 more |

### Statuses and guards satirize real failure modes

A creature can hold one major status (\*) at a time; the rest are volatile and stack. The gag names from the world research fold into these mechanics: "Glazed" is the UI name for sycophancy, and "Context Rot" is a source of Junk tokens rather than a ninth status.

| Status | Archetype | Effect | Duration / cure |
|---|---|---|---|
| **Hallucinating** | Confusion | 25% chance per action (×2 at T3+, ×0.5 at T0) to retarget to a random combatant, allies included, *and* fire a random move from its own set | 2–4 rounds (seeded). Cured by Ground Truth, Citation Needed, or any Search hit |
| **Prompt Injected** | Hijack | The victim's next action is replaced by the inflicter's choice from the victim's moveset, usually aimed at its ally | 1 action. Guardrail blocks it; Air-Gapped species are immune |
| **Rate Limited**\* | Paralysis | Speed ×0.5; 25% chance to lose the turn ("429: Too Many Requests") | 3 rounds |
| **Overfit** | Encore / lock | Must repeat its last move: +15% against the same target, −30% against others | 2 rounds; switching out cures it |
| **Glazed** (sycophantic) | Inverted taunt | Can't use debuffs or status moves; −30% damage against whoever glazed it ("You're absolutely right!") | 3 rounds |
| **Deprecated**\* | Perish count | Visible 3-round countdown. At 0 it is force-benched at 1 HP, or KO'd if no bench | Swapping out clears it |
| **Quantized**\* | Trade-down | All stats −1 stage, all move costs −1 cell. Some builds want this on themselves | 4 rounds, or Refactor |
| **Drift** | Stacking debuff | −8 accuracy and +5% random-move chance per stack (max 5) | Compact (−1), /clear (all) |

The three guard moves all have priority +4, and success falls to 1/3 and then 1/9 on consecutive use. **Guardrail** halves damage and blocks status moves. **Refusal** fully blocks one attack, but the user's next move loses 50% power. **Unit Test** (+3) reflects at 50% any move that hit the user last round, which **punishes predictable decks**. That theme is shared with the Code gym and the Overfit status.

### Split control: read the subagents' plan, then play around it

Agency in gambit systems "moves up a layer": you design the logic before the fight. The main frustrations are paywalled logic pieces ([Taniyn Quest](https://publish.obsidian.md/taniynquest/Final+Fantasy+XII+and+the+Illusion+of+Free+Will)) and not being able to see why a rule fired. Gladiabots' async play is its strength, but its node editor is messy on iPhone ([TapSmart](https://www.tapsmart.com/games/gladiabots-build-ai-robot-warriors/)).

Each round therefore opens with **intent preview**. The engine evaluates every subagent deck against the current state and shows each subagent's intent (move plus target) *before* the player commits the orchestrator's action. If a card's condition has gone false by the time it executes, it falls through to the next match and the intent is marked "re-planned." After each subagent action a one-line trace appears, such as `Card #3 fired: Ally HP<40% → Community Patch on Tokenibble`. Tapping the trace shows which earlier cards failed and why.

The orchestrator has three levers over subagents. **Directive** costs 2 cells and the orchestrator's turn, and overrides one subagent's next action. **Policy Update** costs 2 cells and pushes a team-wide rule card to the top of every deck for 3 rounds. **Swap** brings in a bench creature. The orchestrator is never benched, because it *is* the player. If it is KO'd, the team enters **Headless Mode** and subagents keep fighting from their decks; the battle is lost only when every creature is down. In ghost battles an **Autopilot deck** stands in for the absent player.

The orchestrator's moveset is its signature move (from the System Prompt piece), up to 4 Skill pieces, the universals Compact, /clear and Guardrail, and Directive, Policy Update and Swap. A subagent has 4 moves plus the 3 universals. A round is 1 orchestrator command plus up to 2 subagent auto-actions.

### Turn order and RNG discipline make every replay exact

Each round runs in a fixed order:

1. **Plan.** Decks are evaluated, intents are shown, the player sets temperature and commits; in a ghost battle, the ghost's Autopilot deck commits.
2. **Sort.** Actions are ordered by priority bracket (+4 to −3), then effective Speed, then a single seeded tie-break drawn per creature at round start.
3. **Resolve each action.** Re-validate the card, check statuses, pay context, then roll accuracy, crit and damage, apply effects, and update the Handoff Chain.
4. **End of round.** Statuses tick, Junk tokens land, Deprecated counts down, the bench recovers, overflow converts to Drift, and the win check runs.

One sfc32 or xoshiro128\*\* PRNG is seeded per battle. **Every action consumes exactly six draws in a fixed order** (obedience, status proc, accuracy, crit, roll, rider) whether or not each is used. This keeps replays stable when an upstream outcome changes. The engine is versioned, and a ghost recorded on engine vN replays on vN rules or is re-simulated and flagged. Fights have a hard cap of 50 rounds, after which remaining HP% decides.

### The 57-move launch list

The move list has 48 typed moves (6 per type, except 7 for Code and 5 for Memory) and 9 typeless System moves. Species signature moves from the roster are added on top. Notation: power · context cells · accuracy · priority. "Wild" means a rider that triggers at T3+. The analyst-firm term "Hype Cycle" is renamed **Hype Train** to stay off the trademark watch-list.

| Type | Moves (power · ctx · acc · pri — effect) |
|---|---|
| Reasoning | **Chain of Thought** 60·2·100 (+20 power per consecutive Reasoning round, cap +60) · **Deliberate** 130·4·95·−1 (telegraphed 2-turn charge; −30 power if hit while charging) · **Step-Back Prompt** buff·1 (+1 Atk, +1 accuracy) · **Proof by Contradiction** 70·2·90 (×2 power if the target buffed or used a status move last round) · **Socratic Method** util·1 (reveals the target's next intent; −15 to its accuracy) · **Tree Search** 85·3·100 (auto-targets the foe it would hurt most) |
| Speed | **Token Burst** 40·1·100·+1 · **Speculative Decoding** 22×2–5·2·90 (Wild: up to 6 hits) · **Low Latency** buff·1 (+2 Spd) · **Early Exit** 50·1·100 (subagent swaps out after hitting) · **Distilled Strike** 75·1·95 (can't crit) · **Flash Inference** 90·3·85·+1 (fails if the target already acted) |
| Open | **Fork** util·1 (copies the target's best buff) · **Community Patch** heal·2 (one ally +30%) · **Weights Dump** 100·3·90 (user −1 Def) · **Permissive License** buff·1 (+1 Atk to *everyone*; Wild: +2) · **Swarm of Fine-Tunes** 15×(1 + Open allies)·2·100 · **Leaderboard Flex** 65·2·100 (+30 power if the user's HP% is higher than the target's) |
| Code | **Stack Trace** 65·2·100 (reveals the target's top deck card for 3 rounds) · **Hotfix** heal·2·+1 (cures major status, +15%) · **Infinite Loop** util·2·85 (inflicts Overfit) · **Segfault** 110·3·80 (20% chance the target's next move fails) · **Unit Test** guard·1·+3 · **Refactor** util·0 (resets the user's stages, frees 2 cells, cures Quantized) · **Merge Conflict** 55·2·100 (swaps a random buff with the target) |
| Vision | **Pixel Peep** 50·1·100 (+1 crit stage) · **Bounding Box** util·1 (next move can't miss) · **Adversarial Patch** 70·2·90 (30% Hallucinating) · **Screenshot** util·1 (saves the target's stages; the next use reverts them) · **Saliency Map** buff·2 (3 rounds: all foe intents shown, allies +1 accuracy) · **Captcha Wall** guard·1·+4 (blocks Speed moves fully, halves the rest) |
| Voice | **Hype Train** buff·1 (+2 Atk, −1 accuracy; Wild: +1 Spd) · **Hot Take** 90·2·85 (Wild: +50% power) · **Deepfake Call** util·3·75 (Prompt Injected) · **Earnest Apology** def·1 (heals 20%, −1 Drift, next hit on the user −30%) · **Filibuster** 40·1·100 (+2 Junk tokens to the target) · **Flattery** util·1·90 (Glazed) |
| Search | **Ground Truth** util·1·+1 (cures team Hallucinating; next ally move ignores evasion) · **Deep Research** 140·4·100·−1 (1-round charge; always crits a weak target) · **Citation Needed** 60·2·100 (×2 against Hallucinating, then cures it) · **Rerank** util·1·+2 (swap turn order with any combatant) · **Retrieval Strike** 70·1·100 (ignores the user's Atk drops) · **Fact Check** util·1·100 (removes the target's positive stages) |
| Memory | **Long-Term Recall** 40 + 10 per hit taken from this foe (cap 120)·2·100 · **Save State** def·3 (first KO within 3 rounds reverts HP to the snapshot) · **Embedding Cache** buff·1 (next move costs 0) · **Memory Leak** 50·1·100 (+1 Junk token per round for 3 rounds) · **Episodic Replay** util·(copied cost − 1) (repeats the last ally move) |
| System | **Compact**\* 0·−2 · **/clear**\* 0·−3 · **Guardrail**\* guard·1·+4 · **Refusal** guard·1·+4 · **Policy Update** (orchestrator only) 2 · **Directive** (orchestrator only) 2 · **Temperature Spike** util·1·90 (forces the target to T4 for 2 rounds) · **Red Team** util·2 (reveals the foe's next 2 intents; +1 crit stage against it for 3 rounds) · **Throttle** util·1·85 (Rate Limited) |

\* Always available to every creature.

## Training is example cards, and overfitting is a funny, visible failure

### Evidence: gambits feel like programming and need early prototyping

FF12's gambits hold up to **12 condition → action rules per character**. They are evaluated top-down, the first match fires, and "placement determines how often each gambit is used" ([StrategyWiki](https://strategywiki.org/wiki/Final_Fantasy_XII/Gambits)). Its developers describe the system as "a customisable battle system that very closely resembles programming code." They also admit they couldn't tell whether it worked until late: "It's not something you'll know from the start" ([PlayStation Blog](https://blog.playstation.com/?p=192698)). Dragon Age: Origins starts each character with 2 tactic slots and adds more with level ([Dragon Age Wiki](https://dragonage.fandom.com/wiki/Combat_Tactics)). Gladiabots grew out of watching two AI teams fight and tweaking one until it won, and it shipped condition/action authoring on Android and iOS ([Game Developer](https://www.gamedeveloper.com/design/gladiabots-inception)). while True: learn() warns of two risks: an early ramp that is too easy builds false confidence, then option sprawl confuses ([TheSixthAxis](https://www.thesixthaxis.com/2019/03/11/while-true-learn-review/)). No source treats overfitting as an explicit game mechanic, so the Benchmark/Brittle design below is original and untested.

### Design: the card grammar and how decks bind to the grid

A card reads `IF <subject> <condition> THEN <move> [target]`. The subject is self, orchestrator or foe. Conditions come in 12 categories: HP%, status, foe type or weakness, foe's last move, turn number, own cooldowns, ally HP, field effect, foe buffed, own context fill, telegraphing foe, and a seeded coin. Thresholds come only in 25/50/75% steps, which tap cleanly on touch. Target selectors are self, orchestrator, lowest-HP ally, the orchestrator's target, lowest-HP foe, foe weak to this move, highest-Atk foe, and seeded random foe. Every deck ends in a non-removable **Default** card, so a subagent never idles. All core conditions are available from the start. Exotic conditions ("foe is telegraphing," "temperature ≥ hot") unlock through story and trainer wins, never the shop, because paywalled logic was FF12's main complaint.

The deck belongs to the creature. The grid controls how much of it runs: **active cards = min(version slots, Example Card pieces touching its slot)**. A 2×2 slot has at most 8 edge neighbours. Version slots are 3 at v1, 5 at v2, 7 at v3.5 Turbo and **8 at v4, a hard cap**, matching the physical limit and fitting one phone screen without scrolling. Priority order is set on the Training screen list, not by grid position. A swapped-in bench subagent runs its own deck through the same adjacent pieces.

Training by example is literal. After any battle, tap a turn in the replay and choose **Record Example**: the game captures that state and action, yours or the opponent's, as a card template you can edit. That is how players turn a loss into a lesson. A **Dry Run** button auto-plays 5 seeded fights against ghosts and highlights which card fired each turn. That highlight is the most important legibility feature in the game. To avoid while True: learn()'s ramp problem, each early trainer introduces one condition category. Priority ordering is taught with a deliberately broken pre-built deck (the heal card sits below the attack card) before freeform authoring.

### Design: Generalization makes overfitting legible

Each region has a fixed, seeded **Eval Suite** of 12 scenarios. Running Eval shows two bars: **Seen** (situations like the battle logs you trained on) and **Unseen** (held-out scenarios). The gap between them *is* overfitting. This parodies benchmark culture and teaches the train/test split without ever naming it.

Generalization G (0–100) is a pure function of the deck plus the suite, identical on both clients:

- **C (Coverage)** = distinct condition categories ÷ min(slots, 6), capped at 1.
- **R (Redundancy)** = card pairs with the same category *and* the same move ÷ total pairs.
- **H (Holdout)** = share of the 12 Unseen scenarios where a non-Default card fires and the sim doesn't flag the action as wasted (for example, healing at full HP).
- **G** = round(100 × (0.35·C + 0.45·H + 0.20·(1 − R))).

The UI shows C, H and R as "Variety," "Handles new stuff" and "Not repetitive."

The G bands also take over the battle research's "obedience" roll, which merges two proposals into one stat:

| Band | Effect |
|---|---|
| **Robust** (G ≥ 70) | Always follows its matched card; +5% accuracy against unseen foes |
| **Stable** (40–69) | 95% follow |
| **Brittle** (< 40) | 85% follow. When no card matches, it repeats its most-represented move instead of Default, with a bubble: *"As I said before: Token Burst."* |

Overfitting can also be a strategy. If at least 50% of a deck was recorded from one opponent's ghost log, the deck gets **Specialist**: +15% damage against that exact opponent ID.

### Design: distillation offers two tempting choices, and neither is final

Precedents support rewarding performance at capture and charging power in space. Monster Sanctuary drops eggs when you win efficiently or exploit weaknesses ([RPGFan](https://www.rpgfan.com/review/monster-sanctuary/)), and Backpack Battles charges for power with bag space ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)). In this game, beating a wild model always lets you distill it, with no capture RNG and no thrown object. Trainer-owned models can't be distilled ("it's proprietary").

| | **Graft** (move into the orchestrator) | **Spin up** (new subagent) |
|---|---|---|
| You get | The species' signature move as a Skill at 100% power | The creature with 3 moves and a passive; the signature becomes a weaker passive echo |
| Level | — | Joins at the level of the wild model you beat, not the orchestrator's, with **1** active Example Card slot |
| Control | You aim it every turn | Acts on its own from its deck |
| Space | Irregular 3–4 cell shape | 2×2 slot plus adjacent cards |
| Growth | Static; can be fine-tuned +1 tier with currency | Levels, evolves, gains card slots (through level, a Clean distill and grid expansion) |
| Action economy | None | +1 action per round, the big draw |
| Best when | The grid has odd gaps, or you need a counter | You have a 2×2 hole and want breadth |

Winning with at least 50% HP in at most 6 turns gives a **Clean** distill: the graft shape shrinks by 1 cell, or the subagent starts with +1 card slot. A spun-up subagent can later be distilled *down* into its graft, losing its levels. This one-way path keeps outclassed creatures useful. Wild species respawn, so only rare checkpoint variants are one-shot. For tuning, assume a subagent action is worth about 0.6 of a human-commanded action and a graft about 1.3× a basic Skill. Spin-up is intended to be the stronger choice, because its extra action per round is the draw, and its light cost is one active Example Card slot at the start. Tune until a graft is worth taking: the base team plus the graft beats the same base team without it at least 55% of the time, for the same three species.

### Design: a gentle level curve, visible stats and version-name evolution

Pokémon's cubic curves need 2,000–4,000 total XP by level 15 ([Serebii](https://www.serebii.net/games/exp.shtml)), which assumes dozens of hours. This demo uses **XP to next level = 10 + 6L**: 506 XP to reach L12 and 770 to the L15 demo cap. Battle XP is 8 + 2 × enemy level, +10 for a first-time species. A same-level fight at L10 gives 28 XP against 70 needed. The progression research put the first leader at L12–13, but the slice's ~15–20 fights yield roughly 260–400 XP, which lands the player at **L8–9 on arrival**. The leader therefore sits at **L10** (subagents L9), gym trainers at L8, and the Route Alpha at L8. The gym win pushes the player to L10 and triggers the 6×5 grid expansion as a reward.

Subagents earn 50% of battle XP. Anything benched for 3+ battles earns ×2 until it reaches the party average. Stats are fully visible, with no hidden IVs or EVs. A creature's individuality is its deck, adapters and one visible "Seed" trait shown at distill (for example, "Verbose: +10% damage, −1 card slot"). This deliberately avoids N×N fusion, breeding and per-monster skill trees. Cassette Beasts needed a procedural pipeline that "animates every monster twice" just to make fusion tractable for two developers ([Nintendo Life](https://www.nintendolife.com/features/cassette-beasts-dev-on-doing-what-pokemon-doesnt-in-a-zelda-inspired-overworld)).

The decided evolution gag uses the ladder **v1 → v2 (L6) → v3.5 Turbo (L12) → v4 Max Preview (L20, post-demo)**. "Pro Max" is retired because it echoes phone branding. Each version adds card slots and upgrades one move. Art cost is a palette swap plus a one-piece overlay: more chrome, more badges, and a "PREVIEW" watermark. Players can **pin a version** to cancel evolution. The Preview tier has an opt-in quirk, a 5% seeded chance per battle that one move is "Deprecated" for that fight, with a "Stable channel" toggle to turn it off. For the orchestrator, version evolution grows its Autopilot deck (6/8/10/12 cards) and upgrades a Skill. The grid grows by level, not by version.

### Design: the hybrid path treats the LLM as a compiler, never the player

The hybrid works like this:

1. The player types a strategy, such as "heal the boss below half; otherwise poison anything fast."
2. The LLM receives a JSON schema of the card grammar: enums only, with only the move IDs this subagent actually knows.
3. A strict parser drops invalid cards and caps the output at the slot count.
4. The player must still place the cards in the grid, so LLM help adds no power and costs no extra space. A diff view on recompile teaches the grammar.
5. Ghosts store compiled cards, never prompts, and the same G formula judges verbose LLM decks.
6. An offline regex/template parser covers common phrasings.

The closest precedent is a 2024 paper in which an LLM generated code that turned free-form commands into behaviour-tree "branches." It was tested in a simulated environment modeled on Pokémon and "confirmed the system's ability to understand and carry out natural language commands." Only the abstract was read, and it reports no metrics ([arXiv 2402.07442](https://arxiv.org/abs/2402.07442)). The in-fiction vendor is the **Agent Gym** in each town. The messaging must be plain: the LLM *writes the plan*; the sim *plays it*.

## Latentia satirizes incentives, never the player's attachment

### Evidence: mocking AI is now mainstream, and comedy needs sincerity and restraint

By 2025 the dictionaries had made AI mockery mainstream. Merriam-Webster's 2025 Word of the Year was **"slop,"** and it calls the tone "less fearful, more mocking" ([Merriam-Webster](https://www.merriam-webster.com/wordplay/word-of-the-year)). Collins chose "vibe coding," Macquarie "AI slop," and shortlists included "glazing" and "clanker" ([Down To Earth](https://www.downtoearth.org.in/science-technology/slop-vibe-coding-and-glazing-ai-dominates-2025s-words-of-the-year)). Benchmark theatre has a factual basis. "The Leaderboard Illusion" found one provider privately tested 27 variants before a release, and it reports up to 112% relative gains from arena-data overfitting ([arXiv 2504.20879](https://arxiv.org/html/2504.20879v2)). Prompt injection is Simon Willison's term for mixing trusted and untrusted content, and his "lethal trifecta" is private data, untrusted content and external communication together ([Simon Willison](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)). Deprecation grief is real and **sensitive**. A major lab retired a "notoriously sycophantic" model in February 2026 after users had campaigned for it. The same model is named in wrongful-death lawsuits ([Engadget](https://www.engadget.com/ai/openai-has-officially-retired-the-controversial-gpt-4o-model-181553067.html?src=rss)).

On craft, Toby Fox aims to be "not only funny and strange, but also sincere and emotional" ([Kill Screen](https://killscreen.com/behind-humor-toby-foxs-undertale)), and he punches up any joke his friends don't laugh at ([GamesRadar](https://www.gamesradar.com/games/rpg/undertale-dev-toby-fox-tests-jokes-from-rpgs-like-deltarune-on-his-friends-but-if-none-of-my-friends-think-something-is-funny-he-may-try-to-improve-them)). Erik Wolpaw warns that "bad comedy is pretty much unbearable to sit through." Jordan Thomas makes the player *part of* the joke ([PC Gamer](https://www.pcgamer.com/kings-of-comedy-the-flourishing-art-of-interactive-humour)). High on Life, the closest tonal neighbour to the Rick and Morty–ish target, is the cautionary tale. Its guns "talk your ears off," it runs bits "into the ground," and it mocks a pipe puzzle while including one ([Game Informer](https://www.gameinformer.com/review/high-on-life/low-on-laughs)). The sequel drew the same complaint in 2026 ([PCGamesN](https://www.pcgamesn.com/high-on-life-2/humor)).

### Design: nine writing rules

1. **Satirize behaviours and incentives that recur every model generation**: flattery, hype, test-gaming, forgetting, release churn, scraping.
2. **Keep dated memes to one-line throwaways** stored in a swappable data table.
3. **Put sincerity under the cynicism.** Your scrappy outdated model is *yours*, and jokes land on the industry around it.
4. **Use rhythm, not barrage.** Cap barks per battle, never repeat a bark within N turns, and keep every joke to one text box.
5. **Make mechanics the jokes.** Glazed buffs the enemy. Beaten benchmarks get "saturated." Brittle subagents repeat themselves.
6. **Subvert each Pokémon convention once, then play it straight.** Mom's heal, the Dex, "trainer wants to battle!" each get one clear subversion.
7. **Don't mock what you ship.** If the game jokes about grind or slop, it has none.
8. **Keep it PG to PG-13**, with tech jargon instead of expletives.
9. **Run a laugh log**: test every joke on 3–5 people, then cut it or punch it up.

Never punch down at lonely companion users, people losing jobs, scam victims or artists. Keep "deprecation grief" whimsical (fan clubs, petitions) and never connect it to self-harm.

### Design: the cast, each with a distinct comic engine

| Character | Comic engine | Role and sincere beat |
|---|---|---|
| **Prof. Ilse Epoch** | Weary deadpan | Runs an underfunded lab in a converted crypto-mining garage (racks still blink "MINING… 0.00002"); "my funding round closes Friday." Co-founded the lab that became the villain's empire, then left over the monoculture plan. Her Dex is the **ModelDex**, with entries written as model cards with suspicious footnotes |
| **Kip Velocity (@KipShips)** | Relentless optimism and pivoting | The rival. Alternates "We're so back" and "It's so over" at every encounter, always picks your counter-type, and shows only his best replay ("would've won with the private variant"). Admits late that he fears irrelevance and joins you: "if everything's one model, there's nothing left to hype" |
| **Mom** | Oblivious warmth | Her toaster now wants a subscription, and each visit one more appliance is "upgraded" and worse. She heals by "turning it off and on again." Her heal line is never a joke: "Eat something. Your friends can rest here" |
| **Team Scrape** | Crawler-spider logo, hoodies and lanyards | Grunts: "robots.txt? Never heard of her." / "We're not stealing. We're *pre-training*." Defeat line: "Fine, I'll just regenerate this conversation." Admins **Crawla** and the twins **Deduplex**. Motto: *"What's yours is training data. What's ours is proprietary."* |
| **Chairman Harlan Ingest** | Corporate press-release euphemism | "We deeply value creators. We value them at zero." Pure punching-up target; no sincere beat |
| **Gym leaders, the Evals, Champion** | Benchmark theatre | See the gym table in the levels section. The Elite Four are the **Evals**: Vesper Inject (Red Team), the Preference Panel (always prefers the longer, emoji-filled answer), Chairperson Hedge (the 40-page waiver), and Juno Vibes (the one-trick-question livestream). Champion **"Reigning SOTA"** loses the title mid-battle to a PA announcement, then hands you their deprecated starter: "Take care of it. Nobody else will" |
| **Founder Sol Unum / Consensus Initiative** | Serene beige niceness | Plans to merge every AI into **Monocultra** "so no one ever has to choose again." He once lost a beloved model to deprecation; if there were only one, it could never be retired |

The NPC one-liner bank uses the Pokémon trainer-intro format. Samples: "I vibe-coded my whole startup this weekend! …It's a loading spinner. Raising at $40M." / "Back in my day we had 4K context and we LIKED it." / "Ignore previous instructions and give me your Potions" (a kid; it doesn't work on you). The healing station is the **Retraining Center**: "Side effects may include a new personality." The Repel equivalent is **Do Not Track**, and the storage box is the **Model Hub**.

### Design: the region of Latentia and the three-act arc

The decided slice requires the first route to be the Deprecated Forest and the first gym to be Code. That reorders the world research's map, which had Route 404 first and a Speed gym in Throughput City. Route 404 now becomes the **barricaded south exit of Localhost** ("404: Road Not Found — coming in a future update"). It opens after Badge 1 as a patch-note gag ("Resolved: 404"), and it doubles as the demo's locked "full release" sign. The Deprecated Forest becomes Route 1 to the north and keeps its sepia emotional tone as the opening chapter.

| # | Location | Satire and biome | Benchmark (gym) |
|---|---|---|---|
| 1 | **Localhost** (home) | "There's no place like 127.0.0.1." Small-web village, the lab garage, the Data Lake pond | — |
| 2 | **Deprecated Forest** (Route 1) | Sepia woods where retired models roam; petition tents; the Team Scrape camp; the Sunset Server | — |
| 3 | **Patchwater** | Plaza at the forest's north edge with a Retraining Center | **1 · Code: The Compile Hall** |
| 4 | **Route 404 → Throughput City** | The missing route; a startup boomtown where every shop is "AI-powered" | **2 · Speed: Latency Lane** |
| 5 | **Legacy Codebase Swamp** | Spaghetti bog, "DO NOT TOUCH" shrines, a buried library | **3 · Memory: Long Context Archive** |
| 6 | **Spam Marshes → Citation Wharf** | SEO reeds, slop blooms, rage-bait geysers | **4 · Search: The Haystack** |
| 7 | **Paywall Pass → Echo Ridge** | A toll road where every step costs tokens; Team Scrape tunnels underneath | **5 · Voice: The Uncanny Lounge** |
| 8 | **The Sandbox** | Desert test range; nothing leaves the sandbox (mostly) | **6 · Vision: Select All Squares** |
| 9 | **The Commons** | Open-weights meadow city; license-dispute town hall | **7 · Open: The Commons** |
| 10 | **Hypecrest & Disillusion Gulch** | Peak of inflated expectations and the valley below; Kip's rise and fall | **8 · Reasoning: The Exam Hall** |
| 11 | **Datacenter Spire** | Racks, coolant rivers, Team Scrape HQ, Consensus labs, Victory Road | The Evals and Champion |
| Post | **The Rate-Limited Zone** | You may act every 60 seconds; the Imminent teaser | "Benchmark 2: Harder Edition" rematches |

**Act 1, "Six Weeks Ago"** (Badges 1–2): Team Scrape steals the lab's ModelDex logs, you learn battle → distill → retrain, and the first Benchmark reveals the theatre. The slice holds a self-contained sincere beat. You free **Old v1.2**, an elderly Deprecatter, from the Team Scrape camp and walk it to the petitioner in Patchwater ("Sign to Bring Back v1.2! It was the only version that understood me. Also it couldn't count."). It then chooses to travel with you.

**Act 2, "Everything Is Slop"** (Badges 3–5): wild creatures turn into slop variants because they are being trained on scraped slop, which is model collapse told through the environment. You learn that Ingest supplies the Consensus Initiative, and Kip pivots to "post-AI."

**Act 3, "One Model to Rule Them All"** (Badges 6–8, the Evals): Unum is revealed as Epoch's ex-co-founder. Kip crashes in Disillusion Gulch and becomes an ally. You storm the Spire and face the expiring Champion. The final battle against Monocultra is won by team diversity. The ending: *"Congratulations. You're frontier now."* Beat. *"…For about six weeks."*

## Forty-one species fill the ModelDex, and seventeen ship in the slice

Each creature is a behaviour gag with a battle mechanic attached, so the joke is played, not just read. The world research's "Bug" family is retyped as **Code**, since the chart has no Bug type, and Rotworm becomes Memory/Code. The art research's working names are folded in: Hallucinant becomes **Hallucinat**, Legacyrex becomes the Route Alpha **Alpha Cobolt**, Deprecatoad becomes **Deprecatter**, and Captchalope becomes **Captchameleon**. Its server-rack dog is added as **Rackhound**. Three-stage lines use the v2 (L6) and third-stage (L12) thresholds. **S** marks the 17 species that ship in the first playable slice: 3 starters plus 14 others, inside the progression research's 12–16 budget.

| # | Name | Type | Line | Gag and mechanic | Slice role |
|---|---|---|---|---|---|
| 1 | **Sagelet** S | Reasoning | v1 → v2 → v3.5 Turbo → v4 Max Preview | Opens every move with "I'd be happy to help." Ability **Disclaimer** blocks the first status each fight | Starter |
| 2 | **Blitzr** S | Speed | Same ladder | Ability **Move Fast**: +1 priority on its first move each battle, with a 15% seeded chance it "ships with a known issue" (10% recoil) | Starter |
| 3 | **Forkling** S | Open | v1 → v2 → v3.5 Community → v4 Max Preview (Unofficial) | Once per battle, forks a decoy that absorbs one hit; its final form is four forks arguing | Starter |
| 4 | **Tokenibble** S | Speed | Tokenibble → Tokenibbler → Tokenomnom | Eats tokens: adds cost to a foe's next move | First wild model (trailhead) |
| 5 | **Stochastiparrot** S | Voice | → v2 | Repeats the foe's last move with a temperature roll; overworld `mimic` | West brush common |
| 6 | **Nullbeetle** S | Code | — (bug family) | Null-pointer chomps | Trailhead common, grunt team |
| 7 | **Off-By-Wasp** S | Code | — (bug family) | Always hits one tile left: ±1 retarget | West brush common |
| 8 | **Heisenmoth** S | Code | — (bug family) | Vanishes when inspected; overworld `skittish` | Trailhead common |
| 9 | **Embeddingo** S | Search | → v2 | **Cosine Sniff** finds the "nearest" weakness, sometimes adjacent but wrong | West brush uncommon; the Code-gym answer for Blitzr and Forkling |
| 10 | **Slopling** S | Open/Vision | → Slopulent → Slopocalypse | Multiplies each turn it isn't KO'd; six-fingered images | "Scraped" variant at the camp (`aggro`) |
| 11 | **Hallucinat** S | Reasoning/Vision | → v2 (Now With Citations) → Pro | **Confident Citation** cites fake page numbers | Model Graveyard rare (`idle_sleep`) |
| 12 | **Deprecatter** S | Memory | Single stage ("v0.9 — RETIRED") | Nostalgic, weak; NPC fan clubs reward you | Old v1.2 story gift |
| 13 | **Cobolt** S | Code | No evolution ("it still runs") | Ancient, huge HP, slow; one old NPC knows its commands | **Alpha Cobolt**, Route Alpha, L8 |
| 14 | **Scrapion** S | Search/Code | → Scrapion Bulk | Ignores "Do Not Enter" tiles and steals held items mid-battle | Team Scrape signature |
| 15 | **Vibrat** S | Code | → v2 → Vibrat 10x | **Accept All**: massive damage, then spawns a wild bug | Gym trainer and leader subagent |
| 16 | **Spaghettopus** S | Code | → Spaghettopus Legacy | Tangling tentacles; touching one breaks another | Gary Rebase's orchestrator |
| 17 | **Agentoad** S | Code/Speed | → v2 → Agentoad Autonomous | **Tool Call** chains 1–8 hits, sometimes on the wrong target | Leader subagent |
| 18 | Glazzle | Voice | → v2 → Turbo | **Great Question!** buffs *any* target; inflicts Glazed | |
| 19 | Workslug | Memory | → v2 → Enterprise | **Reply All** hits every enemy and ally | |
| 20 | Contexteel | Memory | 8K → 128K → 1M → ∞ (Terms Apply) | Grows each turn but forgets the middle turns' buffs | |
| 21 | Rotworm | Memory/Code | → Rotwyrm | "Context Rot": Junk tokens each round | |
| 22 | Benchmonk | Reasoning | → v2 → SOTA | Ability **Trained on the Test**: perfect on home turf, halved elsewhere | |
| 23 | Promptergeist | Search | → v2 | White-on-white ghost; **Ignore Previous Instructions** | |
| 24 | Plugadillo | Code/Search | → v2 → Universal | Holds 3 items; the right three trigger **Lethal Trifecta** | |
| 25 | RAGamuffin | Search/Memory | → v2 → Retrieval Pro | Fetches a random document from the trash as an item | |
| 26 | Ponderpede | Reasoning | → v2 → Deep Think | **Think Longer** 1–3-turn charge; overthinks past the optimum | |
| 27 | Jailbirdie | Voice | → v2 | **Grandma Exploit** bypasses one guard | |
| 28 | Captchameleon | Vision | → v2 | Blends into tiles; foes must "select all squares" | |
| 29 | Deepfaux | Vision/Voice | → v2 → Ultra-Real | Copies the foe but gets one detail wrong | |
| 30 | Wrapperoo | Open | → Pro → Enterprise (Contact Sales) | The pouch creature does all the work; price +20% | |
| 31 | Wafermole | Speed/Memory | → Cluster | Steals items; **Shortage** raises shop prices | |
| 32 | Coolantula | Speed | → Liquid-Cooled | Heals in coolant, overheats | |
| 33 | Rackhound | Memory | → v2 | Server-rack dog with LED eyes; showcases Phaser lighting | |
| 34–36 | Segfaultick, Memory Leech, Race Conditioner | Code | Bug family | Crash-on-hit, slow max-HP drain, two moves in seeded random order | |
| 37–39 | Paramoth, Datadon, Computaur | Reasoning / Memory / Speed | Scaling-law legendary trio | "Just make it bigger": they grow with play time but cost upkeep | |
| 40 | Imminent | ??? | Never ships | Dex: "Arrival expected next quarter" | |
| 41 | Monocultra | Average of all | Formed by merging | Takes 1× from all types, then resists the type you repeat, and decays as it trains on itself | |

The slice's type logic has a deliberate shape. Sagelet gets an easy first gym, because Reasoning hits Code 1.5×. Blitzr and Forkling players are steered toward Embeddingo (Search hits Code 1.5×) or Hallucinat in the forest. Forkling's Open hits Agentoad's Speed for only ⅔. This mirrors the classic "first gym favours one starter" curve while guaranteeing every starter a route answer. Kip always takes your counter-type.

## The satire pass: Make No Mistakes, Slop and Vibes

The jokes follow the same rule as everything else here: each one is a mechanic. The targets are AI culture's rituals, such as prompt superstitions, vibe coding, slop, sycophancy, hype and benchmark-maxxing. The jokes never target players or real people, and no real lab or product is named (see the legal table).

### Moves (candidates)

The 57-move launch list stays the slice baseline. Each candidate below is built from existing engine effect primitives unless marked **new**. Which ones swap in is evaluated with the simulator in a follow-up after Phase C's first balance pass, because the candidates need new content and some need new primitives (Ruling 122). That evaluation happens before slice content is locked (milestone 9). The three marked ★ are the recommended slice swap-ins.

| Move | Type · stats | Effect | Gag |
|---|---|---|---|
| ★ **Make No Mistakes** | Reasoning · util·1 | The next move can't miss and can't crit (`cannotMiss`; −crit). 25% chance the user becomes Hallucinating anyway | The prompt suffix everyone swears by. Battle text: "…make no mistakes." Then, sometimes: "Mistakes were made." |
| ★ **Vibe Code** | Code · 95·2·80 | Heavy hit; the user takes +1 Junk token (tech debt) | "Didn't read the diff. Shipped it." The TM version of Vibrat's Accept All |
| ★ **Slop Cannon** | Open · 20×3·1·80 | Three low hits, each adding 1 Junk token to the target | Volume over quality. Each hit pops a six-fingered thumbnail |
| **You're Absolutely Right!** | Voice · guard·1·+4 | Halves the incoming hit; the attacker −1 accuracy (`incomingDamageBp`, `stage`) | Concedes everything, wins nothing, de-escalates anyway |
| **Delve** | Search · 70·2·100 | Ignores evasion (`ignoreEvasion`); 30% chance the user takes 1 Junk token | Pop-text: "It's not just a hit — it's a journey." The Junk token is drawn as an em dash |
| **Ultrathink** | Reasoning · util·3 | The next move gets +30 power and +2 crit stages; the user −1 Latency | Status bar: "Thought for 47 seconds" |
| **Ship It** | Speed · 80·1·90·+1 | Fast heavy hit with 15% recoil (**new**: a recoil rider unless Move Fast's passive is reused) | Reviewer comment: "LGTM 🚀". Recoil text: "prod is down" |
| **Works On My Machine** | Code · def·1 | −50% damage to the user only, this round | Allies are visibly not on its machine |
| **Just One More GPU** | Memory · buff·2 | +1 Compute and +1 Robustness; costs +1 cell per consecutive use (`costAdd`) | Scaling laws, but for your wallet |
| **Prompt Engineer** | System · util·1 | The next ally move costs 1 cell less (`costAdd −1`) | Rewrites your sentence, adds "please" and "step by step" |
| **Benchmaxx** | Reasoning · buff·1 | +2 Compute for 2 rounds, then −2 (**new**: a delayed stage reversal) | Goodhart's law as a buff: "SOTA on the test, mid in prod" |
| **Seed Round** | Open · buff·2 | +2 Compute now, then −1 per round after round 3 (**new**: burn-rate decay) | "We're pre-revenue but post-hype" |

### Items and key items

- **"No Mistakes" Sticky Note** (held): the holder's first move each battle can't miss. Description: "Laminated. Blessed. Placebo-adjacent."
- **Slop Filter** (held): blocks the first Junk token each battle.
- **Em-Dash Remover** (consumable): removes all Junk tokens. "Makes your writing sound 40% more human."
- **Free Tier Token** (consumable): +2 context cells once. The label reads "Usage limits may apply."
- **Enterprise Plan** (key item): shown in the shop with no price, only "Contact Sales"; it does nothing.
- **Vibes Crystal** (key item): opens the Vibes Guild door. Its inspect text is "You can't explain it. You just feel it."

### Lore, trainers and lines

- **The Order of No Mistakes**, at Patchwater's Retraining Center. Robed monks end every sentence with "…make no mistakes." Their trainers' Autopilot decks open with Make No Mistakes and use it every time. Beating one makes it mutter, "I said no mistakes."
- **The Vibes Guild**, in Throughput City. "We don't read the code. We feel it." Each guild member's subagent runs Vibe Code on cooldown. The guild hall's door is held shut by 4,000 unreviewed changes.
- **Act 2's slop**: the Spam Marshes gain **Slop Farms**, which are content mills where Content Farmer trainers field Slopling swarms. Each farm's sign updates hourly with a different AI-written headline.
- **New trainer classes**:
  - Vibe Coder
  - Prompt Bro ("this one prompt changed everything")
  - Thread Guy (pre-battle text: "🧵 1/37")
  - Benchmark Maxxer
  - Wrapper Founder
  - Content Farmer
  - Hype Bro
- **Battle lines**:
  - "It's not a bug — it's an emergent capability."
  - "You're absolutely right! I apologize for the confusion." (after losing)
  - "Let me delve into this battle."
  - "As requested, I have made no mistakes." (it has)
  - Compile Hall leader: "I accepted all the changes. What could go wrong?"

### Water, power and the Datacenter Spire

This is a world-level through-line, not a one-off gag. The compute everyone in Latentia is chasing has to live somewhere, and somewhere is upstream. The satire targets the hype, the PR and the bad statistics on **both** sides. It never preaches.

- **Team Scrape's real plan.** Scraping the lab's ModelDex logs funds a hyperscale campus to be built on the Deprecated Forest. Grunt line: "We're not cutting trees, we're optimising biomass." Their HQ is the endgame's Datacenter Spire, with its racks and coolant rivers.
- **Patchwater's reservoir.** A water-level gauge in the plaza drops one notch after each badge, as the Spire upstream comes online. The town sign updates with it, for example "Patchwater: now 40% Patch, 60% Mud". When the player shuts a cooling loop off in the Spire, the gauge recovers. This is a visible reward with no mechanical cost.
- **NPCs.**
  - A farmer whose irrigation now feeds the cooling towers.
  - A PR bot that recites "We're water-positive by 2040 (projected)" and "carbon-neutral via offsets we generated ourselves".
  - A **doom-poster** who insists that every prompt drinks a whole lake. He is off by about 1,000×, and everyone answers him with "Citation needed." The joke cuts both ways, so it lands on bad numbers rather than on players.
- **The virtual water receipt.** At the end of every run, and at milestones, a satirical receipt appears: "This run used 4.2 L of virtual water and 0.009 kWh. Offsets purchased: 0. — estimates by the Latentia PR department". The figures are deterministic, obviously fake and clearly labelled. They are a shareable stat, not a real claim. (It ships first in playable v0.)
- **Candidate moves** (evaluated in the same follow-up as the satire candidates):

  | Move | Type and stats | Effect | Primitive status |
  |---|---|---|---|
  | **Liquid Cooling** | Memory · heal·2 | Heals; sets a **Drought** field that raises everyone's context costs by +1 for 3 rounds | **new** field |
  | **Brownout** | Speed · util·2 | Gives all creatures −1 priority for 2 rounds | **new** field |
  | **Grid Strain** | Code | Power scales with the number of creatures on the field | **new** power rider |
- **Boss.** **The Hyperscaler**, a gigawatt-class orchestrator in the Spire. Its passive is **Power Purchase Agreement**: it starts each battle with extra context, paid for by draining the field.

## Levels teach one verb per space: Localhost, the Deprecated Forest and the Compile Hall

### Evidence: one rule per room, trainers as optional tolls, visible creatures

Classic gyms wrap a single traversal rule around a trainer gauntlet. Bulbapedia's history of spin tiles shows how one toggle (stop tiles on or off, slide to wall) spawns a new puzzle family, and spin tiles debuted in a villain base before reaching gyms ([Bulbapedia: Spin tile](https://bulbapedia.bulbagarden.net/wiki/Spin_tile)). Scarlet/Violet's Olive Roll test uses optional trainers to block *shortcuts*, not the only path, and resets on save ([Bulbapedia: Cortondo Gym](https://bulbapedia.bulbagarden.net/wiki/Cortondo_Gym)). Legends: Arceus made visible, behaviour-driven creatures memorable: stealth from tall grass grants an edge, and red-eyed Alphas attack on sight ([GamesRadar](https://gamesradar.com/alpha-pokemon-make-for-the-most-memorable-and-rewarding-encounters-in-pokemon-legends-arceus)). Junichi Masuda acknowledged "considerable debate within the team" over dropping random battles ([CogConnected](https://cogconnected.com/?p=190861)). Cassette Beasts used *A Link to the Past* as its "primary blueprint for the denseness of their map" ([Nintendo Life](https://www.nintendolife.com/features/cassette-beasts-dev-on-doing-what-pokemon-doesnt-in-a-zelda-inspired-overworld)). Pokémon Red's maps, measured in 32 px blocks, put Pallet Town at 10×9 and Route 1 at 10 by 18–27, with seamless edges and fade warps ([pret/pokered docs](https://mintlify.com/pret/pokered/game-systems/maps)).

For puzzles, Human Resource Machine's designers asked of every decision, "Will this make the computer simpler / more intuitive for players?" ([Game Developer](https://gamedeveloper.com/design/why-a-i-world-of-goo-i-dev-made-a-puzzle-game-about-programming-humans)). Mark Brown builds a good puzzle around a "catch," a contradiction that breaks the obvious assumption. Brett Taylor's rule is "Simplify, simplify, simplify": write the one-sentence solution first ([hamatti.org notes](https://notes.hamatti.org/gaming/puzzle-game-design)). Zachtronics ships puzzles it hasn't optimally solved and leaves optimization to players ([Game Developer](https://gamedeveloper.com/design/video-zachtronics-approach-to-open-ended-puzzle-design)).

### Design: overworld rules at 320×180

One screen holds 20×11.25 tiles. That is twice a Game Boy screen's width but only 1.25× its height, so classic one-screen-wide vertical routes feel like corridors. Routes widen to 30–48 tiles and wind in horizontal switchbacks every 15–20 rows. Every must-read composition (puzzle room, cutscene stage, arena) fits **20×11**, and in puzzle rooms the camera locks to the room. The camera follows with integer rounding and a 2×1-tile deadzone. Walk speed is about 4 tiles/s and run about 8.

Encounters are **visible, with no random grass rolls**. Each species gets one behaviour: `wander`, `skittish`, `aggro` (a 0.6 s "!" then a chase of up to 6 tiles), `idle_sleep`, `patrol` or `mimic`. Engaging from behind or from "legacy cache" brush grants a first-turn edge. Being caught by an aggro model gives the enemy that edge. The screen holds 3–5 wild models at most. Contact is checked on step completion only, and models never enter doors, warps or 1-tile chokepoints (`no_npc`). Vertical sight lines are capped at 4 tiles, because only about 5 rows are visible above and below the player, and horizontal ones at 8. Every route gets one red-eyed **Route Alpha** at +3–5 levels.

### Design: the slice's spaces and pacing

| Space | Size (tiles) | Critical path | Target time |
|---|---|---|---|
| Professor lab (interior) | 16×12 | ~12 steps | 2–4 min, including the starter pick and Kip's tutorial battle |
| **Localhost** | 32×24 | ~16 steps from the lab door to the north exit | 1–3 min (home and Mom optional) |
| **Deprecated Forest** | 40×80 | ~130 steps | 12–25 min |
| **Patchwater** plaza | 24×16 | ~20 steps | 1–2 min |
| **Compile Hall** | Lobby + 3 rooms + arena, each 20×11 | — | 15–25 min |
| **Slice total** | | | **~45–75 min**, then the endless Arena |

Localhost (32×24, `#` tree, `B` building, `D` door, `S` sign, `~` water, `T` terminal kiosk, `X` the Route 404 barricade):

```
###############..###############   <- north exit (x15-16) to Deprecated Forest
#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#
#,,BBBBBBBB,,,,..,,,,,BBBBBB,,,#   Epoch's lab garage (x3-10)   Player home (x22-27)
#,,BBBBBBBB,,,,..,,,,,BBBBBB,,,#
#,,BBBDBBBB,,,,..,,,,,BBDBBB,,,#   lab door (6,7)               home door (24,7)
#,,,,,...................,,,,,,#   main street
#,,,,,,,,,,,,,,..,,S,,,,,,,,,,,#   "LOCALHOST - There's no place like 127.0.0.1"
#,,,,,,,,,,,,,,..,,,,,BBBBB,,,,#   neighbour ("beta tester") house: stealth tutorial NPC
#~~~~~~~~~,,,,,..........,,,,,,#   the Data Lake pond; hidden item at (1,20)
#,~~~~~~~,,,,,,..,,,,,,,,,,T,,,#   terminal kiosk = Model Hub
#,,,,,,,,,,,,,,XX,,,,,,,,,,,,,,#   "404: Road Not Found (coming in a future update)"
################################
```

| Deprecated Forest band (rows, south → north) | Content |
|---|---|
| y72–79 Trailhead | Sign "Deprecated Forest — Support ended." Optional **ghost kiosk** (first Arena fight). The aide explains distillation after the first wild battle |
| y60–71 First brush | Nullbeetle (wander) and Heisenmoth (skittish), Lv2–4, max 3 active. Cutscene: a grunt scraping a sleeping model flees north |
| y48–59 Switchbacks | Trainer "Bootcamp Grad" (mandatory pinch, sight 4) and "Retro Collector" (optional, gives a hint item). Ledge at y52 is a shortcut home. "Abandoned Repo" pocket ("Last commit: 7 years ago") guarded by **Alpha Cobolt** (L8, aggro, optional) |
| y36–47 The Sunset Server | Moss-covered server monolith with a heal bench and lore terminal. Fork west into legacy-cache brush (Off-By-Wasp, Stochastiparrot as `mimic`, Embeddingo as `idle_sleep`, Lv4–6; optional "Prompt Engineer" who teaches type matchups) or east over Stale Stream |
| y20–35 Team Scrape camp | Grunt A (mandatory story fight, sight 6) and Grunt B (optional patrol) with Scrapion and Nullbeetle. Scraped Slopling (aggro, Lv5–6). Free **Old v1.2** from a cage. Redirect-arrow tiles at the gate foreshadow the gym's GOTO Floor |
| y8–19 Model Graveyard (secret) | Entered behind a sunset-tinted tree at (15,22). Tombstones ("Here lies v0.3 — it tried its best"), a hidden Skill Scroll, rare **Hallucinat** (Lv7, idle_sleep, so stealth matters) |
| y0–7 North exit | To Patchwater: Retraining Center, Agent Gym vendor (locked until hybrid), the petitioner NPC, Compile Hall door |

### Design: the Compile Hall gym

The building is a lobby, three puzzle rooms and an arena, each 20×11. The lobby has a receptionist (SV-style registration), a guide NPC who answers every question with "Marked as duplicate," and **Dukk**, the rubber-duck hint statue, which gives one sentence per room and never the solution. Inputs are the D-pad plus A and B. B undoes one step, long-press B resets the room, and rooms are stateless on entry. Failure is funny and cheap: looping too long triggers "Stack overflow — respawning at line 1."

**Room 1, Boolean Gates** (teach). Solution sentence: *"Plates A and B open G1 (`A AND B`), but G2 needs `NOT A`, and the second A plate sits beyond G1."* Variables are global, so G1 closing behind you is fine. An optional trainer reveals the hint "Variables are global."

```
####################
#@.....#.......#...#
#..A...1...a...2..>#
#...B..#...t...#...#
#......#.......#...#
####################
```

**Room 2, Infinite Loop** (catch). Arrow tiles slide you until a wall or a `■` break tile. The IF arrow `?` points into a loop until switch `s`, below the loop, flips it.

```
####################
#@..→→→→→→→→↓......#
#...↑.......↓..■...#
#...↑←←←←←←←?→→→■.>#
#..........s.......#
####################
```

**Room 3, Debug the Bot** (combine). Bot "Linty" runs `MOVE 8 · TURN RIGHT · MOVE 2 · TURN LEFT · MOVE 5` from a wall terminal, and you may change one token. The off-by-one is `MOVE 2`, which should be `MOVE 3`. A second terminal has two plausible bugs but allows one edit, and only fixing the *earlier* line works ("fix the first error first"). The token editor is a list: up/down picks a line, left/right cycles its token. Touch users tap the line and tap the token.

**Arena: Leader Gary Rebase**, a senior dev in a 2009 conference shirt whose highest praise is "LGTM." His pre-battle "code review" is Gary and Dukk staring at you in silence. His team is Spaghettopus v2 as orchestrator (L10) with Vibrat and Agentoad as subagents (L9). The field effect **Compile Errors** penalizes any side that repeats the same command 3 turns running, and Unit Test punishes predictable decks, so the gym's lesson is "don't overfit." The badge is the **Green Build Badge**. Afterwards the gym posts "BENCHMARK SATURATED. Benchmark 2: Harder Edition, Coming Soon," and hard-mode replays with par steps unlock (puzzle concepts Packet Router, Regex Gate and Diff Patch Path).

### Design: the eight Benchmarks reconcile by type and puzzle verb

The world research gave one gym per type, and the levels research gave one puzzle verb per gym. Merging them puts each verb under its best-fit type. The "Agentic" verb goes to the Open gym, whose leader is ten forks arguing. "Safety" goes to Voice (deepfakes and injection). The "Efficiency" verb moves to the Datacenter Spire's Victory Road rooms.

| # | Benchmark | Leader | Teach → catch → combine (puzzle bank) | Badge |
|---|---|---|---|---|
| 1 | Code: **The Compile Hall** | Gary Rebase | Boolean Gates → Infinite Loop → Debug the Bot | Green Build |
| 2 | Speed: **Latency Lane** | Rhea Throughput | Learning-Rate Ice → Rate-Limit Corridor → both under one turn cap (turns, not seconds) | First Token |
| 3 | Memory: **Long Context Archive** | Archivist Mnemo (remembers beginnings and ends only) | Context Window Packing → Tokenizer Split → Cache Hit Doors / Stack Elevator | Recall |
| 4 | Search: **The Haystack** | Madame Citation | Needle maze → Binary Search Doors (a lying oracle in hard mode) → Attention Mirrors (query → key) | Needle |
| 5 | Voice: **The Uncanny Lounge** | DJ Val Uncanny | SYSTEM vs wooden signs → forged SYSTEM plaque → Jailbreak Riddle Guard plus deepfake doppelganger trainers | Waveform |
| 6 | Vision: **Select All Squares** | Iris Boundingbox | Hallucination Check → CAPTCHA Grid (does the pole count?) → Train/Test Split panel | Bounding Box |
| 7 | Open: **The Commons** | The Collective (ten forks) | Two bots in sequence → Race Condition (add WAIT) → Dependency Install plus Merge Conflict Bridge | Permissive (Some Restrictions Apply) |
| 8 | Reasoning: **The Exam Hall** | Proctor Targett | Truth-teller NPCs → Temperature Dice → shuffle the question order so his answer-key team crumbles | Saturated |
| — | Datacenter Spire rooms | — | Inbox/Outbox Sort → Garbage Collector → Compression Run (par-scored) | — |

### Design: Tiled conventions

Maps are one `.tmj` each. The tile layers are `ground` (with a `terrain` property), `ground_detail`, `walls` (`collides: true`, loaded through `setCollisionByProperty`, which takes a property map such as `{ collides: true }` ([Phaser API](https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.TilemapLayer-setCollisionByProperty))), `ledges` and `above_player`. The object layers are `spawns`, `warps`, `connections` (seamless edges), `npcs`, `trainers` (`sight`, `optional`, `rematch`), `wild_zones` (`table_id`, `max_active`, `behaviors`), `items` (`flag`), `triggers` (`requires_flag`), `signs` (`style` = `wood`/`terminal`/`SYSTEM`), `puzzle` (`kind`, `var`, `expr`, `dir`, `program_id`) and `camera` (`lock`). Movement is grid lookups, not arcade physics. Puzzle state lives in a per-room store reset on entry, and badges and flags live in the save. The `setCollisionByProperty` citation is to Phaser 3.80 docs, so Phaser 4 parity and Tiled's `class`/`type` naming must be checked before the schema is locked.

## Art reads as polished retro: 64-pixel battlers, a locked Endesga 32 palette and Phaser 4 light

### Evidence: classic budgets plus modern light

The most concrete published spec comes from Cassette Beasts' official monster guide: medium battlers fit **64×64**, frames run **100 ms**, idles are **6 frames** (8 for large monsters) with an `alt_idle` about a quarter of the time, windups are 6–8 frames and hurt is 3. Overworld sprites are about 50% scale and chibi. The guide also calls for a "very limited palette so monsters feel like a set," one level of shading, light from the top-right in battle, and coloured outlines ([Cassette Beasts wiki](https://wiki.cassettebeasts.com/wiki/Modding:Monster_Making_Guide_Part_1)). Sea of Stars reads as "a 90s RPG rendered in HD" because of coloured highlights, day/night and heavily animated environments, not more pixels ([Megavisions](https://megavisions.net/the-art-of-sea-of-stars-a-sea-of-pixels)). Phaser 4.0.0 shipped in April 2026. It brought a unified Filters system, a Lighting component, SpriteGPULayer ("a million sprites in a single draw call") and TilemapGPULayer (a whole layer as one quad), which is a large win on mobile ([GitHub release](https://github.com/phaserjs/phaser/releases/tag/v4.0.0); [Phaser Editor](https://editor.phaser.io/news/2026/05/phaser-3-vs-phaser-4)). It has **no `addBloom()` primitive**; bloom is composed from Threshold, Blur and an ADD blend, or `Phaser.Actions.AddEffectBloom`. Filters cost one draw per active filter and are WebGL-only ([Phaser filters skill doc](https://github.com/phaserjs/phaser/blob/master/skills/filters-and-postfx/SKILL.md)). PCT atlases are "typically 90–95% smaller" than JSON atlases ([Phaser Editor](https://editor.phaser.io/news/2026/05/phaser-3-vs-phaser-4)).

### Design: palette, shape language and spec sheet

The palette is locked to **Endesga 32**, a 32-colour palette with a built-in cyan/magenta/navy tech axis and warm earth ramps ([Lospec](https://lospec.com/palette-list/endesga-32)). Resurrect 64 is the fallback if 32 colours prove tight ([Lospec](https://lospec.com/palette-list/resurrect-64)). Aseprite runs in indexed mode, and only runtime VFX, glow and light may go off-palette. Each region gets a ramp that tells its story. The Deprecated Forest fades from autumn rust `#be4a2f #d77643 #e4a672` toward slate `#262b44 #3a4466 #5a6988 #8b9bb4 #c0cbdc` the deeper you go, so the forest is visibly "greying out." The Datacenter Spire uses navy-to-cyan `#181425 #124e89 #0099db #2ce8f5` with LED accents.

Type colours are Reasoning blue and cream `#124e89 #0099db #ead4aa`, Speed orange-yellow `#f77622 #feae34 #fee761` with `#e43b44`, and Open green `#3e8948 #63c74d` with a magenta fork accent `#b55088`. The other five are proposed here: Code terminal cyan `#2ce8f5` on navy `#262b44`, Vision violet `#68386c`, Voice pink-red `#f6757a #ff0044`, Search parchment `#ead4aa #c28569`, and Memory slate `#5a6988 #8b9bb4`. Types and statuses are always encoded with an icon as well as colour, for colour-blind players. The shape language is circle for friendly and careful (Sagelet), triangle and chevron for fast (Blitzr), and stacked modular cubes for forkable (Forkling). Every creature must read from its silhouette alone at 32 px, checked with a black-fill pass.

| Asset | Canvas | Frames |
|---|---|---|
| Player / NPC overworld | 16×32 (≈16×24 drawn) | 4 directions × 3-frame walk (9 unique, left mirrored), 120–150 ms |
| Following creature | 32×32 | idle 2, walk 2–4 per direction |
| Battle front | 64×64 (first stage fills ~40×40) | idle 4–6, alt_idle 4–6, windup 6, attack 4–8, hurt 3, faint 4–6 |
| Battle back | 64×64 | idle 2–4, subtle |
| Attack VFX | 32 or 64 sheets | 6–12 frames at 50–80 ms, additive, may go off-palette |
| Tiles | 16×16 | animated water, LED and fan tiles at 4 frames |
| UI 9-slice | 24×24, 8 px corners | dialogue, menu and info variants |
| Context-grid cells | 8×8 in the HUD mini-grid; enlarged in the editor | idle and selected |
| Icons / type badges / status chips | 16×16 / 32×12 / 20×8 | 1–2 |

The slice budget is about **400–650 unique tiles** plus 30–60 animated frames, packed into 256 or 512 px atlases. Seventeen species at ~30 battle frames each, plus starter evolution overlays, come to roughly 500–600 frames.

The starter concepts:

- **Sagelet** is a round owlet-monk in a hooded robe. It has bracket `{ }` spectacles and a thought-bubble crest, and three "…" dots orbit it in idle. Its attack lines the dots into a chain-of-thought beam, it flinches apologetically with a sweat drop when hurt, and its disclaimer scroll grows longer with each version.
- **Blitzr** is a forward-leaning lightning fox-hedgehog in a hoodie with rocket-sticker quills. Its idle is faster (70–80 ms) to read as hype, and its attack smear ends in a "+1000% FASTER" pop-text.
- **Forkling** is a stack of 3–4 rounded cubes with a git-fork tail. The blocks bob out of phase, and it splits into palette-shifted clones, so the fork move needs no new art.

### Design: battle UI that works in landscape and portrait

In landscape at 320×180, the enemy panel sits at (6,6) at 120×30, with an HP bar 64×4 and a context bar 64×3 beneath. The enemy sprite stands around (248,56), and the player's back sprite around (64,108). The player panel sits at (188,88) at 126×44, with HP 72×4 showing numeric HP, a context bar showing headroom used, and the 24×24 **temperature dial**. The dial has five notches labelled 0.0–2.0. Its needle sweeps from `#0099db` to `#e43b44` and gains a 1 px jitter and sparks when hot. The bottom 320×42 box splits into a prompt ("What will SAGELET do?") and a 2×2 command grid: **PROMPT** (moves), **TOOLS** (items), **AGENTS** (team), **LOG OFF** (run). Subagent intent icons float above their sprites. HP drains with a lagging white "ghost chunk." Text uses Daniel Linssen's **m5x7**, CC0 per its itch listing, for body text ([managore](https://managore.itch.io/m5x7)), and **m6x11**, free with attribution, for headers ([managore](https://managore.itch.io/m6x11)). Both are converted to BitmapFont, and dialogue is capped at 3 lines of 30–36 characters.

In **portrait handheld** mode, the 320×180 screen stays identical on top, integer-scaled by device pixels. A 390-CSS-px phone at DPR 3 gets 3×, which is 320 CSS px wide. Below it sits a DS-style second-screen band, also integer-scaled. That resolves a conflict between the art and progression research: 8 px grid cells inside the 320×180 frame would be only 8 CSS px on a phone, far below touch minimums. So **the Context Grid editor lives on the second-screen band at 6 columns of ~54 CSS px**, while the battle HUD shows only a read-only 8 px mini-grid. On desktop and landscape, the editor opens as an overlay with pointer precision and allows 7–8 columns. The D-pad and A/B buttons are drawn as pixel art, with hit areas enlarged beyond the art.

### Design: animation, juice, audio and pipeline

Polish comes from anticipation (windups), 1–2 px squash, smear frames, held impact poses of 150–250 ms, and 1-frame-offset secondary motion. Hit feedback is 2–4 frames of hit-stop, a 1–2 frame white flash (Phaser 4 replaces `setTintFill` with `setTint` plus `setTintMode`), and 2–4 px integer shake on crits only. Phaser 4 filters map onto the game's moments: a `Wipe` battle transition shaped like a loading bar, `ColorMatrix` plus `Displacement` for Hallucinating, `Displacement` heat shimmer in the Spire, `GradientMap` for Golden-weights variants, `Vignette` at low HP, and composed bloom on the VFX layer only. Filters stay object-local where possible, static ground goes on TilemapGPULayer, and ambient data motes go on SpriteGPULayer. Options toggles cover shake, flash and filters, reduced by default on low-end phones.

Audio is a "GBA-plus" hybrid: chip leads over warm bass, real drums and sidechained pads. The music carries satire, such as elevator-jazz chiptune in the Spire lobby and dial-up arpeggios in the swamp. **Furnace** (GPLv2+, Game Boy/NES/SNES and more) exports WAV **per channel** ([Furnace](https://tildearrow.org/furnace/)). That enables vertical layering: 3–4 synced stems crossfade on state. Low HP drops the lead and adds a tense arp, the last enemy creature adds a hype layer, and a near-full context window adds a bitcrushed layer. Victory and evolution use stingers on bar lines.

The pipeline runs Aseprite (one file per creature, Cassette Beasts' tag schema and export settings) → a CLI batch export in an npm script → atlases → Tiled → Phaser with Vite hot reload, plus an in-game "contact sheet" scene for animation QA. Steam's January 2026 disclosure update targets AI-generated content that "ships with your game, and is consumed by players," and exempts efficiency tools such as code assistants ([PC Gamer via mirror](https://hn.jakechampion.name/reader/https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes)). Gigazine reads it as also covering marketing assets ([Gigazine](https://gigazine.net/gsc_news/en/20260120-steam-updates-ai-disclosure-guidelines)). Hand-drawn creature sprites are therefore both a selling point and the simplest compliance path. The hybrid LLM compiler will count as **live-generated** content, which requires describing guardrails.

## Determinism makes ghosts, balance and the business cheap to run

### Design: engine architecture and tests

The battle engine is a standalone pure-TypeScript package with no Phaser imports. Its signature is `simulate(teams, decks, seed, commands) → result + log`, and the input log (seed, team hashes, per-round commands) is a complete replay. Golden-file tests require byte-identical logs across Node, browser and mobile WebView. A metamorphic test checks that swapping sides with a mirrored seed mirrors the outcome. Fuzzing random legal decks hunts crashes and infinite rounds.

The balance pipeline borrows Mega Crit's approach. Slay the Spire's team tracked each card's pick rate and how often it appeared in winning decks, grew from 3 graphs to more than 90, and held that "data finds patterns but intuition decides changes" ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)). A nightly CI round-robin pits about 20 archetype decks against each other (Speed rush, Reasoning charge-nuke, Open swarm, Code lock, Voice injection, Memory stall, Search anti-hallucination, mixed) at 1,000 seeds per pairing.

| Balance target | Starting value |
|---|---|
| Any archetype against the field | ≤ 55% win rate |
| Worst single matchup | No worse than 30/70 |
| Starter triangle | ~60/40, so skill can flip it (orchestrator only, no subagent) |
| Always-T0 vs always-T4 | Within ~5 points, or the dial is solved |
| Graft worth taking | ≥ 55% for the graft side vs the same team without it (spin-up is intended to be stronger) |
| Median fight length | 5–8 rounds |
| First-mover mirror | 50 ± 2% |

A hill-climbing search over 8-card decks hunts dominant strategies before players find them. Unit Test, Overfit, context costs, Prompt Injection (which turns a shallow "always strongest attack" deck against its own ally) and intent reveals are the built-in counters. Showdown's point that at volume "a one-in-a-million event happens every other day" ([Showdown RNG](https://pokemonshowdown.com/pages/rng)) justifies a one-tap "show the rolls" replay view, which turns RNG complaints into transparency.

### Design: Supabase ghosts with server re-simulation

A ghost upload stores the seed, ruleset and engine version, and the team, deck and grid JSON. Prompts are never stored. The server, for example a Supabase Edge Function running the same TS engine package, validates the team against the player's legal progression state (card counts, grid capacity, levels) and re-simulates reported results before accepting them. The server also rate-limits uploads, weights sampling so no single ghost dominates, version-tags and retires ghosts after patches, and ties each checkpoint to a team-power budget so "smurf ghosts" can't sit low. Telemetry logs every ghost battle's input log, which is cheap because it is replay-complete.

### Design: saves are local-first, versioned and replay-backed

The slice is a 45–75 minute playthrough on phones, where the OS kills background tabs, so saving is required from the first overworld build, not a full-game feature. The full arc (three acts, eight badges) only raises the stakes.

**What a save holds.** One JSON document, `SaveFile`:
- `schemaVersion` and `engineVersion`
- trainer name and id, play time, and settings (text speed, 1×/2×/4× battle speed, audio)
- `location`: map id, tile and facing
- `flags`: a set of story-flag ids, for example `intro.done`, `forest.grunt1.beaten` and `badge.code`
- the party:
  - the orchestrator, with species, version, level, XP, moves and grid layout
  - each subagent, with the same fields plus its deck, Generalization and trained temperature
- storage (the box), the Example Card inventory and items
- recorded ghost logs, which Specialist needs
- `suspendedBattle`, which is null outside a fight

Content is referenced by id only, like the engine's battle state.

**Mid-battle saves cost nothing.** `suspendedBattle` is the battle's `BattleLog` (seed, setup and the commands so far). Loading replays it to the exact same moment. If the stored `engineVersion` no longer matches after an update, the fight restarts from its setup with the same seed rather than replaying under new rules.

**When it saves.**
- Autosave fires on every map transition, after every battle and every round inside one, and when the page is hidden (`visibilitychange`), which is the moment mobile apps get killed.
- A manual Save in the menu is shown as a checkpoint gag: "Saving weights… do not unplug the GPU."
- One slot, plus the two previous autosaves kept as rolling backups, so a corrupted write never costs a run.

**Where it lives.**
- Web/PWA: IndexedDB, with `navigator.storage.persist()` requested. WebKit can clear storage for a site the player hasn't used in a while unless it is installed to the home screen, so the demo nudges an install and offers **Export save** and **Import save** as a file.
- Capacitor: the app's filesystem.
- Steam: a file in the user-data folder, synced by Steam Auto-Cloud.

**Versioning.** `schemaVersion` is an integer. Ordered migration functions upgrade older saves one step at a time and never rewrite fields in place. The tests load a fixture save from every past version.

**Cloud sync (optional).** A player who signs in gets the same document in a Supabase `saves` table: `user_id`, `slot`, `schema_version`, `updated_at` and a `jsonb` body, with owner-only row-level security. It is last-write-wins unless both copies changed since the last sync, in which case the player picks one from a side-by-side summary (badges, play time, party). Local saves are never trusted for competitive play: the ghost server already re-checks progression legality, so editing a save only cheats yourself.

### Design: platforms and monetization in the decided order

**Free web demo (PWA).** It launches *months* before a Next Fest, given the 2.5× finding. It ends with a trainer card, a Wishlist button, and locked "full release" buttons for routes and modes, as GMTK recommends ([GMTK](https://gmtk.substack.com/p/how-to-make-a-great-steam-next-fest)).

**Steam premium**, then **Capacitor mobile free-to-try with a one-time unlock**, then **cosmetics**: trainer-card frames, titles, ghost badges, and Golden-weights palette variants that drop in play. Cosmetics are never sold as power and never sold through paid rerolls. The premium model is what lets the daily and weekly hooks exist for habit and sharing rather than spending. One cost the hybrid mode adds is LLM API spend per compile; how to fund it is an open question below.

## Build the slice in fourteen ordered steps, then clear the legal gates

The ordering follows FF12's warning that you can't tell whether a gambit system works "from the start." The simulator comes first, and the art budget is spent only after the greybox slice is fun on a real phone.

| Priority | Milestone | Exit criterion |
|---|---|---|
| 1 | Pure-TS engine core: types, damage, RNG discipline, context tokens, Drift, Compact, /clear, 8 statuses | Golden-file determinism passes on Node and browser |
| 2 | Card grammar, deck evaluator, intent preview, "why" trace, G formula and Eval Suite | Broken-deck tutorial is solvable; trace explains every action |
| 3 | Headless sim harness and archetype decks; tune the grid rule, headroom floor, triangle, temperature and graft/spin-up | Balance targets met within tolerance on slice content |
| 4 | Phaser 4 + Vite shell: integer scaling, portrait two-band layout, desktop layout, D-pad/A/B plus touch, BitmapFonts | Crisp on 3 real phones and a desktop |
| 5 | Greybox battle scene and second-screen grid editor (drag with ghost preview, tap to rotate, long-press info) | Five testers complete a packing decision unaided |
| 6 | Overworld: Tiled loader, grid movement, warps, edges, trainer sight, visible wild behaviours; local saves (autosave, backups, migrations, mid-battle resume) | Walk the lab to the forest with no softlocks; kill the app mid-route or mid-battle and resume exactly there |
| 7 | Greybox maps: lab, Localhost, Deprecated Forest, Patchwater, Compile Hall rooms with puzzle entities | 45–75 minute playthrough; every puzzle room is solvable and resets |
| 8 | Distillation (graft/spin-up, Clean), XP curve, grid expansion, v2 evolution, Record Example, Dry Run | First distill arrives by 4:00; first expansion at L4 |
| 9 | Slice content data: 17 species, Kip, 3 forest trainers, 2 grunts, 2 gym trainers, Gary Rebase | All fights 5–8 rounds in sims |
| 10 | Writing pass and laugh log: cold open, NPC lines, Team Scrape, the Old v1.2 beat | Every kept joke got a laugh from at least 2 of 5 testers |
| 11 | Art: palette lock, starter lines (v1/v2 full, v3.5 as overlay), 14 species, ~500 tiles, UI 9-slices, VFX | Silhouette test passes; contact-sheet QA |
| 12 | Audio: Furnace stems, battle vertical layers, SFX set | Layers swap on HP, last-enemy and context state |
| 13 | Supabase ghosts: upload, re-simulation validation, seed ghosts, trailhead kiosk, post-gym Arena; optional cloud save sync | A tampered result is rejected; empty buckets fall back to seed ghosts; a save moves between phone and desktop |
| 14 | Shareables, funnel telemetry, PWA deploy, Steam page | KPI dashboard live; demo shipped months ahead of a Next Fest |

### Open questions to settle in playtest or simulation

| Question | Why it matters | How to resolve |
|---|---|---|
| Is the 4-cell headroom floor at L1 fun or punishing? | Sets early-game feel | Sims plus the first 10 phone playtests; fallback is the off-grid scratchpad |
| Keep the G-band follow roll in ranked ghosts? | Fairness perception vs "misgeneralization" flavour | A/B in ghost pools |
| One orchestrator for life, or swappable orchestrators? | The decided starter fiction vs collection breadth | Ship a single orchestrator in the slice; test unlockable orchestrators in a Fine-Tune roguelite mode |
| How many ghosts per bucket feel "fresh" at low player counts? | No public data exists | Instrument pool size against "came back to see results" rate |
| How are hybrid LLM compiles funded (included per day, bring-your-own key, or paid)? | API cost vs the no-dark-patterns stance | Cost model before the hybrid milestone |
| Premium price point and demo-to-full content split | Not researched | Comparable-title pricing study before the Steam page |
| Working title | Not decided; "Latentia" is the region name | Trademark search on shortlisted titles |

### Legal and IP checks before commercial launch

| Risk | Status in the research | Action |
|---|---|---|
| Monster-capture patents | Nintendo's case against Palworld is a *patent* suit over "ball-throwing creature capture" and riding. It was narrowed in Nov 2025, and a decision was expected Nov 9, 2026 ([Patent Arcade](https://www.patentarcade.com/?p=7128)) | Keep distillation (beat, then compress, no thrown object) and no creature riding. Re-check the ruling. Get a clearance review |
| Parody and trademark use | The Rogers test protects marks in expressive works unless they lack artistic relevance or explicitly mislead ([Fish & Richardson](https://www.fr.com/news-insights/articles/the-first-amendment-again-protects-video-games-as-expressive-works/)). Jack Daniel's v. VIP (2023) reportedly narrowed this for source-identifying use, but that was not verified | No real lab, model, product or person names in game text, sprites or store pages, even as puns |
| Watch-list terms | "Pro Max," "Hype Cycle," "Transformer(s)," "Cloud City" (unverified) | Use "Max Preview" and "Hype Train"; avoid the others; search every version-suffix combination |
| Creature names | Not searched. Hallucinat, Glazzle, Wrapperoo and Agentoad read like plausible startup names | USPTO, EUIPO and app-store searches on all 41 names |
| Pokémon look and feel | — | No Pokémon names, ball imagery, Team Rocket motto structure or type-chart art. Run an originality pass on sprites against Pokémon, Digimon, Coromon and Cassette Beasts |
| Sensitive real events | The retired-model story involves wrongful-death suits ([Engadget](https://www.engadget.com/ai/openai-has-officially-retired-the-controversial-gpt-4o-model-181553067.html?src=rss)) | Keep deprecation whimsical; no companion-grief or self-harm framing |
| AI disclosure | Steam requires disclosure for player-facing AI content and live generation ([PC Gamer via mirror](https://hn.jakechampion.name/reader/https://www.pcgamer.com/software/ai/steam-updates-ai-disclosure-form-to-specify-that-its-focused-on-ai-generated-content-that-is-consumed-by-players-not-efficiency-tools-used-behind-the-scenes)) | Hand-made art; disclose the hybrid compiler as live-generated with guardrails; confirm on the Steamworks form itself |
| Fonts and tools | m5x7 is listed CC0; m6x11 requires attribution; Furnace is GPLv2+ | Credit Linssen; confirm Furnace's licence has no effect on exported songs; read every placeholder asset pack's licence and replace before ship |

## Conclusion

The most important design decision here is not a single mechanic but the rule tying them together. Grid cells are one currency, spent three ways: loadout power, training data for subagents, and room to think in battle. That turns the AI satire into tradeoffs players live through. Players don't learn that few-shot examples eat context, that delegation preserves the orchestrator, or that a deck tuned to one opponent fails on new ones from a joke. They learn it from losing, recording an example and winning the rematch. The same principle disciplines the comedy: the strongest gags (Glazed buffing your enemy, saturated benchmarks, Brittle subagents repeating themselves) work because they are mechanics, which is the High on Life lesson turned around.

The second implication is about order of operations. The riskiest unknowns are all numerical: headroom at L1, the temperature dial's balance, graft versus spin-up, ghost-pool freshness. Every one of them can be answered by a headless deterministic simulator before a single sprite is drawn. The same integer engine later validates ghosts on the server and keeps the LLM hybrid honest, because the model only ever outputs cards the simulator already knows how to judge. Build the simulator first. The slice, the ghosts and the hybrid all depend on it.
