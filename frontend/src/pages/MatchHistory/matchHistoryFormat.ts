import type { MatchOpponentType, MatchResult } from "../../auth/authTypes";

/*
 * Match History formatting and calendar maths.
 *
 * Presentation and pure calculation only. Every value rendered here comes from a
 * genuine completed match the backend returned; nothing is defaulted, estimated
 * or invented. A field the backend does not have becomes a neutral placeholder,
 * so the list can never render `undefined`, `null` or an `Invalid Date`.
 *
 * Dates are handled as CALENDAR dates, never as instants. A selected day is a
 * year, a month and a day, kept as three numbers or as a `YYYY-MM-DD` string.
 * That is deliberate: converting a selected day to an instant and back can shift
 * it across a day boundary in a negative offset, so a reader in UTC-5 would see
 * the 1st selected as the 31st. Keeping calendar values avoids that entirely.
 */

export const MATCH_HISTORY_EMPTY = "—";

/** Shown instead of a value the backend does not provide. */
export const RESULT_TONES: Record<MatchResult, string> = {
  WIN: "win",
  LOSS: "loss",
  DRAW: "draw",
};

/**
 * The reader-facing result names.
 *
 * These are DISPLAY labels only. The stored and filtered value is never
 * renamed: the backend records `WIN`, `LOSS` and `DRAW`, and that is exactly what
 * is sent to and matched by the API. The Result dropdown and the history rows
 * both render through this table, so a `DRAW` always reads as "Draw" in the UI
 * and never as anything else.
 */
export const RESULT_LABELS: Record<MatchResult, string> = {
  WIN: "Win",
  LOSS: "Lost",
  DRAW: "Draw",
};

/**
 * The user-facing names for the three opponent kinds.
 *
 * The mapping is driven by the STORED opponent type, never by matching text in
 * an opponent name, so a human or local match can never be shown as Arcadion.
 */
const OPPONENT_LABELS: Record<MatchOpponentType, string> = {
  ARCADION: "Arcadion",
  ONLINE_FRIEND: "Online Friend",
  LOCAL: "Local Play",
};

export const OPPONENT_TYPE_OPTIONS: readonly { value: MatchOpponentType; label: string }[] = [
  { value: "ARCADION", label: OPPONENT_LABELS.ARCADION },
  { value: "ONLINE_FRIEND", label: OPPONENT_LABELS.ONLINE_FRIEND },
  { value: "LOCAL", label: OPPONENT_LABELS.LOCAL },
];

export const RESULT_OPTIONS: readonly { value: MatchResult; label: string }[] = [
  { value: "WIN", label: RESULT_LABELS.WIN },
  { value: "LOSS", label: RESULT_LABELS.LOSS },
  { value: "DRAW", label: RESULT_LABELS.DRAW },
];

export function getOpponentTypeLabel(opponentType: MatchOpponentType | string): string {
  return OPPONENT_LABELS[opponentType as MatchOpponentType] ?? MATCH_HISTORY_EMPTY;
}

export function getResultLabel(result: MatchResult | string): string {
  return RESULT_LABELS[result as MatchResult] ?? MATCH_HISTORY_EMPTY;
}

export function getResultTone(result: MatchResult | string): string {
  return RESULT_TONES[result as MatchResult] ?? "draw";
}

/* A fixed English month table, so the date never abbreviates or changes with
   the browser locale, exactly as the joined date in My Profile is rendered. */
