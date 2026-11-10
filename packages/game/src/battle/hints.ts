// One-time hints, shown the first time the player meets each battle element and then remembered in the save
// (ruling V5.4). Short and on-tone; each fits in one or two dialogue pages.

export const HINT_IDS = ['battle.prompt', 'battle.context', 'battle.temperature', 'battle.why', 'battle.intents'] as const;
export type HintId = (typeof HINT_IDS)[number];

export const HINTS: Readonly<Record<HintId, string>> = {
  'battle.prompt': 'PROMPT is your moves. Pick one and your model runs it. Results may vary. They usually do.',
  'battle.context':
    'CX is your context window. Every move fills it by its COST. Overflow it and the spill turns into Drift (DR2 = 2 stacks): worse aim. COMPACT makes room.',
  'battle.temperature': 'This dial is temperature, from T0 · 0.0 to T4 · 2.0 (default T2 · 1.0). Cold plays it safe. Hot hits wider, crits more and starts to hallucinate.',
  'battle.why': "WHY? explains which card a deck fired, after it acts. Never before. Nobody reads the plan in advance, not even the model.",
  'battle.intents': "The line over your subagent is its plan for next round, straight from its deck. Foes keep theirs to themselves: ?",
};

/** The round-start hint due now, if any (at most one a round): PROMPT first, then WHY? after a deck action, then the intents. */
export function dueRoundHint(seen: (id: HintId) => boolean, now: { readonly whyFresh: boolean; readonly ownIntent: boolean }): HintId | undefined {
  return (['battle.prompt', 'battle.why', 'battle.intents'] as const).find(
    (id) => !seen(id) && (id === 'battle.prompt' || (id === 'battle.why' && now.whyFresh) || (id === 'battle.intents' && now.ownIntent)),
  );
}
