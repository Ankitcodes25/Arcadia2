import type { AuthProvider, AuthStatus } from "./authTypes";

/*
 * Account Info presentation.
 *
 * Every value here comes from the account profile the backend already returns.
 * Nothing in this module invents, defaults or estimates an account value.
 *
 *   Total hours played -> gamingStats.totalMinutesPlayed, which the backend does
 *                         not provide yet, so it renders the neutral placeholder.
 *   Joined date        -> createdAt, the account creation timestamp.
 *   Login method       -> authProvider and the verified account email, combined
 *                         into the one Login Method field.
 *   Account status     -> status, the account's existing status.
 *
 * The month names are a fixed English table rather than `toLocaleDateString`, so
 * the joined date always reads "24 September 2026" instead of changing with the
 * browser locale or abbreviating the month.
 */

/** Shown instead of a value the backend does not provide. */
export const ACCOUNT_INFO_EMPTY = "—";

/** Shown when a username could not be persisted, with no server message. */
export const USERNAME_SAVE_FAILED_MESSAGE =
  "Your username could not be saved. Please try again.";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The account email, or the neutral placeholder when the backend has none.
 *
 * This is the address already stored on the account record. For a Google
 * account it is the OIDC email Google returned, which the backend only accepts
 * once `email_verified` is true, so it is a verified address. It is display only:
 * the Google identity key is the stable `sub`, never the email address, and no
 * token of any kind is read or shown here.
 */
export function formatAccountEmail(email: string | null | undefined): string {
  const value = typeof email === "string" ? email.trim() : "";
  return value || ACCOUNT_INFO_EMPTY;
}

const LOGIN_METHOD_LABELS = Object.freeze({
  GOOGLE: "Google",
  PASSWORD: "Email",
});

/**
 * The Login Method value: the authentication method, then the address that
 * account signs in with, as one field.
 *
 *   Google account  -> `Google · ankit@gmail.com`
 *   Password account-> `Email · ankit@example.com`
 *
 * Both halves come from data the backend already returned: `authProvider` and
 * the verified account `email`. A Google account is never labelled as a password
 * account or the reverse, and a missing address becomes the neutral placeholder
 * rather than `undefined`, `null` or a broken value.
 */
export function getLoginMethodWithEmail(
  authProvider: AuthProvider | string,
  email: string | null | undefined,
): string {
  const method = LOGIN_METHOD_LABELS[authProvider as keyof typeof LOGIN_METHOD_LABELS]
    ?? ACCOUNT_INFO_EMPTY;
  return `${method} · ${formatAccountEmail(email)}`;
}

const ACCOUNT_STATUS_LABELS = Object.freeze({
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DELETED: "Deleted",
});

/**
 * `24 September 2026` from the account creation timestamp, or the neutral
 * placeholder when it is missing or unparseable.
 *
 * The date is rendered in the reader's own timezone, which is what a person means
 * by the day they joined.
 */
export function formatJoinedDate(value: string | Date | null | undefined): string {
  if (!value) return ACCOUNT_INFO_EMPTY;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return ACCOUNT_INFO_EMPTY;

  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * `12h 48m` from a real total-minutes value, or the neutral placeholder when
 * the backend does not track playtime yet.
 *
 * A genuine zero is shown as `0m`; only a missing or unusable value becomes the
 * placeholder, so a real measurement is never confused with absent data.
 */
export function formatHoursPlayed(totalMinutes: number | null | undefined): string {
  if (totalMinutes === null || totalMinutes === undefined) return ACCOUNT_INFO_EMPTY;

  const numeric = Number(totalMinutes);
  if (!Number.isFinite(numeric) || numeric < 0) return ACCOUNT_INFO_EMPTY;

  const wholeMinutes = Math.floor(numeric);
  const hours = Math.floor(wholeMinutes / 60);
  const minutes = wholeMinutes % 60;

  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** The account's current status, as a public label only. */
export function getAccountStatusLabel(status: AuthStatus | string): string {
  return ACCOUNT_STATUS_LABELS[status as keyof typeof ACCOUNT_STATUS_LABELS]
    ?? ACCOUNT_INFO_EMPTY;
}
