import { useCallback, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  checkUsernameAvailable,
  isUsernameTakenFailure,
  USERNAME_SAVE_FAILED_MESSAGE,
  USERNAME_TAKEN_MESSAGE,
} from "./usernameAvailability";
import UsernameModal from "../components/UsernameModal";
import { USERNAME_MAX_LENGTH } from "./usernameRules";

/*
 * Google username onboarding.
 *
 * A Google account is created and authenticated by the OAuth flow, but it has no
 * Arcadia username yet. `usernameSetupRequired` on the authenticated user is
 * what marks that state, and this component is the only exit from it.
 *
 * The rules it enforces:
 *
 *   - The modal is the existing "Enter Your Username" dialog in its onboarding
 *     mode, which has no close button, so onboarding cannot be skipped.
 *   - The entered username is validated by the same shared length rules and the
 *     same backend availability API as every other username change. There is no
 *     second username rule set here.
 *   - Continue asks the backend whether the name is free, and only then persists
 *     it through the existing account profile write.
 *   - AuthContext is updated from the stored profile the backend returns. That is
 *     what flips `usernameSetupRequired` to false, which is what unmounts this
 *     modal and what makes the Navbar show the username.
 *   - A rejected username keeps the modal open, keeps the entered value, shows
 *     the shared warning and allows an immediate retry. Nothing is stored in
 *     browser storage as a fallback, and no local value is shown as if it had
 *     been saved.
 */
function UsernameOnboarding() {
  const { user, updateProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (username: string): Promise<string | null> => {
    if (isSubmitting) return USERNAME_SAVE_FAILED_MESSAGE;
    setIsSubmitting(true);

    try {
      // The backend is the source of truth for uniqueness. A name it reports as
      // unavailable is refused here without touching any user or profile state.
      const availability = await checkUsernameAvailable(username, user?.username ?? null);
      if (!availability.available) {
        return availability.warning ?? USERNAME_TAKEN_MESSAGE;
      }

      const result = await updateProfile({ username });

      if (result.ok) {
        // Persisted: AuthContext now holds the stored username and the app
        // continues into Arcadia normally.
        return null;
      }

      /*
       * The availability lookup can still lose a race, because the unique
       * usernameNormalized index is the real authority. A 409 here is reported
       * exactly like the pre-check result, so it never looks like a success and
       * never leaves onboarding marked as complete.
       */
      if (isUsernameTakenFailure(result.status, result.message)) {
        return USERNAME_TAKEN_MESSAGE;
      }

      return result.message || USERNAME_SAVE_FAILED_MESSAGE;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, updateProfile, user?.username]);

  if (!user?.usernameSetupRequired) {
    return null;
  }

  return (
    <UsernameModal
      mode="onboarding"
      maxLength={USERNAME_MAX_LENGTH}
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
    />
  );
}

export default UsernameOnboarding;
