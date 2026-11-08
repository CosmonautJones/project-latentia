# Phase B rulings (normative addendum to the battle engine spec)

These are the controller rulings recorded while Phase B of the battle engine was built (tasks B1–B6 and the Checkpoint B review). They continue the numbering of `phase-a-rulings.md` and have the same status: **normative amendments** to `docs/superpowers/specs/2026-11-07-battle-engine-design.md`. Where a ruling and the spec disagree, the ruling wins. A later ruling amends an earlier one where it says so: for example, Ruling 91 amends 74, 96 amends 87, 97 amends 39, and 106 amends 104. Ruling 97 records Travis's own design decision. Each ruling is reproduced verbatim from the build ledger and grouped by the task it governs. "Cost if wrong" is the controller's estimate of the price of a wrong call.

## Task B1 — card model, conditions and selectors

- Ruling 81: recordedFoes / Robust match `state.sides[user.side].opponentId` (the opponent the side faces), same id Specialist uses — confirms B1's reading of Ruling 80 — cost if wrong: none.
- Ruling 82 (carry to B2): getIntents peek calls viewFor(..., round = state.round + 1); deck validation shape-checks decks and requires subject 'self' for turn, cooldown, allyHp and coin conditions; spec §4 units table gains cards→rng at the Checkpoint B docs pass.
- Ruling 83 (B2 applies): `orchestratorTarget` = the allied orchestrator's last RESOLVED action target only if it is a living on-field foe, else null (the card then traces conditionFalse); no command-time override (remove the view.ts comment) — keeps previews stable — cost if wrong: one selector.
- Ruling 84 (B2 applies): `cooldown` and `foeLastMove` read moveHistory (executed moves) — documented; the view also carries `lastMoveId` (what the creature chose) and its pending cost modifiers so plan-time usability matches resolution (Overfit, costSet/costAdd).
- Ruling 85 (B2 applies): viewFor's `round` parameter becomes required; resolveTarget checks every selector's pick is a living on-field member of the view (incl. orchestratorTarget); a re-plan at resolution keeps the intent's plan-time randomFoe pick if that creature is still a legal target, else re-resolves with the current view.

## Task B2 — deck evaluation, obedience and traces

- Ruling 86: the Default card fires regardless of its condition and may overflow, but NOT if a status disables its move: then the creature uses its first usable move at that move's default selector (same as the no-deck default intent) and the trace marks Default `moveDisabled` — statuses must bind — cost if wrong: one fallback path.
- Ruling 87: accept — Brittle repeat counts non-Default cards (incl. inactive), not after a disobeyed card; obedience rolled only for non-Default cards, once per action; getIntents/IntentsPlanned list subagents only until B4; no-legal-target card traces conditionFalse; planEntries moved to plan.ts and golden builders to builders.ts — cost if wrong: small.
- Ruling 88: Brittle repeat follows Ruling 86 too: if status disables the repeat move, fall back to the first usable move at its default selector (trace moveDisabled) — cost if wrong: small.
- Ruling 89: accept the intent property checking the round's FIRST action when it is deck-driven (later actions may legitimately re-plan); a disabled Default keeps firedCardId=Default with Default also listed moveDisabled — cost if wrong: test strength only.

## Task B3 — Directive, Policy Update, Headless Mode, Specialist

