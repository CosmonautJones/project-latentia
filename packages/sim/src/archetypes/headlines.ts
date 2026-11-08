import type { BattleResult, CreatureSetup } from '@latentia/engine';

// Each archetype's headline combo (Ruling 132): the deck cards that carry its idea, by creature local id (the part of
// the creature id after `<archetype id>/`) and card id. An orchestrator's cards are its Autopilot deck's. The
// archetype test checks that every one fires against the field, and scripts/smoke.ts counts them.
//
// The Hallucinating → Citation Needed combo is reasoning-nuke-sagelet's: its own Hallucinat hazes with Adversarial
// Patch, and its Embeddingo cites the hallucinating foe. The search archetypes' status-gated cards (Ground Truth on a
// hallucinating self, Citation Needed on a hallucinating foe) depend on the field leaving a creature Hallucinating,
// which it seldom does (only three species inflict it, and every Search hit cures it), so their headlines are the
// cards that carry the rest of the idea: Citation Needed on Reasoning-type foes, Cosine Sniff, Fact Check, Scrape's steal.

export type HeadlineCard = { creature: string; card: string };

export const HEADLINES: Readonly<Record<string, readonly HeadlineCard[]>> = {
  'speed-rush-blitzr': [{ creature: 'blitzr', card: 'finish' }, { creature: 'tokenibble', card: 'exit' }, { creature: 'tokenibble', card: 'burst' }],
  'speed-rush-agentoad': [{ creature: 'agentoad', card: 'tools' }, { creature: 'heisenmoth', card: 'flash' }],
  'speed-rush-graft': [{ creature: 'blitzr', card: 'weak' }, { creature: 'tokenibble', card: 'burst' }, { creature: 'heisenmoth', card: 'flash' }],
  'reasoning-nuke-sagelet': [{ creature: 'sagelet', card: 'charge' }, { creature: 'hallucinat', card: 'patch' }, { creature: 'embeddingo', card: 'cite' }],
  'reasoning-nuke-hallucinat': [{ creature: 'hallucinat', card: 'nuke' }, { creature: 'vibrat', card: 'hype' }, { creature: 'vibrat', card: 'accept' }],
  'open-swarm-forkling': [{ creature: 'forkling', card: 'coin' }, { creature: 'fork', card: 'swarm' }, { creature: 'slopling', card: 'swarm' }],
  'open-swarm-slopling': [{ creature: 'slopling', card: 'swarm' }, { creature: 'slopling', card: 'haze' }, { creature: 'forkling', card: 'swarm' }],
  'code-lock-spaghettopus': [{ creature: 'spaghettopus', card: 'loop' }, { creature: 'spaghettopus', card: 'leak' }, { creature: 'nullbeetle', card: 'pin' }],
  'code-lock-nullbeetle': [{ creature: 'nullbeetle', card: 'test' }, { creature: 'nullbeetle', card: 'loop' }, { creature: 'wasp', card: 'test' }],
  'code-lock-cobolt': [{ creature: 'cobolt', card: 'patch' }, { creature: 'spaghettopus', card: 'loop' }],
  'voice-pressure-parrot': [{ creature: 'parrot', card: 'hype' }, { creature: 'parrot', card: 'flatter' }],
  'voice-pressure-vibrat': [{ creature: 'vibrat', card: 'hype' }, { creature: 'parrot', card: 'flatter' }],
  'memory-stall-deprecatter': [{ creature: 'deprecatter', card: 'save' }, { creature: 'deprecatter', card: 'replay' }, { creature: 'cobolt', card: 'patch' }],
  'memory-stall-retro': [{ creature: 'deprecatter', card: 'save' }, { creature: 'cobolt', card: 'patch' }],
  'search-anti-hallu-embeddingo': [{ creature: 'embeddingo', card: 'reasoner' }, { creature: 'embeddingo', card: 'sniff' }, { creature: 'scrapion', card: 'check' }],
  'search-anti-hallu-scrapion': [{ creature: 'scrapion', card: 'steal' }, { creature: 'scrapion', card: 'check' }, { creature: 'embeddingo', card: 'sniff' }],
  'mixed-starter-sagelet': [{ creature: 'sagelet', card: 'think' }, { creature: 'intern', card: 'exit' }],
  'mixed-starter-blitzr': [{ creature: 'blitzr', card: 'speed' }, { creature: 'intern', card: 'exit' }],
  'mixed-starter-forkling': [{ creature: 'forkling', card: 'flex' }, { creature: 'forkling', card: 'patch' }, { creature: 'intern', card: 'exit' }],
  'mixed-heisenmoth-tempo': [{ creature: 'heisenmoth', card: 'flash' }, { creature: 'heisenmoth', card: 'box' }, { creature: 'deprecatter', card: 'save' }],
};

/** How often each creature's deck cards fired in one battle (CardTrace events): creature id → card id → count. */
export function cardFires(result: BattleResult): Map<string, Map<string, number>> {
  const { a, b } = result.log.setup;
  const side = (s: typeof a): CreatureSetup[] => [s.orchestrator, ...s.active, ...s.bench];
  const ids = [...side(a), ...side(b)].map((c) => c.id); // canonical index order (spec §5 "Sides and roster")
  const out = new Map<string, Map<string, number>>();
  for (const e of result.events) {
    if (e.type !== 'CardTrace') continue;
    const id = ids[e.actor];
    if (id === undefined) continue;
    const cards = out.get(id) ?? new Map<string, number>();
    cards.set(e.firedCardId, (cards.get(e.firedCardId) ?? 0) + 1);
    out.set(id, cards);
  }
  return out;
}
