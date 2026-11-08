# Phase A rulings (normative addendum to the battle engine spec)

These are the controller rulings recorded while Phase A of the battle engine was built (tasks A1–A15 and the Checkpoint A review). They are **normative amendments** to `docs/superpowers/specs/2026-11-07-battle-engine-design.md` (Revision 3.1): where a ruling and the spec disagree, the ruling wins, and a later ruling amends an earlier one where it says so (for example Ruling 59 amends 58, Ruling 75 reverses 29, Ruling 74 amends spec §5 "Orchestrator levers"). Each ruling is reproduced verbatim from the build ledger, numbered as there, and grouped by the task during which it was made; "carry to X" marks a ruling made in one task for a later task to implement. The trailing "cost if wrong" notes the controller's estimate of the price of a wrong call.

## Pre-flight scan

- Ruling 1: Move A12a's "Tool step raises a heal by 10%" test to A12b — heal is built in A12b — cost if wrong: none (test still exists).
- Ruling 2: Branch phase-a-engine-core already exists and is checked out; A1 skips Step 1 — cost if wrong: none.
- Ruling 3: A1's .gitignore includes `.superpowers/` (controller scratch) plus node_modules, dist, coverage, reports/*.csv not ignored — cost if wrong: trivial.
- Ruling 4: If no GitHub remote exists at A15, verify locally (Node + Chrome) and defer CI chromium/webkit hash confirmation to the first push; Checkpoint A cannot close until CI has run — cost if wrong: a WebKit divergence found later.
- Ruling 5: One todo per phase (not per task); the ledger is the per-task record — cost if wrong: less granular UI progress.

## Task A1: Workspace, lint rules and CI

- Ruling 6: CI installs Playwright via `pnpm --filter @latentia/engine exec playwright install --with-deps <browser>` instead of root npx — npx can fetch a different Playwright than the workspace pins — cost if wrong: none.

## Task A2: Math — basis points, stats, damage, accuracy, crit

- Ruling 7: Robust +5 accuracy is added inside the 30–100 clamp (part of the clamped sum) — spec §5 lists it with the accuracy formula; matches bible "+5% accuracy vs unseen foes" — cost if wrong: ±3 accuracy at the floor edge only.

## Task A6: Content — effect primitives, moves and slice species

- Ruling 8: `wild` is a full replacement effect list used at T3+ and `wildT4` replaces it at T4 (not additive riders) — additive riders cannot express "up to 6 hits"/power multipliers without new kinds; resolution (A12a) must pick effects = T4&&wildT4 ? wildT4 : T>=3&&wild ? wild : effects — cost if wrong: content restructure of ~10 moves.
- Ruling 9: Early Exit's swap-out (encoded as reorder 'fieldSlot') is resolved by A12b's applySwap path at priority +3 — carry into A12b dispatch — cost if wrong: one primitive rename.
- Ruling 10: Every Search-type move with damage/multiHit gets a trailing `cure hallucinating` on its target, pinned by an integrity test — bible status table — cost if wrong: Search slightly stronger.
- Ruling 11: `nextActionModifier skip` gains explicit `scope: 'orchestratorCommand'` (no-op for subagents) used by /clear — spec §5 Context — cost if wrong: one param.
- Ruling 12: `SpeciesDef.passive` becomes `passives: Passive[]`; triggers documented: `battleStart` (at createBattle; a priority modifier is consumed at that creature's first Sort), `afterFirstAction` (fires after the creature's first action resolves, sees that action's dealt damage, procs read that round's r2hi), `roundEnd`, `statusIncoming`, `notKoThisRound`. Blitzr = battleStart priority +1 + afterFirstAction 15% recoil 10% of dealt — cost if wrong: trigger rename.
- Ruling 13 (carry to A12a): a miss skips the move's entire effect list (context cost still paid); `charge` pays cost on the charge round and rolls accuracy on release — cost if wrong: Weights Dump/Early Exit edge behaviour.
- Ruling 14 (carry to A12a): Refusal's `powerBp` penalty is applied as the step-4 `refusalOrApology` damage modifier, not as step-1 power — spec §5 order — cost if wrong: hash churn only.

## Task A8: Context — tokens, overflow, forced compaction, Compact and /clear

