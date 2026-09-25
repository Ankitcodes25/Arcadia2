import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";
import logo from "../assets/ArcadialogoA.png";
import { isGoogleAuthEnabled } from "../auth/authApi";
import type { AuthFormValues, AuthMode } from "../auth/authTypes";
import {
  NOTICE_FADING_CLASS,
  useAutoDismissNotice,
} from "../auth/authNotice";
import {
  getTrimmedUsernameLength,
  getUsernameLength,
  truncateUsernameToMax,
  USERNAME_MAX_LENGTH,
  USERNAME_MAX_REACHED_MESSAGE,
  USERNAME_MIN_LENGTH,
  USERNAME_TOO_SMALL_MESSAGE,
} from "../auth/usernameRules";
import "./LoginSignupModal.css";

type LoginSignupModalProps = {
  authMode: AuthMode;
  onClose: () => void;
  onSubmit: (values: AuthFormValues) => void | Promise<boolean>;
  onGoogleLogin: () => void;
  onSwitchMode: () => void;
  onClearError: () => void;
  onForgotPassword: (email: string) => Promise<string>;
  onResendVerification: (email: string) => Promise<string>;
  isSubmitting: boolean;
  error: string | null;
  /** Google sign-in warning, shown inside the still-open modal. */
  oauthError?: string | null;
  /** Test seam: production always uses the shared 5 second lifecycle. */
  noticeDurationMs?: number;
};

type ModalView = "form" | "forgot";
type WorkingAction = "forgot" | "resend" | null;