export const MONTH_NAMES = [
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

/** Monday first, the ordering the calendar grid is built in. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Parses an ISO instant, or returns null when it is missing or unusable.
 * A guard like this is what keeps `Invalid Date` off the screen.
 */
export function parseCompletedAt(value: string | null | undefined): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * The completion date and time in the reader's own timezone, e.g.
 * `24 September 2026 at 18:30`.
 *
 * A missing or malformed timestamp becomes the neutral placeholder rather than
 * an `Invalid Date`.
 */
export function formatCompletedAt(value: string | null | undefined): string {
  const date = parseCompletedAt(value);
  if (!date) return MATCH_HISTORY_EMPTY;

  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
    + ` at ${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;
}

/** A measured duration, or the placeholder when the game system did not record one. */
export function formatDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) {
    return MATCH_HISTORY_EMPTY;
  }

  const whole = Math.floor(minutes);
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;

  if (hours > 0) return `${hours}h ${padTwo(rest)}m`;
  return `${rest}m`;
}

/* =========================================================
   CALENDAR DATES

   A `CalendarDate` is a plain year/month/day. It is never turned into a `Date`
   for comparison purposes, because that conversion is where timezone bugs come
   from. Ordering is done by comparing the three numbers.
   ========================================================= */

export type CalendarDate = {
  year: number;
  /** 1-12, matching how a person counts months. */
  month: number;
  day: number;
};

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD`, the exact form the API accepts. */
export function toCalendarDateString(date: CalendarDate): string {
  return `${String(date.year).padStart(4, "0")}-${padTwo(date.month)}-${padTwo(date.day)}`;
}

export function parseCalendarDateString(value: string): CalendarDate | null {
  if (!CALENDAR_DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = { year, month, day };
  return isRealCalendarDate(date) ? date : null;
}

/**
 * A real date check that never rolls over.
 *
 * `new Date(2026, 1, 31)` quietly becomes 3 March, so it cannot be used to
 * validate. The day count of the month is compared instead, which is also what
 * makes February in a leap year come out as 29 rather than 28.
 */
export function isRealCalendarDate(date: CalendarDate): boolean {
  if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || !Number.isInteger(date.day)) {
    return false;
  }
  if (date.month < 1 || date.month > 12) return false;
  if (date.day < 1 || date.day > getDaysInMonth(date.year, date.month)) return false;
  return true;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return lengths[month - 1] ?? 0;
}

/** Numeric ordering, so no `Date` is involved and no offset can shift a day. */
export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isSameCalendarDate(a: CalendarDate | null, b: CalendarDate | null): boolean {
  if (!a || !b) return false;
  return compareCalendarDates(a, b) === 0;
}

/** The reader's own today, taken from their clock so it is their day. */
export function getToday(): CalendarDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

/**
 * The reader's UTC offset, in the same sense as
 * `Date.prototype.getTimezoneOffset()`, so the backend can build the day bounds
 * from the reader's own days rather than the server's.
 */
export function getTimezoneOffsetMinutes(): number {
  return new Date().getTimezoneOffset();
}

/** The earliest month the calendar may show, from the account creation date. */
export function getEarliestMonth(createdAt: string | null | undefined): CalendarDate {
  const created = parseCompletedAt(createdAt);
  if (created) {
    return { year: created.getFullYear(), month: created.getMonth() + 1, day: 1 };
  }

  /*
   * No account creation date is available, so the earliest month falls back to
   * the current one. That still produces a usable calendar; it only means an
   * account older than this month cannot scroll back to its own first month.
   */
  const today = getToday();
  return { year: today.year, month: today.month, day: 1 };
}

/** How the calendar grid is laid out, Monday first. */
export function getMonthGrid(view: { year: number; month: number }): (CalendarDate | null)[] {
  // getUTCDay is 0 for Sunday, so this is shifted to make Monday index 0. It is
  // read off a UTC instant on purpose: it is only ever used as a weekday index,
  // never as a date, so no offset can move a day into the wrong column.
  const weekdayIndex = (new Date(Date.UTC(view.year, view.month - 1, 1)).getUTCDay() + 6) % 7;
  const cellCount = Math.ceil((weekdayIndex + getDaysInMonth(view.year, view.month)) / 7) * 7;

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - weekdayIndex + 1;
    if (day < 1 || day > getDaysInMonth(view.year, view.month)) return null;
    return { year: view.year, month: view.month, day };
  });
}

/**
 * Which of the four states a day is in, so it can be styled unambiguously.
 *
 * `today` is an outline-only marker, distinct from `selected`. When today is also
 * the chosen day, `selected` wins, so a selected day is always the filled one and
 * today never gets a fill it did not ask for.
 */
export type DayState = "disabled" | "selected" | "today" | "selectable";

export function getDayState(
  date: CalendarDate,
  selected: CalendarDate | null,
  bounds: { earliest: CalendarDate; latest: CalendarDate; today: CalendarDate },
): DayState {
  // Disabled wins over everything, so a day that is out of bounds is never shown
  // as today or as selected.
  const isBeforeEarliestMonth = compareCalendarDates(date, bounds.earliest) < 0;
  const isAfterLatest = compareCalendarDates(date, bounds.latest) > 0;
  if (isBeforeEarliestMonth || isAfterLatest) return "disabled";

  if (isSameCalendarDate(date, selected)) return "selected";
  if (isSameCalendarDate(date, bounds.today)) return "today";

  return "selectable";
}

/**
 * Validates a date range before it is sent to the API.
 *
 * An empty range is valid and means "all time". A partial range is also
 * accepted in the draft state until the user completes it. The API itself never
 * sees an invalid range because the page blocks the submit when this returns a
 * message.
 */
export function getRangeError(
  start: CalendarDate | null,
  end: CalendarDate | null,
): string | null {
  if (!start && !end) return null;
  if (start && !end) return null;
  if (!start && end) return null;

  if (compareCalendarDates(start, end) > 0) {
    return "Start date must be before or equal to the end date.";
  }

  return null;
}

/** A single chosen day, as shown on the Date dropdown itself. */
export function formatSelectedDateLabel(date: CalendarDate | null): string {
  if (!date) return "All time";
  return `${MONTH_NAMES[date.month - 1].slice(0, 3)} ${date.day}, ${date.year}`;
}
