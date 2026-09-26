import { authApi } from "./authApi";
import {
  getTrimmedUsernameLength,
  isSameUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MAX_REACHED_MESSAGE,
  USERNAME_MIN_LENGTH,
  USERNAME_TOO_SMALL_MESSAGE,
} from "./usernameRules";

/*
 * Username availability and conflict handling, shared by the two places a
 * username can be entered: the Google/new-user onboarding modal and My Profile
 * username editing.
 *
 * The backend stays the source of truth for uniqueness. This module only asks
 * the existing `GET /account/username-availability` endpoint what it knows, and
 * it never decides availability on its own.
 *
 * That endpoint is deliberately non-enumerating: it answers `available: false`
 * for a name that is taken *and* for one the server would reject outright (a
 * reserved name, or one containing unsafe characters). The two are not
 * distinguishable from outside, and no other account information is exposed
 * either way. An unavailable name therefore always ends with the same outcome
 * for the user: pick a different one.
 *
 * A pre-check can still lose a race, because two accounts can pick the same name
 * at the same moment. That is why the unique `usernameNormalized` index stays
 * authoritative and why a 409 from the save is reported with the same warning as
 * the pre-check rather than being treated as a success.
 */
export const USERNAME_TAKEN_MESSAGE = "Username already taken";
export const USERNAME_CHECK_FAILED_MESSAGE =
  "Unable to check username availability. Please try again.";
export const USERNAME_SAVE_FAILED_MESSAGE =
  "Your username could not be saved. Please try again.";

/**
 * The warning that matches the current value, or `null` when the value satisfies
 * the shared 3-20 code point rule. The same two messages the signup form already
 * uses, so every username surface reports the same thing for the same problem.
 */
export function getUsernameLengthWarning(value: string): string | null {
  const length = getTrimmedUsernameLength(value);
  if (length === 0) return null;
  if (length < USERNAME_MIN_LENGTH) return USERNAME_TOO_SMALL_MESSAGE;
  if (length > USERNAME_MAX_LENGTH) return USERNAME_MAX_REACHED_MESSAGE;
  return null;
}

/**
 * True when a rejected save means the username was taken by someone else, either
 * from the pre-check race or from the unique index itself.
 */
export function isUsernameTakenFailure(
  status: number | null | undefined,
  message: string | null | undefined,
): boolean {
  // 409 Conflict is what the unique `usernameNormalized` index produces.
  if (status === 409) return true;
  return typeof message === "string" && /already taken/i.test(message);
}

export type UsernameAvailability = {
  /** True only when the username may be accepted by the caller. */
  available: boolean;
  /** The in-modal warning to show, or `null` when there is nothing to report. */
  warning: string | null;
};

/**
 * Asks the backend whether a username can be used.
 *
 * @param username        The exact visible username the user entered.
 * @param currentUsername The account's existing username, when it has one, so
 *                        the account's own record is not reported as a conflict.
 */
export async function checkUsernameAvailable(
  username: string,
  currentUsername: string | null = null,
): Promise<UsernameAvailability> {
  const lengthWarning = getUsernameLengthWarning(username);
  if (lengthWarning) {
    return { available: false, warning: lengthWarning };
  }

  // Keeping your own name, or changing only its casing, is not a conflict.
  if (currentUsername && isSameUsername(username, currentUsername)) {
    return { available: true, warning: null };
  }

  try {
    const { available } = await authApi.checkUsernameAvailability(username);
    return available
      ? { available: true, warning: null }
      : { available: false, warning: USERNAME_TAKEN_MESSAGE };
  } catch {
    // Never guess: an unreachable availability lookup must not let an unchecked
    // name through, and must not claim it is taken either.
    return { available: false, warning: USERNAME_CHECK_FAILED_MESSAGE };
  }
}
