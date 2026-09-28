/*
 * Document scroll locking for the modal layers.
 *
 * A modal layer must stop the page behind it from scrolling, which is done by
 * hiding the document overflow. That removes the scrollbar, and because a
 * `position: fixed` dialog is centred inside the viewport, a centred parent
 * dialog would visibly jump sideways by half a scrollbar width. That is exactly
 * what a parent dialog does when a child layer opens over it.
 *
 * Two things prevent it here:
 *
 *  - `scrollbar-gutter: stable` is held for as long as the lock is engaged (see
 *    `index.css`), so the space the scrollbar occupied is reserved while the
 *    scrollbar itself is gone. The available width is therefore identical
 *    before and after locking, and nothing moves.
 *
 *  - The lock is reference counted, so a child layer opening on top of a parent
 *    that already holds the lock does not lock, and therefore does not unlock,
 *    again. Without this a parent and its child would each set and restore the
 *    overflow independently and fight over the document.
 */

let lockCount = 0;
let previousOverflow = "";

/**
 * Holds the document scroll for as long as it is engaged. Call the returned
 * function to release it; the last release restores the previous state.
 */
export function acquireModalScrollLock(): () => void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Reserving the gutter is what keeps a centred parent dialog stationary.
    document.documentElement.classList.add(MODAL_LOCK_CLASS);
  }
  lockCount += 1;

  let released = false;
  return () => {
    // A double release must not unlock a layer that is still open.
    if (released) return;
    released = true;

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove(MODAL_LOCK_CLASS);
    }
  };
}

/** Exported for the stylesheet contract and for tests. */
export const MODAL_LOCK_CLASS = "has-modal-scroll-lock";

/** The number of layers currently holding the lock. Test-only helper. */
export function activeModalScrollLocks(): number {
  return lockCount;
}
