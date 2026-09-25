import { useEffect, useRef, useState } from "react";

/*
 * Shared warning lifecycle for the Arcadia auth notices.
 *
 * Both the OAuth notice and the username warnings use this one implementation
 * so a warning always behaves the same way:
 *
 *   0 -> 5s      fully visible
 *   5s -> 5.32s  fading out (NOTICE_FADE_MS)
 *   5.32s        removed
 *
 * A new warning clears the previous timers and starts a fresh lifecycle, and
 * unmounting clears every timer so no state update can happen afterwards.
 *
 * The CSS fade duration is declared once in the stylesheets that render these
 * notices; NOTICE_FADE_MS must stay in sync with those rules.
 */

export const NOTICE_AUTO_DISMISS_MS = 5_000;
export const NOTICE_FADE_MS = 320;

/** Class applied while a notice is fading out. */
export const NOTICE_FADING_CLASS = "is-leaving";

type TimerHandle = ReturnType<typeof setTimeout>;

type AutoDismissNoticeOptions = {
  /** Called when the fully visible period ends and the fade should start. */
  onFadeStart: () => void;
  /** Called after the fade finished, which is when the notice is removed. */
  onDismiss: () => void;
  durationMs?: number;
  fadeMs?: number;
  // Injectable clock, which keeps this lifecycle deterministically testable.
  setTimer?: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
};

export type AutoDismissNotice = {
  start: () => void;
  cancel: () => void;
};

export function createAutoDismissNotice({
  onFadeStart,
  onDismiss,
  durationMs = NOTICE_AUTO_DISMISS_MS,
  fadeMs = NOTICE_FADE_MS,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout,
}: AutoDismissNoticeOptions): AutoDismissNotice {
  let fadeTimer: TimerHandle | null = null;
  let dismissTimer: TimerHandle | null = null;

  function clearTimers() {
    if (fadeTimer !== null) {
      clearTimer(fadeTimer);
      fadeTimer = null;
    }
    if (dismissTimer !== null) {
      clearTimer(dismissTimer);
      dismissTimer = null;
    }
  }

  return {
    start() {
      clearTimers();
      fadeTimer = setTimer(onFadeStart, durationMs);
      dismissTimer = setTimer(onDismiss, durationMs + fadeMs);
    },
    cancel: clearTimers,
  };
}

/**
 * Runs the shared notice lifecycle for the lifetime of `message`.
 * Returns true while the notice is fading out.
 */
export function useAutoDismissNotice(
  message: string | null,
  onDismiss: () => void,
  durationMs: number = NOTICE_AUTO_DISMISS_MS,
): boolean {
  const [isFading, setIsFading] = useState(false);
  const onDismissRef = useRef(onDismiss);

  // Kept in a ref so a changing callback identity never restarts the lifecycle.
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      setIsFading(false);
      return undefined;
    }

    // A new message always restarts the lifecycle in its fully visible state.
    setIsFading(false);
    const notice = createAutoDismissNotice({
      durationMs,
      onFadeStart: () => setIsFading(true),
      onDismiss: () => onDismissRef.current(),
    });
    notice.start();

    return () => notice.cancel();
  }, [message, durationMs]);

  return isFading;
}