- Ruling 15: context functions never emit StageChanged; `compact` returns `{ events, summarizedBuffs: {stat, stages}[] }` and the battle unit emits accurate StageChanged — context doesn't own stages — cost if wrong: none.
- Ruling 16: rename DriftChanged.driftBp → `drift` (stack count) now, before any golden hash exists — later rename would churn every hash — cost if wrong: none.
- Ruling 17: removals keep using ContextAdded with negative `tokens`; kinds 'cleared'/'recovered' exported as constants; documented convention (spec event list has no removal event) — cost if wrong: one event rename later.
- Ruling 18 (carry to A12a): the battle unit emits ObservationGained alongside addObservation, and applies StageChanged for summarizedBuffs.

## Task A9: Statuses and guards

- Ruling 19: Prompt Injected is never ticked; `consumeInjection(h, round)` removes it (emits StatusExpired) and returns the stored choice when the victim's next action actually resolves; a skipped action (Rate Limited, cleared, charging) does NOT consume it; fainting/benching clears it (A12a/A12b) — bible "1 action" — cost if wrong: injection lingers one extra round in edge cases.
- Ruling 20: applyStatus stores a copy of the instance and asserts remaining is a positive safe integer (except Drift, which throws anyway) — shared-reference mutation risk — cost if wrong: none.
- Ruling 21 (carry to A12a/A12b): the resolver refreshes Overfit's `source` to the last target hit; Deprecated ending is announced by the caller's Swapped/Fainted event.

## Task A10: Battle setup, state, log types and canonical order

- Ruling 22: single source for removed slots = the orchestrator's ContextState.removedSlots (written by forceTokens); drop SideState.removedSlots — avoids drift — cost if wrong: none.
- Ruling 23: BattleState stores `seed: SeedHex` so EngineInvariantError can carry it — cost if wrong: none.
- Ruling 24: an orchestrator with grid === null (wild model) uses its species Ctx as its window — spec only defines headroom for gridded orchestrators — cost if wrong: wild-battle balance only.
- Ruling 25: SideState gains `slots: { pieceId: string | null; occupant: number | null }[]` (length 2, indexed by activeSlot). Gridded side: each active subagent binds to the subagentSlot piece whose `subagentId` equals its id; validate code `slotBinding` (missing/duplicate/unknown binding, or more actives than slot pieces). Gridless side: pieceId null. A slot is removed iff its pieceId is in the orchestrator's ContextState.removedSlots (single source, Ruling 22); auto-fill skips removed slots; occupant updates on Swap/force-bench (A11/A12b) — cost if wrong: one field rename.
- Ruling 26: a gridded orchestrator's moveset is derived from the grid: System Prompt signature, then Skill and graft `moveId`s in pieces order; setup `moves` must be [] for a gridded orchestrator (code `movesFromGrid`); Skill moveIds must be known by its species, graft moveIds must be some species' signature (code `moveNotKnown`) — cost if wrong: setup format change.
- Ruling 27: universal moves are never listed: stored moves = listed/derived moves then universals in fixed order [compact, /clear, guardrail]; listing a universal → `universalListed`; duplicates → `duplicateMove`; >4 non-universal moves for a subagent → `moveCount`. Directive/Policy Update stay command levers (not in moves) — cost if wrong: D4 modulus changes.
- Ruling 28: also in this fix (load-bearing for A12b/B2): reject duplicate creature ids (`duplicateId`); validate generalization integer 0..100 and trainedTemperature 0..4 (`range`); invariants add fainted⇔hp==0, one orchestrator per side, unique activeSlot per side, slot agrees with activeSlot/benchOrder — cost if wrong: none.
- Ruling 29 (carry to A14): validateSetup assumes well-formed input; A14 must shape-check logs and return ReplayError before calling it.
- Ruling 30: accept A10 fixer's calls — >2 slot pieces → slotBinding; grid move ids validated like listed moves; autopilot.temperature range-checked; gridded slot with pieceId null is never filled — cost if wrong: none.

## Task A11: Turn order and round skeleton

