import { useCallback, useState, type ReactNode } from "react";
import { NOTICE_FADING_CLASS, useAutoDismissNotice } from "./authNotice";
import "./CopyButton.css";

/*
 * A small copy-to-clipboard control for a read-only value.
 *
 * It reuses the one existing notice lifecycle (`useAutoDismissNotice`) for its
 * confirmation, so it does not introduce a second notification system and does
 * not interact with the auth warning. The confirmation is inline and local to
 * the control: nothing is routed through the global auth notice, no modal opens,
 * and the value is never modified.
 *
 * The Clipboard API is used where it is available. When it is missing or the
 * permission is refused, the button reports that inline instead of failing
 * silently or throwing.
 */
const COPY_FAILED_MESSAGE = "Copy failed";

export type CopyButtonProps = {
  /** The exact value placed on the clipboard. */
  value: string;
  /** Accessible label, e.g. "Copy username". */
  label: string;
  /** Text shown briefly after a successful copy. */
  copiedLabel: string;
  className?: string;
  children?: ReactNode;
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 5.6A2.6 2.6 0 0 0 12.4 4H6.6A2.6 2.6 0 0 0 4 6.6v5.8A2.6 2.6 0 0 0 5.6 15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CopyButton({
  value,
  label,
  copiedLabel,
  className = "",
  children,
}: CopyButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const dismiss = useCallback(() => setMessage(null), []);
  const isFading = useAutoDismissNotice(message, dismiss);

  const handleClick = useCallback(async () => {
    if (!value) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(value);
      setMessage(copiedLabel);
    } catch {
      // Non-blocking: the control reports the problem and stays usable.
      setMessage(COPY_FAILED_MESSAGE);
    }
  }, [copiedLabel, value]);

  return (
    <span className={`copy-field${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="copy-field-button"
        aria-label={label}
        onClick={() => void handleClick()}
        disabled={!value}
      >
        {children ?? <CopyIcon />}
      </button>
      {message && (
        <span
          className={`copy-field-feedback${isFading ? ` ${NOTICE_FADING_CLASS}` : ""}`}
          role="status"
        >
          {message}
        </span>
      )}
    </span>
  );
}

export default CopyButton;
