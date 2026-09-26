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
 *
 * This module is the single frontend source for those rules. Signup, the Google
 * username onboarding modal and My Profile username editing all go through the
 * helpers below, so they cannot drift apart, and none of them applies a native
 * `maxLength` to a username field, because the browser counts `maxLength` in
 * UTF-16 units and would reject valid 20 code point emoji usernames.
 */

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export const USERNAME_TOO_SMALL_MESSAGE = "Username too small";
export const USERNAME_MAX_REACHED_MESSAGE = "Username max size reached";

export function getUsernameLength(value: string): number {
  return [...value].length;
}

/**
 * Keeps only the code points that fit inside the character limit.
 *
 * Iterating with the spread splits the string by code point, so a supplementary
 * character such as an emoji is never cut in half between its surrogate pair.
 */
export function truncateUsernameToMax(
  value: string,
  maxLength: number = USERNAME_MAX_LENGTH,
): string {
  return [...value].slice(0, maxLength).join("");
}

/** Length the server will validate, which ignores surrounding whitespace. */
export function getTrimmedUsernameLength(value: string): number {
  return getUsernameLength(value.trim());
}

export type UsernameInputResolution = {
  /** The value to keep: either the whole input, or its first allowed code points. */
  value: string;
  /** True when the input went over the maximum and the extra code point was refused. */
  exceededMax: boolean;
};

/**
 * Applies the code point maximum to a raw input value.
 *
 * Text that already fits is returned untouched, and text that does not is
 * reduced to the first `maxLength` code points, so the extra code point is never
 * appended and any valid text before it stays intact.
 *
 * While an IME composition is in progress the browser still owns the text, so
 * the value is accepted as-is and capped once the composition ends.
 */
export function resolveUsernameInput(
  nextValue: string,
  options: { isComposing?: boolean; maxLength?: number } = {},
): UsernameInputResolution {
  const { isComposing = false, maxLength = USERNAME_MAX_LENGTH } = options;

  if (isComposing) {
    return { value: nextValue, exceededMax: false };
  }

  if (getUsernameLength(nextValue) <= maxLength) {
    return { value: nextValue, exceededMax: false };
  }

  return { value: truncateUsernameToMax(nextValue, maxLength), exceededMax: true };
}

/**
 * Whether two usernames refer to the same account name for uniqueness purposes.
 *
 * This mirrors only the comparison the server documents in
 * `backend/utils/username.js` (trim, then case fold). It exists so the
 * availability lookup is not answered by the caller's own record: without it,
 * re-submitting your current name, or changing only its casing, would be
 * reported as "already taken" even though the server accepts both.
 *
 * The server stays the source of truth for uniqueness. Nothing here is used to
 * validate, normalize or store a username.
 */
export function isSameUsername(first: string, second: string): boolean {
  return toComparisonValue(first) === toComparisonValue(second);
}

function toComparisonValue(value: string): string {
  return value.trim().toLowerCase();
}
