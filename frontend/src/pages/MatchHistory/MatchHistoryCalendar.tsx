import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MONTH_NAMES,
  WEEKDAY_INITIALS,
  compareCalendarDates,
  getDayState,
  getMonthGrid,
  toCalendarDateString,
} from "./matchHistoryFormat";
import type { CalendarDate, DayState } from "./matchHistoryFormat";
import "./MatchHistoryCalendar.css";

/*
 * The range calendar.
 *
 * A popover with real month and year controls, bounded by the month the account
 * was created and the current month. It selects a range in two clicks: the first
 * click sets the start and clears the end, the second sets the end.
 *
 * Every day is a plain year/month/day, never an instant, so a day the reader
 * selects is the same day that is sent to the API. Nothing here reads the clock
 * to decide what "today" is beyond the bounds it is given.
 */

type MatchHistoryCalendarProps = {
  /** The range currently being chosen. */
  /** The one chosen day, or null for "All time". */
  selected: CalendarDate | null;
  /** The first selectable month, taken from the account creation date. */
  earliest: CalendarDate;
  /** The last selectable day, which is today. */
  latest: CalendarDate;
  /** Today, so it can be outlined. Always the same day as `latest`. */
  today: CalendarDate;
  onSelect: (date: CalendarDate) => void;
  onDismiss: () => void;
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={direction === "left" ? "M14.5 5.5 8 12l6.5 6.5" : "M9.5 5.5 16 12l-6.5 6.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function MatchHistoryCalendar({
  selected,
  earliest,
  latest,
  today,
  onSelect,
  onDismiss,
}: MatchHistoryCalendarProps) {
  // The month on screen. It opens on the month holding the current selection, so
  // reopening the calendar for an existing day lands somewhere useful.
  const [view, setView] = useState(() => {
    const focus = selected ?? latest;
    return { year: focus.year, month: focus.month };
  });

  const gridRef = useRef<HTMLDivElement>(null);

  // The bounds are expressed as months, so only those two numbers matter here.
  const canGoBack = compareCalendarDates(
    { year: view.year, month: view.month, day: 1 },
    { year: earliest.year, month: earliest.month, day: 1 },
  ) > 0;
  const canGoForward = compareCalendarDates(
    { year: view.year, month: view.month, day: 1 },
    { year: latest.year, month: latest.month, day: 1 },
  ) < 0;

  const shiftMonth = useCallback((delta: number) => {
    setView((current) => {
      const zeroBased = current.month - 1 + delta;
      const year = current.year + Math.floor(zeroBased / 12);
      const month = ((zeroBased % 12) + 12) % 12 + 1;
      return { year, month };
    });
  }, []);

  const shiftYear = useCallback((delta: number) => {
    setView((current) => ({ year: current.year + delta, month: current.month }));
  }, []);

  /*
   * A year step lands on the SAME month one year earlier or later, so it has to
   * be checked against both the year and the month. Comparing only the year
   * would let a reader in, say, September 2024 step back to 2023 and escape the
   * account's own creation month.
   */
  const canGoBackYear = view.year - 1 > earliest.year
    || (view.year - 1 === earliest.year && view.month >= earliest.month);
  const canGoForwardYear = view.year + 1 < latest.year
    || (view.year + 1 === latest.year && view.month <= latest.month);

  /*
   * One click chooses one day. There is no range to complete and no second click
   * to wait for, so the caller can filter the moment this returns.
   */
  const handleSelect = useCallback((date: CalendarDate) => {
    onSelect(date);
  }, [onSelect]);

  /*
   * Keyboard month and year navigation on the grid itself, so arrow keys and
   * PageUp/PageDown move through the months without needing a pointer. The bounds
   * are respected, so navigation cannot walk outside the account's own months.
   */
  const handleGridKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      PageUp: -1,
      ArrowRight: 1,
      PageDown: 1,
    };
    const delta = moves[event.key];
    if (delta === undefined) return;

    event.preventDefault();
    if (delta < 0 && !canGoBack) return;
    if (delta > 0 && !canGoForward) return;
    shiftMonth(delta);
  }, [canGoBack, canGoForward, shiftMonth]);

  /*
    Escape closes the calendar. Clicking outside is NOT handled here: the page
    owns that, because it has to treat the Date trigger as part of the open
    dropdown. A listener in here could only see the popover, so a press on the
    trigger would dismiss on pointerdown and then the trigger's own click would
    open it again, which is what made the trigger look unresponsive. The page's
    single listener covers the trigger and the popover together, so this one only
    needs to handle the key.
  */
  useEffect(() => {
    // A native listener, so it sees the document level Escape that React's
    // synthetic events would not deliver from here.
    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The page's own Escape handling must not also fire for this dismissal.
      event.stopPropagation();
      onDismiss();
    };

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [onDismiss]);

  // Moving focus into the grid means a keyboard user lands on the calendar
  // rather than having to Tab past the whole filter row again.
  useEffect(() => {
    gridRef.current?.focus();
  }, []);

  const grid = useMemo(() => getMonthGrid(view), [view]);

  return (
    <div
      className="mhc-popover"
      role="dialog"
      aria-label="Choose a date"
      aria-modal="false"
    >
      <div className="mhc-header">
        <button
          type="button"
          className="mhc-nav"
          onClick={() => shiftMonth(-1)}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronIcon direction="left" />
        </button>

        <button
          type="button"
          className="mhc-nav mhc-nav--year"
          onClick={() => shiftYear(-1)}
          disabled={!canGoBackYear}
          aria-label="Previous year"
        >
          <ChevronIcon direction="left" />
        </button>

        <div className="mhc-title" aria-live="polite">
          <span className="mhc-month">{MONTH_NAMES[view.month - 1]}</span>
          <span className="mhc-year">{view.year}</span>
        </div>

        <button
          type="button"
          className="mhc-nav mhc-nav--year"
          onClick={() => shiftYear(1)}
          disabled={!canGoForwardYear}
          aria-label="Next year"
        >
          <ChevronIcon direction="right" />
        </button>

        <button
          type="button"
          className="mhc-nav"
          onClick={() => shiftMonth(1)}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronIcon direction="right" />
        </button>

        <button
          type="button"
          className="mhc-close"
          onClick={onDismiss}
          aria-label="Close calendar"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="mhc-weekdays" aria-hidden="true">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={`${initial}-${index}`} className="mhc-weekday">
            {initial}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        className="mhc-grid"
        role="grid"
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        aria-label={`${MONTH_NAMES[view.month - 1]} ${view.year}. Use the arrow keys to change month.`}
      >
        {grid.map((date, index) => {
          // A leading or trailing blank keeps the real days on their weekday.
          if (!date) {
            return <span key={`blank-${index}`} className="mhc-day mhc-day--blank" aria-hidden="true" />;
          }

          const state: DayState = getDayState(date, selected, { earliest, latest, today });
          const isDisabled = state === "disabled";
          // A full spoken label, so the day is never announced as a bare number.
          const spokenLabel = `${date.day} ${MONTH_NAMES[view.month - 1]} ${date.year}`;

          return (
            <button
              key={toCalendarDateString(date)}
              type="button"
              className={`mhc-day mhc-day--${state}`}
              disabled={isDisabled}
              aria-label={spokenLabel}
              aria-pressed={state === "selected"}
              onClick={() => handleSelect(date)}
            >
              {date.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MatchHistoryCalendar;