- Ruling 31 (A11): each round has one action entry per on-field position: the orchestrator always (a fainted orchestrator's entry is a Headless skip that still consumes 6 draws) plus each slot that is not removed and has an occupant alive at plan time. Bench creatures never get entries. R1/R2 are drawn for every creature in canonical order, alive or not — spec §5 — cost if wrong: hash churn.
- Ruling 32: win check runs after EVERY resolved action and again at end of round; when a side is wiped mid-round, stop resolving the remaining entries (they consume no further draws), skip auto-fill, emit RoundEnd then exactly one BattleEnd. Round-cap ends also emit RoundEnd then BattleEnd. Both sides wiped by the same action → draw — spec §5 "A side loses when every creature on it is KO'd. Both sides KO'd in the same action → draw." — cost if wrong: hash churn.
- Ruling 33: add CommandError code `invalidCommand` for a SideCommand temperature outside 0..4 or a malformed action — cost if wrong: none.
- Ruling 34: ActionEntry carries the full command: `lever?: Exclude<OrchestratorAction, {kind:'move'}>` (whole object) and move entries carry `injection?` — A12b/B3 need them without restructuring — cost if wrong: none.
- Ruling 35: a legal target is ON THE FIELD (an orchestrator, or the occupant of a non-removed slot) and matches the move's `target` kind: foe-kind → enemy on-field; ally-kind → own on-field; self → normalized to the actor; none → normalized to the actor. Otherwise `illegalTarget`. Default intent picks the lowest-HP on-field foe (ties → lowest index), fallback the foe orchestrator — spec §7 "illegal move or target" — cost if wrong: hash churn before goldens only.
- Ruling 36: a headless side's command is accepted and ignored entirely (no validation beyond shape, temperature not stored) — matches B3 "later orchestrator commands are ignored" — cost if wrong: none.
- Ruling 37: in this fix also: sortActions duplicate check via Set of actors; skipReason throws EngineInvariantError for an unknown actor; Directive aimed at a non-subagent (incl. own orchestrator) → illegalTarget; move `moveDef` lookup to content/ — cost if wrong: none.
- Ruling 38: default intent targets by the move's target kind (foe → lowest-HP on-field foe, ally → lowest-HP on-field ally incl. self, self/none → actor); 'any but user' moves treated as foe for the default — goldens will use it — cost if wrong: hash churn.

## Task A12a: Resolution pipeline, damage, hallucination and Drift

- Ruling 39: Handoff counts CONSECUTIVE allied hits on one target in a round: 1st hit no bonus, 2nd 11000, 3rd 12000, 4th+ 13000 (cap) — bible "each consecutive allied hit … +10% (cap +30%)"; a flat +10% on every hit would be a buff, not a chain — cost if wrong: one-line change, balance only.
- Ruling 40: accept "any action by the other side breaks that side's chains" (incl. non-none levers) — matches bible "an enemy action in between breaks the chain" — cost if wrong: target filter.
- Ruling 41: accept new state fields moveHistory/seenMoves/observedMoves and BattleState.handoff; move with no target left → ActionSkipped 'fainted'; failsIf → Missed; observation persists after compaction; untrained subagent acts at T2 — cost if wrong: small.
- Ruling 42: D4 hi "usable moves" = the creature's full stored moveset (incl. universals) minus moves currently disabled by status — spec D4 + Ruling 27 — cost if wrong: hash churn.
- Ruling 43: implement `foeMostDamage` (deterministic estimate: computeDamage with roll 10000, no crit, current stages/types; ties → lowest index) and `foeOffByOne` (on-field foe with the next-lower canonical index than the intended target, wrapping to the highest) now, instead of silently treating them as `foe` — cost if wrong: targeting for 3 moves.
- Ruling 44: rng stays dependency-free: lo/hi throw a plain RangeError (no import from math) — spec §4 units table — cost if wrong: none.
- Ruling 45: hallucination check (D2 hi) runs before the Drift random-move check (D1 hi); if hallucination fires, the Drift check is ignored — cost if wrong: hash churn.
- Ruling 46: accept multi-hit counts once for Long-Term Recall and one Earnest Apology modifier covers every hit of a multi-hit move — cost if wrong: small.
- Ruling 47 (carry to A12b): stage-buff moves must pass the buff tag to context.pay so compaction strips stages.
- Ruling 48: accept fixer's definitions — Glazed forbids status moves (power null) and debuffs (lower/clear a stage or apply a status to anyone outside the user's side); Overfit forbids every move but the last used; if all forbidden, D4 pick falls back to the full moveset — carry enforcement on commanded/deck moves to A12b/B2 — cost if wrong: hash churn.
- Ruling 49: Quantized −1 is folded into the stage BEFORE crit's "ignore positive Def stages" and before ignoreUserComputeDrops — stages are combined first, then special rules apply — cost if wrong: small damage edge cases.

