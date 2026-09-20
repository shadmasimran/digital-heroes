/**
 * Draw & prize engine — pure functions, no I/O, fully unit-tested (npm test).
 *
 * Interpretation of the PRD (documented in README §Assumptions):
 *  - A draw picks 5 distinct numbers in the Stableford range 1–45.
 *  - A subscriber's entry is their 5 stored scores. Match count = how many of the
 *    DISTINCT score values appear in the drawn numbers.
 *  - Tiers: 5 matches 40% (jackpot, rolls over), 4 matches 35%, 3 matches 25%.
 *  - Prizes in a tier are split equally; leftover paise go 1-each to the first winners.
 */
export const DRAW_SIZE = 5;
export const SCORE_MIN = 1;
export const SCORE_MAX = 45;
export const TIER_SHARES: Record<3 | 4 | 5, number> = { 5: 0.4, 4: 0.35, 3: 0.25 };

export type Rng = () => number;
export type Bias = 'common' | 'rare';
export type Entry = { userId: string; scores: number[] };
export type Tier = 3 | 4 | 5;

const range = () => Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

/** Standard lottery-style draw: 5 unique numbers, uniformly random. */
export function randomNumbers(rng: Rng = Math.random): number[] {
  const pool = range();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, DRAW_SIZE).sort((a, b) => a - b);
}

/**
 * Algorithmic draw, weighted by score frequency across all eligible subscribers.
 *  bias 'common': frequently-logged scores are more likely to be drawn (weight = 1 + count)
 *  bias 'rare'  : rarely-logged scores are more likely (weight = 1 / (1 + count))
 * Sampling is without replacement so numbers stay unique.
 */
export function weightedNumbers(allScores: number[], bias: Bias = 'common', rng: Rng = Math.random): number[] {
  const freq = new Map<number, number>();
  allScores.forEach((s) => freq.set(s, (freq.get(s) || 0) + 1));
  const candidates = range().map((n) => {
    const f = freq.get(n) || 0;
    return { n, w: bias === 'common' ? 1 + f : 1 / (1 + f) };
  });
  const picked: number[] = [];
  while (picked.length < DRAW_SIZE) {
    const total = candidates.reduce((s, c) => s + c.w, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < candidates.length - 1; idx++) {
      r -= candidates[idx].w;
      if (r <= 0) break;
    }
    picked.push(candidates[idx].n);
    candidates.splice(idx, 1);
  }
  return picked.sort((a, b) => a - b);
}

/** Number of distinct score values that appear in the drawn numbers. */
export function countMatches(scores: number[], numbers: number[]): number {
  const drawn = new Set(numbers);
  return [...new Set(scores)].filter((s) => drawn.has(s)).length;
}

/** Prize pool for a month: pool% of each active subscriber's monthly-equivalent fee. */
export function computePoolTotal(subs: { plan: string; amount_cents: number }[], poolPercent: number): number {
  const monthly = subs.reduce(
    (sum, s) => sum + (s.plan === 'yearly' ? Math.floor(s.amount_cents / 12) : s.amount_cents),
    0
  );
  return Math.floor((monthly * poolPercent) / 100);
}

/** Split a pool into tiers. The 3-match tier absorbs rounding so tiers always sum to the total. */
export function computeTierPools(total: number, rolloverIn = 0): Record<Tier, number> {
  const t5 = Math.floor(total * TIER_SHARES[5]);
  const t4 = Math.floor(total * TIER_SHARES[4]);
  return { 5: t5 + rolloverIn, 4: t4, 3: total - t5 - t4 };
}

export type DrawResult = {
  numbers: number[];
  pools: Record<Tier, number>;
  distribution: Record<number, number>;
  winners: { userId: string; tier: Tier; matches: number; prizeCents: number }[];
  entries: { userId: string; scores: number[]; matches: number }[];
  jackpotRolloverOut: number;
  unclaimed: number; // 4/3-match pools with no winner (not rolled over per PRD)
};

export function evaluateDraw(input: {
  numbers: number[];
  entries: Entry[];
  totalPoolCents: number;
  rolloverInCents?: number;
}): DrawResult {
  const { numbers, entries, totalPoolCents, rolloverInCents = 0 } = input;
  const pools = computeTierPools(totalPoolCents, rolloverInCents);
  const distribution: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  const scored = entries.map((e) => {
    const matches = countMatches(e.scores, numbers);
    distribution[matches] = (distribution[matches] || 0) + 1;
    return { ...e, matches };
  });

  const winners: DrawResult['winners'] = [];
  let unclaimed = 0;
  ([5, 4, 3] as Tier[]).forEach((tier) => {
    const inTier = scored.filter((s) => s.matches === tier).sort((a, b) => a.userId.localeCompare(b.userId));
    if (!inTier.length) {
      if (tier !== 5) unclaimed += pools[tier];
      return;
    }
    const share = Math.floor(pools[tier] / inTier.length);
    let remainder = pools[tier] - share * inTier.length;
    inTier.forEach((w) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder -= extra;
      winners.push({ userId: w.userId, tier, matches: w.matches, prizeCents: share + extra });
    });
  });

  const jackpotWon = winners.some((w) => w.tier === 5);
  return {
    numbers,
    pools,
    distribution,
    winners,
    entries: scored,
    jackpotRolloverOut: jackpotWon ? 0 : pools[5],
    unclaimed,
  };
}

/** Parse "3, 12 19 27,44" into 5 unique in-range numbers, or return an error string. */
export function parseManualNumbers(raw: string): number[] | string {
  const nums = raw.split(/[\s,]+/).filter(Boolean).map(Number);
  if (nums.length !== DRAW_SIZE) return `Enter exactly ${DRAW_SIZE} numbers.`;
  if (nums.some((n) => !Number.isInteger(n) || n < SCORE_MIN || n > SCORE_MAX))
    return `Numbers must be whole numbers from ${SCORE_MIN} to ${SCORE_MAX}.`;
  if (new Set(nums).size !== DRAW_SIZE) return 'Numbers must be unique.';
  return nums.sort((a, b) => a - b);
}
