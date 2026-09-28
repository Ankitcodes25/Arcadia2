const {
  Match,
  OPPONENT_TYPES,
  OPPONENT_TYPE_VALUES,
  MATCH_RESULT_VALUES,
} = require('../models/Match');

/*
 * Match history reads.
 *
 * This service only READS. It cannot create, edit or delete a match, so there is
 * no way for a client to award itself a win, an opponent or a timestamp. Records
 * arrive only from trusted server-side game code via the model.
 *
 * Every query is scoped to the account id that came from the verified access
 * token, so one account can never read another's private history. A caller
 * cannot pass a user id at all: the only way to reach another account's rows is
 * to authenticate as that account.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
/* The largest real UTC offset is +14:00, so nothing outside this is trusted. */
const MAX_TZ_OFFSET_MINUTES = 14 * 60;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 86_400_000;
/* A selected calendar date, e.g. 2026-07-10. */
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

/** Accepts only a plain object, so a string or array is rejected. */
function isPlainObject(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value);
}

/**
 * The signed-in reader's UTC offset, in the same sense as
 * `Date.prototype.getTimezoneOffset()`: UTC minus local, in minutes.
 *
 * The list is shown in the reader's own timezone, so the calendar days they pick
 * in the date filter have to be THEIR days. The server cannot know that on its
 * own, so the client sends its offset and the day boundaries are built from it.
 * An absent or unusable value falls back to UTC, which is still deterministic.
 */
function parseTimezoneOffsetMinutes(value) {
  if (value === undefined || value === null || value === '') return 0;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) > MAX_TZ_OFFSET_MINUTES) {
    throw createError('Unsupported timezone offset', 400);
  }
  return numeric;
}

/**
 * A selected calendar date, resolved to a real instant in the reader's timezone.
 *
 * @param {string}  value         `YYYY-MM-DD`
 * @param {number}  offsetMinutes the reader's UTC offset
 * @param {boolean} endOfDay      true for the To date, so it covers the whole day
 */
function resolveCalendarDay(value, offsetMinutes, endOfDay) {
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    throw createError('Dates must use the YYYY-MM-DD format', 400);
  }

  const [year, month, day] = value.split('-').map(Number);

  // Rejects impossible dates such as 2026-02-31, which Date.UTC would roll over.
  const probe = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = probe.getUTCFullYear() === year
    && probe.getUTCMonth() === month - 1
    && probe.getUTCDate() === day;

  if (!isRealDate) {
    throw createError('Dates must be real calendar dates', 400);
  }

  // The reader's local midnight for that calendar date, as a UTC instant.
  const localMidnight = probe.getTime() + (offsetMinutes * MILLISECONDS_PER_MINUTE);
  // An end date runs to the final millisecond of that day, so a match completed
  // late in the day is never silently dropped.
  return endOfDay
    ? new Date(localMidnight + MILLISECONDS_PER_DAY - 1)
    : new Date(localMidnight);
}

/**
 * The opponent type filter. Only the three allowlisted values are accepted, so a
 * filter can never widen the query beyond the stored values.
 */
function parseOpponentType(value) {
  if (value === undefined || value === null || value === '' || value === 'ALL') {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!OPPONENT_TYPE_VALUES.includes(normalized)) {
    throw createError('Unsupported opponent type', 400);
  }
  return normalized;
}

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_LIMIT;

  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 1) {
    throw createError('Limit must be a positive whole number', 400);
  }
  return Math.min(numeric, MAX_LIMIT);
}

/**
 * How many matches to skip, so the whole history can actually be reached.
 *
 * The list is paged rather than returned in one piece, so `hasMore` is reported
 * honestly. A client is never told a page is the complete history when it is not.
 */
function parseOffset(value) {
  if (value === undefined || value === null || value === '') return 0;

  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 0) {
    throw createError('Offset must be zero or a positive whole number', 400);
  }
  return numeric;
}

/**
 * The result filter. Only the three stored results are accepted, and they are
 * matched against the stored value. The UI renames `DRAW` to "Tie" for the
 * reader, but the value that is filtered on is the one that was recorded.
 */
function parseResult(value) {
  if (value === undefined || value === null || value === '' || value === 'ALL') {
    return null;
  }

  const normalized = String(value).trim().toUpperCase();
  if (!MATCH_RESULT_VALUES.includes(normalized)) {
    throw createError('Unsupported result', 400);
  }
  return normalized;
}

/**
 * The one read. Filters are validated here rather than in the route, so every
 * caller gets the same guarantee.
 */
async function listMatchHistory({ userId, query }) {
  if (!userId) {
    throw createError('Authentication is required', 401);
  }

  const source = isPlainObject(query) ? query : {};
  const offsetMinutes = parseTimezoneOffsetMinutes(source.tzOffsetMinutes);

  const hasFrom = source.from !== undefined && source.from !== null && source.from !== '';
  const hasTo = source.to !== undefined && source.to !== null && source.to !== '';

  const from = hasFrom ? resolveCalendarDay(source.from, offsetMinutes, false) : null;
  const to = hasTo ? resolveCalendarDay(source.to, offsetMinutes, true) : null;

  if (from && to && from.getTime() > to.getTime()) {
    throw createError('The From date must not be after the To date', 400);
  }

  const opponentType = parseOpponentType(source.opponentType);
  const result = parseResult(source.result);
  const limit = parseLimit(source.limit);
  const offset = parseOffset(source.offset);

  // Scoped to the authenticated account. This is the whole authorisation model.
  const filter = { userId };
  if (opponentType) filter.opponentType = opponentType;
  if (result) filter.result = result;

  if (from || to) {
    filter.completedAt = {};
    if (from) filter.completedAt.$gte = from;
    if (to) filter.completedAt.$lte = to;
  }

  const [matches, total] = await Promise.all([
    Match.find(filter)
      // Newest completed match first, oldest last. The id breaks ties so the
      // order stays stable between requests, which is what makes paging safe.
      .sort({ completedAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit)
      .exec(),
    Match.countDocuments(filter).exec(),
  ]);

  // A page is never presented as the whole history. `total` is the real count
  // across all pages, and `hasMore` says whether anything is left below this one.
  const hasMore = offset + matches.length < total;

  return {
    matches: matches.map((match) => match.toJSON()),
    total,
    limit,
    offset,
    hasMore,
    // The filters that were actually applied, echoed so the client can confirm.
    filters: {
      from: hasFrom ? String(source.from) : null,
      to: hasTo ? String(source.to) : null,
      opponentType,
      result,
    },
  };
}

module.exports = {
  listMatchHistory,
  OPPONENT_TYPES,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};