## Task A12b: Guards, charge, heal, stage, status, tokens, Swap and /clear

- Ruling 50 (A12b): a commanded orchestrator move disabled by status (Glazed/Overfit per Ruling 48) → CommandError `moveDisabled`; the default intent skips disabled moves (decks trace moveDisabled in B2).
- Ruling 51: accept A12b edge calls — Compact clears Drift only via the move's cure effect (removed from context.compact); nextActionModifier.ts created now, A13 extends it; Rate Limited Speed ×0.5 applied at Sort; guards act only vs foes' moves; Unit Test reflects one computed hit at 50%; Swap of an already-on-field creature is a no-op; charging orchestrator rejects any non-`none` command — cost if wrong: small.
- Ruling 52: leaveField sets `leftFieldRound = state.round`; skipReason returns 'leftField' when it equals the current round, so a creature that left and returned mid-round never acts that round — spec §5 Sort — cost if wrong: none.
- Ruling 53: an orchestrator holding Prompt Injected whose entry is not skipped has its entry replaced by the hijack whatever it commanded (move, lever or none); this consumes the injection — bible "the victim's next action is replaced" — cost if wrong: levers unusable for one round under injection.
- Ruling 54: validate command `injection` (moveId exists; target is a safe integer canonical index) → invalidCommand — NaN would break plain-data state — cost if wrong: none.
- Ruling 55: a charge round is not a sighting: Observation, moveHistory and lastMoveId bookkeeping happen on release only — avoids a systematic −10% on charge moves — cost if wrong: balance only.
- Ruling 56: Captcha Wall blocks every Speed-type move aimed at the guarded creature (any power); default injection with no on-field ally uses the move's default selector instead of hitting itself; expired guard objects cleared at end of round — cost if wrong: small.

## Task A13: Remaining effect primitives and slice passives

