import { useCallback, useEffect, useRef, useState } from "react";
import { AuthApiError, authApi } from "../../auth/authApi";
import { useAuth } from "../../auth/AuthContext";
import { getAuthErrorMessage } from "../../auth/authUtils";
import type { AccountProfileUser } from "../../auth/authTypes";
import {
  isUsernameTakenFailure,
  USERNAME_TAKEN_MESSAGE,
} from "../../auth/usernameAvailability";
import MyProfileModal from "./MyProfileModal";

/*
 * The data side of My Profile.
 *
 * Opening the modal always re-reads the account profile from the backend, so the
 * username, avatar and progression shown are the stored values rather than
 * whatever the client happened to be holding. A successful save pushes the
 * profile the backend returns straight into the auth state, which is the single
 * source the Navbar, the profile popup and this modal all read, so they update
 * from the same persisted data.
 *
 * A failed save is never treated as success: the Username Modal stays open, the
 * warning is rendered from the server's safe message, and the entered name is
 * kept so the retry does not lose it.
 */
const PROFILE_LOAD_FAILED_MESSAGE =
  "Your profile could not be loaded. Please close and try again.";
const PROFILE_SAVE_FAILED_MESSAGE =
  "Your changes could not be saved. Please try again.";

type MyProfileContainerProps = {
  onClose: () => void;
  /**
   * Global leaderboard rank stays a future backend-owned value, so it is only
   * forwarded when a caller has one. Nothing is invented.
   */
  globalRank?: number | null;
};

function MyProfileContainer({ onClose, globalRank = null }: MyProfileContainerProps) {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState<AccountProfileUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Guards against a slow first load landing after the modal was closed.
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await authApi.getProfile();
      if (!isMountedRef.current) return;
      setProfile(response.user);
    } catch (requestError) {
      if (!isMountedRef.current) return;
      setProfile(null);
      setLoadError(getAuthErrorMessage(requestError, PROFILE_LOAD_FAILED_MESSAGE));
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSaveUsername = useCallback(async (username: string) => {
    if (isSaving) {
      /*
       * Defence in depth against a second submission arriving while a write is
       * already in flight. It must reject rather than resolve quietly: the
       * Username Modal closes when this resolves, so returning normally here
       * would present a write that never happened as a success.
       */
      throw new AuthApiError(PROFILE_SAVE_FAILED_MESSAGE, 0);
    }
    setIsSaving(true);

    const result = await updateProfile({ username });
    if (!isMountedRef.current) return;

    if (!result.ok || !result.user) {
      /*
       * A 409 from the unique usernameNormalized index is a lost race, so it is
       * reported the same way the availability lookup would have reported it.
       * The stored profile and AuthContext both stay untouched.
       */
      const message = isUsernameTakenFailure(result.status, result.message)
        ? USERNAME_TAKEN_MESSAGE
        : (result.message || PROFILE_SAVE_FAILED_MESSAGE);

      setIsSaving(false);
      /*
       * An AuthApiError, not a plain Error: the Username Modal reads the safe
       * message off the thrown error, so a server message that is deliberately
       * not English text would otherwise be replaced by a generic fallback.
       */
      throw new AuthApiError(message, result.status ?? 0);
    }

    // Persisted: the returned profile becomes the new stored profile, and
    // AuthContext already holds the same values for the Navbar and popup.
    setProfile(result.user);
    setIsSaving(false);
  }, [isSaving, updateProfile]);

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <MyProfileModal
        profile={{ ...user, gamingStats: {
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          bestScore: 0,
          currentStreak: 0,
          winRatePercent: 0,
        } } as AccountProfileUser}
        onClose={onClose}
        loadError={loadError}
        onSaveUsername={handleSaveUsername}
      />
    );
  }

  return (
    <MyProfileModal
      profile={profile}
      globalRank={globalRank}
      onClose={onClose}
      loadError={loadError}
      onSaveUsername={handleSaveUsername}
    />
  );
}

export default MyProfileContainer;
