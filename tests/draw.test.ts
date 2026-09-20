import assert from 'node:assert/strict';
import {
  computePoolTotal, computeTierPools, countMatches, evaluateDraw, parseManualNumbers,
  randomNumbers, weightedNumbers,
} from '../lib/draw';
import { validateScore } from '../lib/scores';
import { subscriptionState } from '../lib/subscription';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };

// Deterministic RNG for repeatable tests.
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

test('random draw returns 5 unique numbers in 1–45', () => {
  for (let i = 0; i < 200; i++) {
    const n = randomNumbers(seeded(i + 1));
    assert.equal(n.length, 5);
    assert.equal(new Set(n).size, 5);
    assert.ok(n.every((x) => x >= 1 && x <= 45));
  }
});

test('weighted draw: unique, in range, and biased toward frequent scores', () => {
  const scores = [...Array(60).fill(30), ...Array(60).fill(31), 10, 11, 12];
  let hits = 0;
  for (let i = 0; i < 300; i++) {
    const n = weightedNumbers(scores, 'common', seeded(i + 7));
    assert.equal(new Set(n).size, 5);
    if (n.includes(30)) hits++;
  }
  assert.ok(hits > 300 * 0.6, `expected frequent score drawn often, got ${hits}/300`);
});

test('rare bias favours scores nobody logged', () => {
  const scores = Array(200).fill(30);
  let hits = 0;
  for (let i = 0; i < 300; i++) if (weightedNumbers(scores, 'rare', seeded(i + 3)).includes(30)) hits++;
  assert.ok(hits < 300 * 0.05);
});

test('countMatches counts distinct values only', () => {
  assert.equal(countMatches([10, 10, 20, 30, 40], [10, 20, 99, 98, 97]), 2);
  assert.equal(countMatches([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 5);
});

test('tier pools sum exactly to total and add rollover to the jackpot only', () => {
  const p = computeTierPools(100001, 5000);
  assert.equal(p[5] + p[4] + p[3], 100001 + 5000);
  assert.equal(p[5], Math.floor(100001 * 0.4) + 5000);
});

test('pool total uses monthly-equivalent (yearly = 1/12)', () => {
  const total = computePoolTotal([{ plan: 'monthly', amount_cents: 49900 }, { plan: 'yearly', amount_cents: 499900 }], 50);
  assert.equal(total, Math.floor(((49900 + Math.floor(499900 / 12)) * 50) / 100));
});

test('prizes split equally, leftover paise distributed, jackpot rolls over when unclaimed', () => {
  const numbers = [1, 2, 3, 4, 5];
  const entries = [
    { userId: 'a', scores: [1, 2, 3, 40, 41] }, // 3 match
    { userId: 'b', scores: [1, 2, 3, 42, 43] }, // 3 match
    { userId: 'c', scores: [1, 2, 3, 4, 44] },  // 4 match
    { userId: 'd', scores: [30, 31, 32, 33, 34] },
  ];
  const r = evaluateDraw({ numbers, entries, totalPoolCents: 100001, rolloverInCents: 0 });
  const t3 = r.winners.filter((w) => w.tier === 3);
  assert.equal(t3.length, 2);
  assert.equal(t3.reduce((s, w) => s + w.prizeCents, 0), r.pools[3]); // nothing lost to rounding
  assert.equal(r.winners.find((w) => w.tier === 4)!.prizeCents, r.pools[4]);
  assert.equal(r.jackpotRolloverOut, r.pools[5]); // no 5-match => carried forward
  assert.equal(r.distribution[0], 1);
});

test('jackpot is paid (no rollover) when someone matches all 5', () => {
  const r = evaluateDraw({
    numbers: [1, 2, 3, 4, 5],
    entries: [{ userId: 'a', scores: [5, 4, 3, 2, 1] }],
    totalPoolCents: 10000,
    rolloverInCents: 2500,
  });
  assert.equal(r.jackpotRolloverOut, 0);
  assert.equal(r.winners[0].prizeCents, r.pools[5]);
  assert.equal(r.pools[5], 4000 + 2500);
});

test('unclaimed 3/4-match pools are NOT rolled over', () => {
  const r = evaluateDraw({ numbers: [1, 2, 3, 4, 5], entries: [{ userId: 'a', scores: [40, 41, 42, 43, 44] }], totalPoolCents: 10000 });
  assert.equal(r.unclaimed, r.pools[4] + r.pools[3]);
});

test('manual numbers parsing', () => {
  assert.deepEqual(parseManualNumbers('5, 3 12 44,1'), [1, 3, 5, 12, 44]);
  assert.equal(typeof parseManualNumbers('1 2 3'), 'string');
  assert.equal(typeof parseManualNumbers('1 2 3 4 46'), 'string');
  assert.equal(typeof parseManualNumbers('1 1 2 3 4'), 'string');
});

test('score validation enforces 1–45, a real date, and no future dates', () => {
  assert.equal(validateScore(30, '2024-01-10'), null);
  assert.ok(validateScore(0, '2024-01-10'));
  assert.ok(validateScore(46, '2024-01-10'));
  assert.ok(validateScore(30.5, '2024-01-10'));
  assert.ok(validateScore(30, ''));
  assert.ok(validateScore(30, '2999-01-01'));
});

test('subscription state: active, lapsed, cancelled-with-time-left, inactive', () => {
  const future = new Date(Date.now() + 864e5).toISOString();
  const past = new Date(Date.now() - 864e5).toISOString();
  assert.equal(subscriptionState({ status: 'active', current_period_end: future }), 'active');
  assert.equal(subscriptionState({ status: 'active', current_period_end: past }), 'lapsed');
  assert.equal(subscriptionState({ status: 'cancelled', current_period_end: future }), 'active');
  assert.equal(subscriptionState({ status: 'cancelled', current_period_end: past }), 'cancelled');
  assert.equal(subscriptionState(null), 'inactive');
});

console.log(`\n${passed} tests passed`);