/* eye / eye-off icon for the password field toggle */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12C3.6 7.6 7.4 5 12 5s8.4 2.6 10 7c-1.6 4.4-5.4 7-10 7S3.6 16.4 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      {!open && (
        <path d="M4 4L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

function LoginSignupModal({
  authMode,
  onClose,
  onSubmit,
  onGoogleLogin,
  onSwitchMode,
  onClearError,
  onForgotPassword,
  onResendVerification,
  isSubmitting,
  error,
  oauthError = null,
  noticeDurationMs,
}: LoginSignupModalProps) {
  const [view, setView] = useState<ModalView>("form");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [workingAction, setWorkingAction] = useState<WorkingAction>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [usernameWarning, setUsernameWarning] = useState<string | null>(null);

  useEffect(() => {
    setView("form");
    setUsername("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setLocalError(null);
    setInfoMessage(null);
    setUsernameWarning(null);
  }, [authMode]);

  const isBusy = isSubmitting || workingAction !== null;
  const isSignupForm = view === "form" && authMode === "signup";
  const usernameLength = getUsernameLength(username);

  const dismissUsernameWarning = useCallback(() => setUsernameWarning(null), []);
  const isUsernameWarningFading = useAutoDismissNotice(
    usernameWarning,
    dismissUsernameWarning,
    noticeDurationMs,
  );

  const dismissOauthError = useCallback(() => onClearError(), [onClearError]);
  const isOauthErrorFading = useAutoDismissNotice(
    oauthError,
    dismissOauthError,
    noticeDurationMs,
  );

  function handleUsernameChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;

    if (getUsernameLength(nextValue) <= USERNAME_MAX_LENGTH) {
      setUsername(nextValue);
      // A usable value clears the previous warning. The counter already shows
      // the length, so nothing is shown while the user is still typing.
      setUsernameWarning(null);
      return;
    }

    // A 21st character is never accepted: only the allowed characters are kept
    // and the warning starts its own lifecycle.
    const nativeEvent = event.nativeEvent as InputEvent;
    if (nativeEvent?.isComposing) {
      setUsername(nextValue);
      return;
    }

    setUsername(truncateUsernameToMax(nextValue));
    setUsernameWarning(USERNAME_MAX_REACHED_MESSAGE);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    setInfoMessage(null);

    if (view === "forgot") {
      setWorkingAction("forgot");
      try {
        setInfoMessage(await onForgotPassword(email.trim()));
      } catch (requestError) {
        setLocalError(requestError instanceof Error
          ? requestError.message
          : "Unable to request a password reset email. Please try again.");
      } finally {
        setWorkingAction(null);
      }
      return;
    }

    // The modal stays open with the entered values when the username is not
    // usable yet. The backend validates the same rules independently.
    if (isSignupForm) {
      const trimmedLength = getTrimmedUsernameLength(username);
      if (trimmedLength < USERNAME_MIN_LENGTH) {
        setUsernameWarning(USERNAME_TOO_SMALL_MESSAGE);
        return;
      }
      if (trimmedLength > USERNAME_MAX_LENGTH) {
        setUsernameWarning(USERNAME_MAX_REACHED_MESSAGE);
        return;
      }
    }

    await onSubmit({
      username: username.trim(),
      email: email.trim(),
      password,
    });
  }

  async function handleResendVerification() {
    onClearError();
    setLocalError(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setLocalError("Enter your email address first.");
      return;
    }

    setWorkingAction("resend");
    try {
      setInfoMessage(await onResendVerification(email.trim()));
    } catch (requestError) {
      setLocalError(requestError instanceof Error
        ? requestError.message
        : "Unable to request a verification email. Please try again.");
    } finally {
      setWorkingAction(null);
    }
  }

  const isForgotView = view === "forgot";
  const title = isForgotView
    ? "Reset your password"
    : authMode === "login"
      ? "Log in to Arcadia"
      : "Create your account";
  const description = isForgotView
    ? "Enter your email and we’ll send reset instructions if you’re eligible"
    : authMode === "login"
      ? "Enter your credentials to continue"
      : "Join Arcadia and start playing";

  /* document.body me render karo — TSX tree me modal chahe kitni bhi
     transform/filter wali ancestors ke andar ho, position: fixed
     hamesha asli screen ke relative rahega, isliye centering kabhi
     offset nahi hogi. */
  return createPortal(
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={isBusy ? undefined : onClose}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="auth-modal-close" aria-label="Close authentication dialog" onClick={onClose} disabled={isBusy}>×</button>
        {oauthError && (
          <div
            className={`auth-modal-notice${isOauthErrorFading ? ` ${NOTICE_FADING_CLASS}` : ""}`}
            role="alert"
          >
            <span>{oauthError}</span>
            <button type="button" aria-label="Dismiss authentication message" onClick={onClearError}>×</button>
          </div>
        )}
        <div className="auth-modal-brand"><img src={logo} alt="" /><span>ARCADIA</span></div>
        <h2 id="auth-modal-title">{title}</h2>
        <p className="auth-modal-description">{description}</p>
        <form onSubmit={handleSubmit} aria-busy={isBusy}>
          {isSignupForm && (
            <label>
              <span className="auth-label-row">
                <span>Username</span>
                <span className="auth-username-counter">{usernameLength} / {USERNAME_MAX_LENGTH}</span>
              </span>
              <input
                name="username"
                type="text"
                placeholder="Letters, numbers, spaces, symbols"
                autoComplete="username"
                value={username}
                onChange={handleUsernameChange}
                required
              />
            </label>
          )}
          {isSignupForm && usernameWarning && (
            <p
              className={`auth-username-warning${isUsernameWarningFading ? ` ${NOTICE_FADING_CLASS}` : ""}`}
              role="alert"
            >
              {usernameWarning}
            </p>
          )}
          <label>Email<input name="email" type="email" placeholder="Enter email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          {!isForgotView && (
            <label>
              Password
              <span className="auth-password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={authMode === "login" ? "Enter password" : "Create password"}
                  autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  minLength={authMode === "signup" ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </span>
            </label>
          )}
          {!isForgotView && authMode === "login" && (
            <div className="auth-form-options">
              <div className="auth-form-links">
                <button type="button" className="auth-link" disabled={isBusy} onClick={() => { onClearError(); setView("forgot"); setLocalError(null); setInfoMessage(null); }}>Forgot Password?</button>
                <button type="button" className="auth-link" disabled={isBusy} onClick={() => void handleResendVerification()}>Resend verification</button>
              </div>
            </div>
          )}
          {isForgotView && <button type="button" className="auth-link auth-back-link" disabled={isBusy} onClick={() => { onClearError(); setView("form"); setLocalError(null); setInfoMessage(null); }}>Back to login</button>}
          {(error || localError) && <p className="auth-error" role="alert">{error || localError}</p>}
          {infoMessage && <p className="auth-info" role="status">{infoMessage}</p>}
          <button type="submit" className="auth-submit" disabled={isBusy}>{workingAction ? "Sending…" : isSubmitting ? (authMode === "login" ? "Logging in…" : "Creating account…") : (isForgotView ? "Send reset link" : authMode === "login" ? "Log In" : "Create Account")}</button>
        </form>
        {isGoogleAuthEnabled && !isForgotView && <div className="auth-divider"><span>OR</span></div>}
        {isGoogleAuthEnabled && !isForgotView && <button type="button" className="auth-google" onClick={onGoogleLogin} disabled={isBusy}><strong>G</strong> {authMode === "login" ? "Continue with Google" : "Sign up with Google"}</button>}
        {!isForgotView && <p className="auth-bottom-switch">{authMode === "login" ? "Don't have an account?" : "Already have an account?"} <button type="button" className="auth-link" onClick={onSwitchMode} disabled={isBusy}>{authMode === "login" ? "Sign up" : "Log in"}</button></p>}
      </section>
    </div>,
    document.body,
  );
}

export default LoginSignupModal;