- Ruling 90: accept B3 choices 1–5 (Directive to a charging subagent → actorSkipped; a directed move disabled by the time the subagent acts → its own action stands; policies stack newest-on-top, re-issued id replaces, id clash with an allied deck card → invalidCommand, unknown move → moveDisabled; subagents planned before a policy resolves re-evaluate from the top; card injection used only when that card's own move runs). Change 6: levers keep the fixed 2-cell cost (they are levers, not attack moves) but emit MoveUsed with moveId 'directive' / 'policy-update' and the lever's target so replays and the UI can show them — cost if wrong: hash churn.
- Ruling 91 (amends 74): intents (getIntents and IntentsPlanned) are NEVER altered by levers — they show each subagent's deck intent; a Directive's preview is the command itself (client-side). The last sentence of Ruling 74 is superseded. Spec §5 "Orchestrator levers" / Round step 2 updated at the Checkpoint B docs pass — cost if wrong: none.
- Ruling 92: `replanned` has one meaning on both paths — the resolved action differs from the planned intent for any reason other than obedience — cost if wrong: none (not hashed).

## Task B4 — Autopilot decks

- Ruling 93 (B4): an Autopilot orchestrator evaluates its whole Autopilot deck (≤ 12 cards; no grid active-card cap, no Policy Update cards — policies are for subagents) with its own view, then Default; it always obeys (no obedience roll, no Brittle repeat: obedience/Generalization are subagent training) and is re-validated at resolution exactly like a subagent deck (dead/illegal target re-plans; status-disabled Default → Ruling 86 fallback); card injection preference applies — cost if wrong: one option flag.
- Ruling 94 (B4): Autopilot drives a side only when that round's RoundCommand has no entry for it; a present SideCommand wins for that round (and is logged). Headless or charging orchestrators behave as now. A side with neither command nor autopilot keeps the default intent. Autopilot cards name moves only — no levers/Swap in B4 (archetypes that need Swap revisit in Phase C) — cost if wrong: trainers can't swap yet.
- Ruling 95 (B4): `simulate(…, { kind: 'autopilot' })` submits `{}` every round (log.rounds is `{}` per round; sides lacking autopilot config use their default intents, no error); SimulateError `autopilotUnavailable` is removed. A 13-card Autopilot deck fails setup validation with the same code subagent deck-size errors use (add `deckSize` if none exists); Autopilot decks get the same shape/content validation as subagent decks.
- Ruling 96 (B4, amends 87): getIntents and IntentsPlanned now also list each Autopilot-driven orchestrator's intent (canonical order, cardId set); getIntents assumes no command next round. Player-commanded orchestrators stay unlisted. Goldens that change list each file and reason — cost if wrong: hash churn only.
- Ruling 98: accept the 12-card Autopilot cap as excluding Default (12 + Default legal; 13 → `deckSize`), provided subagent deck limits count the same way (reviewer to confirm) — cost if wrong: one off-by-one.
- Ruling 99: the bible's per-version Autopilot sizes (6/8/10/12) are a content rule for trainer/ghost data (Phase C archetypes, game client legality check), not an engine validation — engine enforces only the spec's flat 12 — cost if wrong: one validator later.
- Ruling 100: deck-driven perf (1.357 ms golden both-autopilot; 4.278 ms on fuzz setups at ~21 rounds) is B6's gate; B6 scope gains profiling + optimisation of the per-round deck path (viewFor/evaluateDeck) with determinism unchanged, measured on a fixed deck-driven bench set of realistic slice setups (not fuzz setups, whose fight length is unconstrained) — cost if wrong: a perf task before Checkpoint B.
- Ruling 101 (B4 minor 1): an Autopilot-driven round plays at the side's configured autopilot.temperature (restored at round start whenever Autopilot drives the side); a SideCommand's temperature applies only to commanded rounds — matches the brief's "at the configured temperature" — cost if wrong: mixed-play temperature only.
- Ruling 102 (B4 minors): batch into follow-up task B4.5 with Ruling 97 (Handoff): explicit orchestrator "autopilot-driven" marker instead of cardId inference (m3); export one orchestrator-moveset helper used by validate-setup and test arbitraries (m4); invariants timeout 60_000 → 20_000 (m5); split intents/getIntents out of plan.ts (m6). Minor 2 (golden for disabled-Default trace) → B6 golden coverage. Minor 7 → Checkpoint B docs pass. Minor 8 (subagent decks have no total-length cap; untrusted ghost decks evaluated in full) → parked for bible milestone 13 ghost validation (server-side legality caps); revisit at Checkpoint B review — cost if wrong: perf/abuse surface for uploaded ghosts.

## Task B4.5 — Handoff rescale (Travis's decision) and B4 follow-ups

- Ruling 97 (amends 39; Travis's call 2026-11-08, option 3): Handoff — the first hit on a target by a side this round takes no modifier; each later consecutive allied hit takes 10000 + 1500 × min(prior, 2): 11500 for the 2nd, 13000 for the 3rd (the +30% cap is reached by a full three-actor chain; 4th+ stays 13000). Applied as a small follow-up task after B4's review (handoff.ts + tests + golden re-record), not concurrently with B4 — cost if wrong: one constant, hash churn.

## Task B5 — Generalization and the Deprecated Forest Eval Suite

- Ruling 103 (B5): C, R and the pair count use only the deck's ACTIVE non-Default cards — the first min(activeSlots, cards.length) — since inactive cards never act and counting them would let padding inflate Coverage. H evaluates each scenario with evaluateDeck(deck, scenario.view, activeSlots, { band: 'stable' }), with no d1 (the obeying choice) and no policies. A non-Default card "fires" when the Evaluation's cardId ≠ deck.default.id and it is not a fallback. Cost if wrong: G values for oversized decks only.
- Ruling 104 (B5): the wasteful check reads the fired card's move effect primitives and its resolved target in the scenario view, never move-id lists:
    - healAtFull: the move heals and its heal target has hp == maxHp.
    - buffAtMax: every stat stage the move raises on its target is already +3.
    - cureWithoutStatus: the move cures and its target holds none of the statuses it cures.
    - compactWhenEmpty: the move removes Drift or junk and the actor has neither (as far as the view shows: Drift via statuses, junk via contextUsed or the view's junk field).
    A scenario lists which rules apply to it. If a rule needs a view field the view lacks, add it additively and say so (this changes no hash unless it alters a hashed event).
- Ruling 105 (B5): the 12 Deprecated Forest scenarios are plain data: frozen BattleView literals or a tiny deterministic typed builder run at module load, with no rng and no battle. Requirements:
    - forest-flavoured content (slice species/types);
    - together they exercise every condition category;
    - at least one trap scenario per wasteful rule.
    "Seen" scenarios are UI and out of scope. Export computeGeneralization, its types and DEPRECATED_FOREST_SUITE from index.ts. round_half_up uses exact integer rationals through src/math helpers.
- Ruling 106 (B5 concern 1, amends Ruling 104): a fired action is wasteful only if the whole action achieves nothing in the scenario view: the move deals no damage, and every one of its effects is a no-op there, judged by what that effect would actually change. A move that also deals damage, inflicts a status, starts a field, or has any effect that does something is never wasteful. Examples:
    - Hotfix at full HP with a curable status present is not wasteful.
    - Search attacks are never wasteful.
    - Compact is wasteful only when there is nothing it would remove. That includes ordinary context if the Compact primitive frees it.
    - Earnest Apology and Refactor are judged the same way.
    The four rule kinds stay as the labels for which no-op made an action wasteful. Cost if wrong: H for mixed-effect moves.
- Ruling 107 (B5 concern 3): caller mistakes in computeGeneralization (activeSlots outside 0..8 or non-integer; a suite without exactly 12 scenarios; a malformed deck) throw a typed `GeneralizationError` with a `code`, following the SetupError/CommandError style, not EngineInvariantError. Concern 2 (C = 0 at activeSlots 0) and concern 4 (base effects only, no Wild variants) are accepted.

## Task B6 — training scenarios, coverage and the deck-driven benchmark

- Ruling 108 (B6): the criterion-5 broken-deck test.
    - Both arms are identical except the order of the heal and attack cards in the player subagent's deck.
    - The player side's orchestrator runs a fixed simple Autopilot deck, the same in both arms, so no scripted commands are needed. The forest trainer side uses its Autopilot deck.
    - Threshold: broken ≤ 20/200 wins, swapped ≥ 180/200, over the seeds derived by the existing deterministic seed helper.
    - Fixture levels or placeholder stats may be tuned only as the brief allows; every tuned value gets a comment and the goldens are re-recorded.
- Ruling 109 (B6): the deck-driven bench set is fixed, realistic slice content: about 8 setups (starters vs the forest trainers, grunts, the gym trainer; Autopilot decks of 6–10 cards; subagent decks of 4–8 cards), each run over a fixed seed list, both sides `{ kind: 'autopilot' }`. Fuzz setups are not used for the gate. The gate is a mean ≤ 1.2 ms per battle, and the player-commanded bench is reported alongside.
    - Optimise only after profiling (node --cpu-prof), and report the top hotspots before and after.
    - Optimisations must not change any golden hash. Any change to emitted events is out of scope.
- Ruling 110 (B6, carried minors): add
    - one high-damage 3-hit Handoff chain golden that pins 11500 and 13000 (B4.5 m1);
    - a golden where a status disables a deck's Default (B4 m2);
    - a test that getIntents is unaffected by a restored Autopilot temperature (B4.5 m4).
    "Golden coverage includes every move and every lever" is pinned by a test that collects every MoveUsed moveId (plus the lever ids directive, policy-update, swap, none) across all golden logs and asserts it covers the full move registry.
- Ruling 111 (B5 minors carried into B6, wasteful.ts):
    - m1: a `tokens clear` effect is a no-op only when contextUsed == 0 and the creature holds no Drift.
    - m2: a token op is never provably idle while the actor's pendingCost is non-empty.
    - m3: pin the power === null guard with a test.
    m4 (G computed on decks that validateSetup would reject) is parked for sub-project 5 upload validation. m5 and m6 are cosmetic and parked.
- Ruling 112 (B6 concern 1): the "every move" golden coverage is satisfied by an exact, verified list of the 18 launch moves that no slice species knows. Each of those moves has engine unit tests. Making them reachable is a content decision for milestone 9 and Phase C (learnsets and TMs) — cost if wrong: none to the engine.
- Ruling 113 (B6 concern 2): Prompt Injected cannot be reached in a legal slice battle, because no slice species knows Deepfake Call. The direct-application scenario test is accepted for the engine. This is flagged to Travis as a slice content gap, since the bible's signature counter-play depends on it, and is carried to Phase C archetypes and content. Concerns 3 (bench headroom on CI) and 4 (a fragile low-level criterion-5 fight) are recorded for the Checkpoint B review.

## Task B6 fix round

- Ruling 114 (amends 108): the subagent's generalization is ratified as a criterion-5 fixture parameter. A tutorial subagent can come pre-trained, and Robust removes obedience noise, which is not what criterion 5 measures. Conditions:
    - Comment it in fixtures.ts as a tuned value, with its counterfactuals (50 and 65 → 177/200). Comment the player's temperature and the heal condition the same way.
    - Compute the deck's honest G with computeGeneralization(deck, DEPRECATED_FOREST_SUITE, activeSlots) and pin it in a test.
    - If the honest G is ≥ 70, use it in place of 80. If it is lower, keep 80 and state the gap in the comment.
    - Record the fixture's fragility (Sagelet +1 level → 154 broken wins) as a known re-tune point in the test-file header.
    Cost if wrong: criterion 5 reads "card order decides the fight for a well-trained subagent", not for any subagent.
- Ruling 115 (B6 minors, same fix round):
    - m2: clonePlain's doc says it gives the JSON round-trip result, not structuredClone's.
    - m3: one-line header note on canonical.ts's bounded module caches.
    - m4: swap lever coverage requires a Swapped event.
    - m1: covered by Ruling 114.
    - m5 and m6: accepted; CI bench ran at 0.672 ms deck-driven on GitHub.

## Checkpoint B review

- Ruling 116 (CB Important 1): Specialist counts only the deck's ACTIVE non-Default cards for the ≥ 50% recordedFrom test (consistent with Ruling 103), so inactive padding unlocks nothing. Cost if wrong: Specialist is harder to earn with oversized decks.
- Ruling 117 (CB Important 2): a subagent deck holds at most 12 non-Default cards, the same rule as Autopilot (Ruling 98); 13 or more → `deckSize`. This bounds trace and event size and the Brittle mostRepresented cost. Travis may change the number. Cost if wrong: one constant.
- Ruling 118 (CB Important 3): setup validation rejects fields the engine ignores on an orchestrator: `deck`, `generalization`, `trainedTemperature` and `recordedFoes` → code `orchestratorField`. AI orchestrators use `side.autopilot`. The test that pins the old behaviour is updated. Cost if wrong: one validation branch.
- Ruling 119 (CB minors), fixed now (before the 0.3.0 bump):
    - m1: remove `replanned` from the public Intent type (it stays internal on the entry; CardTrace shows the fired card).
    - m2: ValidationError.code becomes a string-literal union of every code.
    - m3: export the content catalogs (moves, species, types and statuses read-only), the editor constants (condition categories, target selectors, MAX_AUTOPILOT_CARDS, the new MAX_DECK_CARDS), bandFor and BAND_MIN, and a CardTrace type alias.
    - m4: document on getIntents that it returns both sides' intents, and that the client hides foe intents unless revealed (Red Team, Saliency Map, Socratic Method).
    - m6: the fuzz and property arbitraries generate stacked distinct Policy Update ids.
    - m7: computeGeneralization rejects unknown move ids with code `deck`.
    - m9: fix the trained-subagents golden comment.
    Carried:
    - m5 (an unmarked hallucination or Drift substitution after a CardTrace) → sub-project 2 client: the client compares MoveUsed against the fired card.
    - m8 (bench at archetype fight lengths) → Phase C, re-measured against criterion 7.
    - m10 (Rulings 114–119 in the docs) → the controller's docs pass.
    - The triage table's other verdicts are accepted as written.
