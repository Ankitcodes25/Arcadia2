const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;

/*
 * An Arcadia username may use any visible Unicode character: letters in any
 * script, numbers, spaces, punctuation, symbols and emoji.
 *
 * Only characters that are not printable are rejected, because they are used
 * to imitate another identity or to break how a username renders:
 *   \p{Cc} control characters (includes NUL)
 *   \p{Cf} format characters (zero-width joiners, bidi overrides, soft hyphen)
 *   \p{Cs} lone surrogates
 *   \p{Co} private use characters
 *   \p{Zl} / \p{Zp} line and paragraph separators
 */
const UNSAFE_USERNAME_CHARACTERS = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/u;

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'arcadia',
  'support',
  'official',
  'moderator',
  'system',
  'root',
  'api',
  'help',
  'security',
]);

/*
 * Length is counted in Unicode code points instead of UTF-16 code units so an
 * emoji counts as one character. The frontend counts with the same strategy
 * (`[...value].length`) so client and server always agree.
 */
function getUsernameLength(value) {
  return typeof value === 'string' ? [...value].length : 0;
}

/*
 * Stored, visible form of a username: exactly what the account owner entered.
 * Casing, spacing, punctuation and symbols are never rewritten; only
 * surrounding whitespace is removed.
 */
function toDisplayUsername(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/*
 * Comparison-only form used for uniqueness, reserved-name and rate-limit
 * lookups. It is never displayed and never used to build a profile URL.
 */
function normalizeUsername(value) {
  return toDisplayUsername(value).toLowerCase();
}

function getUsernameValidationError(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Username is required';
  }

  if (UNSAFE_USERNAME_CHARACTERS.test(value)) {
    return 'Username contains invalid characters';
  }

  const length = getUsernameLength(toDisplayUsername(value));
  if (length < USERNAME_MIN_LENGTH || length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters`;
  }

  if (RESERVED_USERNAMES.has(normalizeUsername(value))) {
    return 'That username is reserved';
  }

  return null;
}

function isReservedUsername(value) {
  return RESERVED_USERNAMES.has(normalizeUsername(value));
}

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  UNSAFE_USERNAME_CHARACTERS,
  RESERVED_USERNAMES,
  getUsernameLength,
  toDisplayUsername,
  normalizeUsername,
  getUsernameValidationError,
  isReservedUsername,
};
