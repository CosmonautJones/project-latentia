// Prints every archetype's headline fire rates as JSON (see src/headline-rates.ts). Usage: pnpm --filter @latentia/sim exec tsx scripts/headline-rates.ts
import { ARCHETYPES } from '../src/archetypes/index.js';
import { headlineRates } from '../src/headline-rates.js';

const out: Record<string, Record<string, number>> = {};
for (const a of ARCHETYPES) out[a.id] = headlineRates(a, ARCHETYPES.filter((x) => x.id !== a.id));
console.log(JSON.stringify(out, null, 1));
