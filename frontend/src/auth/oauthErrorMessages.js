const ACCOUNT_EXISTS_MESSAGE =
  "Account already exists. Please use your existing email and password to log in.";
const GENERIC_GOOGLE_ERROR_MESSAGE =
  "Google sign-in could not be completed. Please try again.";

export function getOAuthErrorMessage(code) {
  switch (code) {
    case "account_exists":
      return ACCOUNT_EXISTS_MESSAGE;
    case "access_denied":
      return "Google sign-in was cancelled. You can try again whenever you are ready.";
    case "invalid_state":
      return "The Google sign-in session expired or was invalid. Please try again.";
    default:
      return GENERIC_GOOGLE_ERROR_MESSAGE;
  }
}

/**
 * Google sign-in is only started from the login/signup modal, so a returned
 * OAuth error must bring that modal back instead of dropping the user on a
 * closed dialog. The modal always reopens on the login view because
 * `account_exists` has to be resolved with an existing email and password.
 *
 * Returns null when there is no OAuth error to recover from.
 */
export function getOAuthErrorAuthMode(code) {
  return typeof code === "string" && code ? "login" : null;
}