- Ruling 57 (A13): passive timing — `battleStart` passives apply at createBattle (priority modifier consumed at the creature's first Sort); `afterFirstAction` runs immediately after that action's effects resolve and BEFORE the per-action win check (so Blitzr recoil can produce a same-action double wipe → draw); `roundEnd` passives run at the start of end-of-round, before status ticks; `statusIncoming` runs inside applyStatus before the status lands; `notKoThisRound` runs at end of round for creatures still alive. Chance procs read that round's r2hi — cost if wrong: hash churn.
- Ruling 58 (A13): `copy` — Episodic Replay re-uses the last allied move with its original target if still legal, else the move's default selector, resolving with this action's draws (no extra roll); Stochastic Repeat copies the foe's last move the same way; Fork copies the target's highest positive stage (ties: compute, robustness, latency, accuracy, evasion order); Merge Conflict swaps one positive stage picked by hi(D6, count) over the target's positive stages in that same fixed order — cost if wrong: small.
- Ruling 59 (amends 58): a copied move aims at the copier's own entry target if legal for the copied move, else the copied move's original target if legal, else the copied move's default selector — the literal 58 made Stochastic Repeat aim at its own side — cost if wrong: one-line.
- Ruling 60 (amends 57): `notKoThisRound` passives apply only to creatures ON THE FIELD at end of round (benched creatures don't fight) — cost if wrong: one-line.
- Ruling 61: accept Rerank moving the target's pending entry to right after the user (no extra event); timed effects count their cast round; FieldEffect events gained `target`; test helper battle() strips passives (battleWithPassives for passive tests) — cost if wrong: small.
- Ruling 62: moveHistory records the EXECUTED move (the copied move, not episodic-replay/stochastic-repeat), so copies and targetLastRound conditions see what actually ran — cost if wrong: small.
- Ruling 63: timed fields held by a creature end (FieldEffectEnded) when that creature leaves the field — benched creatures don't fight — cost if wrong: small.
- Ruling 64: Drift is not a status for Disclaimer (context owns Drift; Disclaimer blocks applyStatus only) — cost if wrong: none.
- Ruling 65: hardening in this fix — content test that every passive chance uses slot 'r2hi'; revertKo only consumes 'hp' snapshots; reword withoutPassives doc — cost if wrong: none.
- Ruling 66: lastMoveId keeps naming the move the creature itself used (the copy move) for Overfit, while moveHistory records the executed move — Overfit locks what the player chose — cost if wrong: small.

## Task A14: simulate, replay, properties and fuzz

- Ruling 67: export SetupError, SimulateError, EngineInvariantError (and ReplayError type) from index.ts as VALUES so callers can use instanceof — cost if wrong: none.
- Ruling 68: accept — replay returns 'malformed' for rounds logged after the battle ended; a seed parseSeed rejects or an unknown setup.kind → 'malformed' — cost if wrong: error-code naming only.
- Ruling 69: replay checks `isRecord(log) && typeof engineVersion === 'string'` and the version FIRST (→ 'version'), then the full shape — sub-project 5 must distinguish the two — cost if wrong: none.
- Ruling 70: replay no longer pads missing rounds: if the battle has not ended when the logged rounds run out, return 'malformed' (truncated); simulate logs always satisfy rounds.length === result.rounds — cost if wrong: hand-written logs need full rounds.
- Ruling 71: validate-then-advance shared by one helper used by both runBattle and submitRound; CommandSource doc warns `next(state)` must not mutate the state — cost if wrong: none.
- Ruling 72 (carry to B3): once Card is real (B1), add policyUpdate to the scripted-command arbitraries; injection application stays unit-tested since no slice species learns Deepfake Call — cost if wrong: coverage only.

## Task A15: Golden files, cross-runtime run and benchmark

- Ruling 73: accept test/golden/script.ts (command resolution split from scenario data); four statuses unreachable in slice content (promptInjected, rateLimited, deprecated, quantized) listed with reasons — slice species don't learn their moves; revisit when sub-project 4 finalizes movesets — cost if wrong: coverage only.

## Checkpoint A

- Ruling 74: Rate Limited (D2 lo) is checked in resolveEntry BEFORE the lever branch, so levers can be rate-limited. In B3, Directive and Policy Update take effect when the orchestrator's ENTRY resolves (not at plan time): a Directive replaces the directed subagent's action only if it has not acted yet this round; Rate Limited, /clear, charging and Prompt Injected therefore apply to levers consistently. The intent preview shows the directed intent assuming the lever resolves. This amends spec §5 Levers ("applied at plan time") — cost if wrong: Directive timing feel.
- Ruling 75: Ruling 29 reversed — validateSetup and validateGrid are shape-safe on untrusted JSON (return code `shape`, never throw) and replay reuses them — spec §7 — cost if wrong: none.
- Ruling 76: all rulings are committed to docs/superpowers/notes/phase-a-rulings.md (exported from this ledger), and the spec header points to it as a normative addendum (Revision 3.1); spec §4 units table updated (content→math, status→math+rng) — cost if wrong: none.
- Ruling 77: arbitraries set trainedTemperature, generalization and recordedFoes and allow 0 actives; add one golden using them — cost if wrong: none.
- Ruling 78: in this fix wave also: submitRound returns invalidCommand for a non-object cmd (null, undefined, 5); simulate binds scripted next; @types/node ^22; pin the full MOD_ORDER and a max-mods numeric value in tests; Quantized −1 also applies to accuracy and evasion stages ("all stats"); EngineInvariantError gains `action`; hijacked lever entries keep their sorted priority (documented); ContextAdded-with-negative-count stays (Ruling 17); ENGINE_VERSION bumped to 0.2.0 and goldens re-recorded — cost if wrong: small.
- Ruling 79 (carry to B2): getIntents peeks this round's R1/R2 by drawing them from a CLONED rng in canonical order, so intents match what submitRound will do.
- Ruling 80 (carry to B1): Robust +5 applies to subagents only and matches `recordedFrom`/recordedFoes against opponent ids, like Specialist.
