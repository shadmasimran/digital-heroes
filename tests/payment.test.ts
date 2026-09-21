import assert from 'node:assert/strict';
import { luhnValid, parseExpiry, validateTestCard } from '../lib/testcards';

let passed = 0;
const test = (name: string, fn: () => void) => { fn(); passed++; console.log('  ✓', name); };
const now = new Date('2026-09-21T10:00:00Z');
const good = { name: 'Demo User', number: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };

test('the standard test card succeeds and reports only the last 4 digits', () => {
  const r = validateTestCard(good, now);
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.last4, '4242'); assert.equal(r.brand, 'Visa'); }
});

test('Mastercard and debit test cards succeed', () => {
  assert.equal(validateTestCard({ ...good, number: '5555 5555 5555 4444' }, now).ok, true);
  assert.equal(validateTestCard({ ...good, number: '4000056655665556' }, now).ok, true);
});

test('special test numbers simulate declines with a clear message', () => {
  const r = validateTestCard({ ...good, number: '4000 0000 0000 0002' }, now);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /declined/i);
  const r2 = validateTestCard({ ...good, number: '4000000000009995' }, now);
  if (!r2.ok) assert.match(r2.error, /insufficient/i);
});

test('a real-looking (Luhn-valid) card number is refused in test mode', () => {
  const r = validateTestCard({ ...good, number: '4111 1111 1111 1111' }, now);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /test/i);
});

test('malformed numbers, expiry, cvc and empty name are rejected', () => {
  assert.equal(validateTestCard({ ...good, number: '1234 5678 9012 3456' }, now).ok, false);
  assert.equal(validateTestCard({ ...good, number: '4242' }, now).ok, false);
  assert.equal(validateTestCard({ ...good, expiry: '13/30' }, now).ok, false);
  assert.equal(validateTestCard({ ...good, expiry: '01/20' }, now).ok, false);
  assert.equal(validateTestCard({ ...good, cvc: '12' }, now).ok, false);
  assert.equal(validateTestCard({ ...good, name: '  ' }, now).ok, false);
});

test('expiry: MM/YY and MM/YYYY parse; the expiry month itself is still valid', () => {
  assert.ok(parseExpiry('09/26'));
  assert.ok(parseExpiry('9/2030'));
  assert.equal(parseExpiry('nope'), null);
  assert.equal(validateTestCard({ ...good, expiry: '09/26' }, now).ok, true);   // Sept 2026 not yet over
  assert.equal(validateTestCard({ ...good, expiry: '08/26' }, now).ok, false);  // Aug 2026 already over
});

test('luhn', () => {
  assert.equal(luhnValid('4242424242424242'), true);
  assert.equal(luhnValid('4242424242424241'), false);
});

console.log(`\n${passed} payment tests passed`);
