/**
 * Values pasted into a hosting dashboard sometimes pick up stray whitespace or even the next
 * line of a .env file. Keys and URLs never contain spaces or line breaks, so we use only the
 * first token. This keeps the app working, and keeps secrets from ending up in HTTP headers.
 */
export const cleanEnv = (value?: string): string => (value ?? '').trim().split(/\s+/)[0];

/** True when the raw value is a single clean token (no spaces, no line breaks). */
export const isCleanEnv = (value?: string): boolean => Boolean(value) && !/\s/.test(value as string);
