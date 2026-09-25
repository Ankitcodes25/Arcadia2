/*
 * Frontend mirror of `backend/utils/username.js`.
 *
 * An Arcadia username may contain any visible Unicode character: letters in
 * any script, numbers, spaces, punctuation, symbols and emoji. The backend
 * rejects non-printable characters (control, format/zero-width, private use,
 * line separators) and reserved names, so the client only mirrors the length
 * rules and leaves those checks to the server.
 *
 * Length is counted in Unicode code points, exactly like the backend, so an
 * emoji counts as one character instead of two UTF-16 units.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export const USERNAME_TOO_SMALL_MESSAGE = "Username too small";
export const USERNAME_MAX_REACHED_MESSAGE = "Username max size reached";

export function getUsernameLength(value: string): number {
  return [...value].length;
}

/** Keeps only the characters that fit inside the 20 character limit. */
export function truncateUsernameToMax(value: string): string {
  return [...value].slice(0, USERNAME_MAX_LENGTH).join("");
}

/** Length the server will validate, which ignores surrounding whitespace. */
export function getTrimmedUsernameLength(value: string): number {
  return getUsernameLength(value.trim());
}
