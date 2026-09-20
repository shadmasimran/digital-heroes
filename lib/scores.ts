import { SCORE_MAX, SCORE_MIN } from '@/lib/draw';

export const MAX_SCORES = 5;

/** Validate a score entry. Returns an error message, or null when valid. */
export function validateScore(rawScore: unknown, rawDate: unknown): string | null {
  const score = Number(rawScore);
  if (rawScore === '' || !Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX)
    return `Score must be a whole number from ${SCORE_MIN} to ${SCORE_MAX}.`;
  const date = typeof rawDate === 'string' ? rawDate : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()))
    return 'Choose the date you played.';
  if (date > new Date().toISOString().slice(0, 10)) return 'The date cannot be in the future.';
  return null;
}
