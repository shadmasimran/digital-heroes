/**
 * Test-mode card validation for the built-in demo checkout.
 * Mirrors how Stripe's test mode behaves: only well-known TEST numbers are accepted,
 * a few special numbers simulate failures, and real card numbers are refused.
 * Card data is validated and discarded — it is never stored or logged.
 */
export type CardInput = { name: string; number: string; expiry: string; cvc: string };
export type CardResult =
  | { ok: true; brand: string; last4: string }
  | { ok: false; error: string };

const ACCEPTED: Record<string, string> = {
  '4242424242424242': 'Visa',
  '4000056655665556': 'Visa debit',
  '5555555555554444': 'Mastercard',
};

const DECLINED: Record<string, string> = {
  '4000000000000002': 'Your card was declined.',
  '4000000000009995': 'Your card has insufficient funds.',
  '4000000000000069': 'Your card has expired.',
  '4000000000000127': "Your card's security code is incorrect.",
};

/** Luhn checksum — every genuine card number (and every Stripe test number) passes it. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    double = !double;
  }
  return digits.length > 0 && sum % 10 === 0;
}

/** Accepts MM/YY or MM/YYYY. Returns the last moment the card is valid, or null if malformed. */
export function parseExpiry(raw: string): Date | null {
  const m = raw.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const month = Number(m[1]);
  let year = Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (year < 100) year += 2000;
  return new Date(Date.UTC(year, month, 1) - 1); // last millisecond of the expiry month
}

export function validateTestCard(input: CardInput, now = new Date()): CardResult {
  if (!input.name.trim()) return { ok: false, error: 'Enter the name on the card.' };

  const digits = input.number.replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(digits) || !luhnValid(digits))
    return { ok: false, error: 'That card number is not valid.' };

  const expires = parseExpiry(input.expiry);
  if (!expires) return { ok: false, error: 'Enter the expiry date as MM/YY.' };
  if (expires < now) return { ok: false, error: "Your card's expiry date is in the past." };

  if (!/^\d{3}$/.test(input.cvc.trim())) return { ok: false, error: 'Enter the 3-digit security code (CVC).' };

  if (DECLINED[digits]) return { ok: false, error: DECLINED[digits] };
  if (ACCEPTED[digits]) return { ok: true, brand: ACCEPTED[digits], last4: digits.slice(-4) };

  return {
    ok: false,
    error: 'This is a test checkout, so only test cards work. Use 4242 4242 4242 4242 with any future expiry and any 3-digit CVC.',
  };
}
