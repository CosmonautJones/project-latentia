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
//
// Ruling 149 (D3): a headline card must fire as often as its idea needs, not just once. Each carries the rate it had
// before the deck search re-baselined the Autopilot decks (preD3Rate, in the share of battles over the field), and
// the archetype test asserts at least half of it. A re-tuned deck keeps a headline card's move and condition category.

export type HeadlineCard = { creature: string; card: string; preD3Rate: number };

export const HEADLINES: Readonly<Record<string, readonly HeadlineCard[]>> = {
  'speed-rush-blitzr': [{ creature: 'blitzr', card: 'finish', preD3Rate: 0.276 }, { creature: 'tokenibble', card: 'exit', preD3Rate: 0.544 }, { creature: 'tokenibble', card: 'burst', preD3Rate: 0.939 }],
  'speed-rush-agentoad': [{ creature: 'agentoad', card: 'tools', preD3Rate: 0.965 }, { creature: 'heisenmoth', card: 'flash', preD3Rate: 0.785 }],
  'speed-rush-graft': [{ creature: 'blitzr', card: 'weak', preD3Rate: 0.276 }, { creature: 'tokenibble', card: 'burst', preD3Rate: 0.886 }, { creature: 'heisenmoth', card: 'flash', preD3Rate: 0.772 }],
  'reasoning-nuke-sagelet': [{ creature: 'sagelet', card: 'charge', preD3Rate: 1 }, { creature: 'hallucinat', card: 'patch', preD3Rate: 0.943 }, { creature: 'embeddingo', card: 'cite', preD3Rate: 0.079 }],
  'reasoning-nuke-hallucinat': [{ creature: 'hallucinat', card: 'nuke', preD3Rate: 0.053 }, { creature: 'vibrat', card: 'hype', preD3Rate: 0.851 }, { creature: 'vibrat', card: 'accept', preD3Rate: 0.689 }],
  'open-swarm-forkling': [{ creature: 'forkling', card: 'coin', preD3Rate: 0.114 }, { creature: 'fork', card: 'swarm', preD3Rate: 0.842 }, { creature: 'slopling', card: 'swarm', preD3Rate: 0.868 }],
  'open-swarm-slopling': [{ creature: 'slopling', card: 'swarm', preD3Rate: 0.965 }, { creature: 'slopling', card: 'haze', preD3Rate: 0.377 }, { creature: 'forkling', card: 'swarm', preD3Rate: 0.425 }],
  'code-lock-spaghettopus': [{ creature: 'spaghettopus', card: 'loop', preD3Rate: 0.412 }, { creature: 'spaghettopus', card: 'leak', preD3Rate: 1 }, { creature: 'nullbeetle', card: 'pin', preD3Rate: 0.482 }],
  'code-lock-nullbeetle': [{ creature: 'nullbeetle', card: 'test', preD3Rate: 1 }, { creature: 'nullbeetle', card: 'loop', preD3Rate: 0.526 }, { creature: 'wasp', card: 'test', preD3Rate: 0.987 }],
  'code-lock-cobolt': [{ creature: 'cobolt', card: 'patch', preD3Rate: 0.228 }, { creature: 'spaghettopus', card: 'loop', preD3Rate: 0.667 }],
  'voice-pressure-parrot': [{ creature: 'parrot', card: 'hype', preD3Rate: 1 }, { creature: 'parrot', card: 'flatter', preD3Rate: 0.912 }],
  'voice-pressure-vibrat': [{ creature: 'vibrat', card: 'hype', preD3Rate: 0.93 }, { creature: 'parrot', card: 'flatter', preD3Rate: 1 }],
  'memory-stall-deprecatter': [{ creature: 'deprecatter', card: 'save', preD3Rate: 0.816 }, { creature: 'deprecatter', card: 'replay', preD3Rate: 0.18 }, { creature: 'cobolt', card: 'patch', preD3Rate: 0.439 }],
  'memory-stall-retro': [{ creature: 'deprecatter', card: 'save', preD3Rate: 0.912 }, { creature: 'cobolt', card: 'patch', preD3Rate: 0.439 }],
  'search-anti-hallu-embeddingo': [{ creature: 'embeddingo', card: 'reasoner', preD3Rate: 0.18 }, { creature: 'embeddingo', card: 'sniff', preD3Rate: 0.833 }, { creature: 'scrapion', card: 'check', preD3Rate: 0.447 }],
  'search-anti-hallu-scrapion': [{ creature: 'scrapion', card: 'steal', preD3Rate: 0.132 }, { creature: 'scrapion', card: 'check', preD3Rate: 0.939 }, { creature: 'embeddingo', card: 'sniff', preD3Rate: 0.838 }],
  'mixed-starter-sagelet': [{ creature: 'sagelet', card: 'think', preD3Rate: 0.974 }, { creature: 'intern', card: 'exit', preD3Rate: 0.452 }],
  'mixed-starter-blitzr': [{ creature: 'blitzr', card: 'speed', preD3Rate: 1 }, { creature: 'intern', card: 'exit', preD3Rate: 0.491 }],
  'mixed-starter-forkling': [{ creature: 'forkling', card: 'flex', preD3Rate: 0.912 }, { creature: 'forkling', card: 'patch', preD3Rate: 0.237 }, { creature: 'intern', card: 'exit', preD3Rate: 0.496 }],
  'mixed-heisenmoth-tempo': [{ creature: 'heisenmoth', card: 'flash', preD3Rate: 0.101 }, { creature: 'heisenmoth', card: 'box', preD3Rate: 1 }, { creature: 'deprecatter', card: 'save', preD3Rate: 0.846 }],
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
