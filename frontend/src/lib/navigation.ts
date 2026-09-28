import type { MouseEvent } from "react";

const NAVIGATION_EVENT = "arcadia:navigate";

/** The Match History page, reached from the Profile Popup. */
export const MATCH_HISTORY_PATH = "/match-history";

function scrollToSection(targetId: string) {
  const targetElement = document.getElementById(targetId);
  if (!targetElement) return;

  const navbarHeight = document.querySelector<HTMLElement>(".navbar")?.offsetHeight ?? 60;
  const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - navbarHeight - 11;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: "smooth",
  });
}

export function navigateTo(
  path: string,
  event?: MouseEvent<HTMLElement>
) {
  event?.preventDefault();

  const url = new URL(path, window.location.origin);

  const currentLocation =
    `${window.location.pathname}${window.location.search}${window.location.hash}`;

  const targetLocation =
    `${url.pathname}${url.search}${url.hash}`;

  /* -----------------------------------------
     Same page + hash
  ----------------------------------------- */

  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search &&
    url.hash
  ) {
    const targetId = url.hash.substring(1);
    scrollToSection(targetId);

    return;
  }

  /* -----------------------------------------
     Completely same location
  ----------------------------------------- */

  if (currentLocation === targetLocation) {
    return;
  }

  /* -----------------------------------------
     Update browser URL
  ----------------------------------------- */

  window.history.pushState({}, "", path);

  window.dispatchEvent(new Event(NAVIGATION_EVENT));

  /* App owns scrolling after the new page has rendered. */
  if (!url.hash) {
    /* -----------------------------------------
       Home / normal page navigation
    ----------------------------------------- */

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    });
  }
}

export function onNavigation(callback: () => void) {
  window.addEventListener(
    NAVIGATION_EVENT,
    callback
  );

  window.addEventListener(
    "popstate",
    callback
  );

  return () => {
    window.removeEventListener(
      NAVIGATION_EVENT,
      callback
    );

    window.removeEventListener(
      "popstate",
      callback
    );
  };
}

/* -----------------------------------------
   Match History and the Profile Popup

   Match History is a separate page, so the Profile Popup is unmounted while it
   is open. Coming back has to put that popup back, and the popup cannot do it
   itself because it is not mounted at the time. So the intent is parked here for
   the length of one navigation.

   These are transient values held in memory only. They are deliberately NOT in
   localStorage or sessionStorage: they describe a single click in a single
   session, so a reload or a new tab must not resurrect a popup the reader never
   asked for.
   ----------------------------------------- */

let shouldReopenProfilePopup = false;
let matchHistoryReturnPath = "/";

/** Parks the intent to bring the Profile Popup back. */
export function rememberReturningToProfilePopup() {
  shouldReopenProfilePopup = true;
}

/**
 * Reads and clears the intent in one step, so it fires exactly once. The clear on
 * read is what stops the popup reappearing on some later, unrelated navigation.
 */
export function consumeProfilePopupReopenRequest(): boolean {
  const requested = shouldReopenProfilePopup;
  shouldReopenProfilePopup = false;
  return requested;
}

/**
 * Records the page the reader was on when they left for Match History, so Return
 * sends them back to exactly that page rather than to a hard-coded guess.
 */
export function rememberMatchHistoryReturnPath(path: string) {
  matchHistoryReturnPath = path || "/";
}

export function getMatchHistoryReturnPath(): string {
  return matchHistoryReturnPath;
}