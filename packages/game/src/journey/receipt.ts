// The virtual water receipt (bible "Water, power and the Datacenter Spire"; plan step 9): a satirical per-run line on
// the end card. The figures are integer functions of the run's rounds and moves: deterministic, obviously fake, and
// credited to the in-world PR department. They are a shareable joke, not a claim about real water or energy use.

export interface RunSize {
  /** Rounds played, every battle of the run. */
  readonly rounds: number;
  /** Moves used, by every creature in those battles. */
  readonly moves: number;
}

export interface Receipt {
  readonly decilitres: number;
  readonly wattHours: number;
  readonly text: string;
}

export const RECEIPT_CREDIT = '- estimates by the Latentia PR department. All figures made up, like everyone else\'s.';

/** "4.2": tenths, with one decimal, from an integer. */
const tenths = (n: number): string => `${Math.floor(n / 10)}.${n % 10}`;
/** "0.009": thousandths, with three decimals, from an integer. */
const thousandths = (n: number): string => `${Math.floor(n / 1000)}.${String(n % 1000).padStart(3, '0')}`;

export function virtualWaterReceipt(run: RunSize): Receipt {
  // A fixed 0.4 L for booting up, 0.3 L a round and 0.1 L a move; 1 Wh a round and 1 Wh per two moves.
  const decilitres = 4 + 3 * run.rounds + run.moves;
  const wattHours = run.rounds + Math.floor(run.moves / 2);
  return { decilitres, wattHours, text: `This run used ${tenths(decilitres)} L of virtual water and ${thousandths(wattHours)} kWh. Offsets purchased: 0.` };
}
