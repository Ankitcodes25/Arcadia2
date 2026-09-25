import type { MouseEvent } from "react";

const NAVIGATION_EVENT = "arcadia:navigate";

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