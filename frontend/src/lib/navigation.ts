import type { MouseEvent } from "react";

const NAVIGATION_EVENT = "arcadia:navigate";

export function navigateTo(
  path: string,
  event?: MouseEvent<HTMLAnchorElement>
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
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

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

  /* -----------------------------------------
     Scroll to hash after navigation
  ----------------------------------------- */

  if (url.hash) {
    const targetId = url.hash.substring(1);

    requestAnimationFrame(() => {
      const targetElement =
        document.getElementById(targetId);

      if (!targetElement) return;

      targetElement.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  } else {
    /* -----------------------------------------
       Home / normal page navigation
    ----------------------------------------- */

    requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
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