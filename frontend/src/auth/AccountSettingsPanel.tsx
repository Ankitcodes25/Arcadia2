import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type FormEvent,
} from "react";
import { authApi } from "./authApi";
import { useAuth } from "./AuthContext";
import { getAuthErrorMessage } from "./authUtils";
import type {
  AccountProfileUser,
  AccountSession,
} from "./authTypes";
import { LOCAL_AVATARS } from "./avatarCatalog";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "./usernameRules";
import AvatarPreview from "./AvatarPreview";
import "./AccountSettingsPanel.css";

type AccountSettingsPanelProps = {
  onClose: () => void;
};

type AvailabilityState = "idle" | "checking" | "available" | "unavailable" | "current";

function formatDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function AccountSettingsPanel({ onClose }: AccountSettingsPanelProps) {
  const {
    user,
    updateProfile,
    changePassword,
    revokeSession,
    logoutOtherSessions,
  } = useAuth();
  const [profile, setProfile] = useState<AccountProfileUser | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [username, setUsername] = useState(user?.username || "");
  const [displayName, setDisplayName] = useState(user?.displayName || user?.name || "");
  const [availability, setAvailability] = useState<AvailabilityState>("idle");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const availabilityRequestRef = useRef(0);

  const loadAccountData = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    const [profileResult, sessionsResult] = await Promise.allSettled([
      authApi.getProfile(),
      authApi.listSessions(),
    ]);
    const loadErrors: string[] = [];

    if (profileResult.status === "fulfilled") {
      setProfile(profileResult.value.user);
      setUsername(profileResult.value.user.username || "");
      setDisplayName(profileResult.value.user.displayName || profileResult.value.user.name || "");
    } else {
      loadErrors.push(getAuthErrorMessage(profileResult.reason, "Unable to load profile."));
    }

    if (sessionsResult.status === "fulfilled") {
      setSessions(sessionsResult.value.sessions);
    } else {
      loadErrors.push(getAuthErrorMessage(sessionsResult.reason, "Unable to load sessions."));
    }

    if (loadErrors.length) setError(loadErrors.join(" "));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadAccountData();
  }, [loadAccountData]);

  useEffect(() => {
    const requestId = ++availabilityRequestRef.current;
    setAvailabilityError(null);
    if (!profile) {
      setAvailability("idle");
      return () => undefined;
    }

    const normalized = username.trim();
    if (!normalized || normalized === profile.username) {
      setAvailability(normalized === profile.username ? "current" : "idle");
      return () => undefined;
    }

    setAvailability("checking");
    const timeout = window.setTimeout(() => {
      void authApi.checkUsernameAvailability(normalized)
        .then((response) => {
          if (requestId !== availabilityRequestRef.current) return;
          setAvailability(response.available ? "available" : "unavailable");
        })
        .catch((requestError) => {
          if (requestId !== availabilityRequestRef.current) return;
          setAvailability("idle");
          setAvailabilityError(getAuthErrorMessage(requestError, "Unable to check username availability."));
        });
    }, 350);

    return () => {
      availabilityRequestRef.current += 1;
      window.clearTimeout(timeout);
    };
  }, [profile, username]);

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("username");
    setError(null);
    setSuccess(null);
    try {
      const response = await authApi.setUsername(username.trim());
      setProfile(response.user);
      setUsername(response.user.username || "");
      setAvailability("current");
      setSuccess("Username saved.");
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, "Unable to save username."));
    } finally {
      setBusyAction(null);
    }
  }

  /*
   * The display name goes through the same shared account profile write as My
   * Profile, so a save from either surface lands in the same auth state.
   */
  async function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("display-name");
    setError(null);
    setSuccess(null);
    const result = await updateProfile({ displayName: displayName.trim() });
    if (!result.ok || !result.user) {
      setError(result.message || "Unable to update display name.");
      setBusyAction(null);
      return;
    }

    setProfile(result.user);
    setSuccess("Profile saved.");
    setBusyAction(null);
  }

  /*
   * The avatar selection goes through the same shared account profile write as
   * My Profile, so the Navbar and the profile popup update from the persisted
   * value instead of from local state.
   */
  async function selectAvatar(avatar: { type: "local" | "google"; value?: string }) {
    if (!profile) return;
    const current = profile.avatar;
    if (current.type === avatar.type && (avatar.type === "google" || current.value === avatar.value)) {
      return;
    }

    setBusyAction(`avatar:${avatar.type === "google" ? "google" : avatar.value}`);
    setError(null);
    setSuccess(null);
    const result = await updateProfile({
      avatar: { type: avatar.type, value: avatar.value ?? (avatar.type === "google" ? "google" : "") },
    });

    if (!result.ok || !result.user) {
      setError(result.message || "Unable to update avatar.");
      setBusyAction(null);
      return;
    }

    setProfile(result.user);
    setSuccess(avatar.type === "google"
      ? "Google profile picture selected."
      : "Avatar updated.");
    setBusyAction(null);
  }

  function selectLocalAvatar(value: string) {
    return selectAvatar({ type: "local", value });
  }

  function selectGoogleAvatar() {
    return selectAvatar({ type: "google" });
  }

  async function handleRevokeSession(session: AccountSession) {
    setBusyAction(`session:${session.id}`);
    setError(null);
    setSuccess(null);
    try {
      const response = await revokeSession(session.id);
      if (response.current) {
        window.dispatchEvent(new Event("arcadia:open-login"));
      } else {
        setSessions((current) => current.filter((item) => item.id !== session.id));
        setSuccess(response.message);
      }
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, "Unable to revoke session."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLogoutOtherSessions() {
    setBusyAction("logout-others");
    setError(null);
    setSuccess(null);
    try {
      const response = await logoutOtherSessions();
      const currentSession = sessions.find((session) => session.current);
      setSessions(currentSession ? [currentSession] : []);
      setSuccess(`${response.revokedCount} other session${response.revokedCount === 1 ? "" : "s"} revoked.`);
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError, "Unable to revoke other sessions."));
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setBusyAction("change-password");
    const result = await changePassword(currentPassword, newPassword, confirmation);
    setBusyAction(null);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmation("");
    window.dispatchEvent(new Event("arcadia:open-login"));
  }

  if (!profile) {
    return (
      <section className="account-settings-panel" aria-busy={isLoading}>
        <div className="account-settings-heading">
          <h3>Account settings</h3>
          <button type="button" onClick={onClose} aria-label="Close account settings">×</button>
        </div>
        <p className="account-settings-message">
          {isLoading ? "Loading account settings…" : "Account settings could not be loaded."}
        </p>
        {error && <p className="account-settings-error" role="alert">{error}</p>}
        {!isLoading && (
          <button type="button" className="account-settings-secondary" onClick={() => void loadAccountData()}>
            Retry
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="account-settings-panel" aria-label="Account settings">
      <div className="account-settings-heading">
        <div>
          <span>ACCOUNT</span>
          <h3>Account settings</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Close account settings">×</button>
      </div>

      <div className="account-settings-summary">
        <AvatarPreview user={profile} className="account-settings-avatar" />
        <div>
          <strong>{profile.displayName || profile.username || profile.email}</strong>
          <span>{profile.username ? `@${profile.username}` : "Username setup required"}</span>
          <small>{profile.email} · {profile.authProvider === "GOOGLE" ? "Google account" : "Password account"} · {profile.emailVerified ? "Verified" : "Not verified"}</small>
        </div>
      </div>

      {error && <p className="account-settings-error" role="alert">{error}</p>}
      {success && <p className="account-settings-success" role="status">{success}</p>}

      <form className="account-settings-form" onSubmit={saveUsername}>
        <div className="account-settings-label-row">
          <label htmlFor="account-username">Username</label>
          <span className={`account-availability ${availability}`}>
            {availability === "checking" && "Checking…"}
            {availability === "available" && "Available"}
            {availability === "unavailable" && "Unavailable"}
            {availability === "current" && "Current username"}
          </span>
        </div>
        {availabilityError && <p className="account-settings-error" role="alert">{availabilityError}</p>}
        <input
          id="account-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          minLength={USERNAME_MIN_LENGTH}
          // Upper bound in UTF-16 units: 20 code points can be 40 units, and the
          // server validates the real code point count.
          maxLength={USERNAME_MAX_LENGTH * 2}
          autoComplete="username"
          required
          disabled={busyAction !== null}
        />
        <button type="submit" className="account-settings-primary" disabled={busyAction !== null || availability === "unavailable"}>
          {busyAction === "username" ? "Saving…" : "Save username"}
        </button>
      </form>

      <form className="account-settings-form" onSubmit={saveDisplayName}>
        <label htmlFor="account-display-name">Display name</label>
        <input
          id="account-display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={80}
          autoComplete="name"
          disabled={busyAction !== null}
        />
        <button type="submit" className="account-settings-secondary" disabled={busyAction !== null}>
          {busyAction === "display-name" ? "Saving…" : "Save display name"}
        </button>
      </form>

      <div className="account-settings-section">
        <div className="account-settings-label-row">
          <strong>Avatar</strong>
          <span>{profile.avatarSource === "google" ? "Google profile picture" : "Arcadia avatar"}</span>
        </div>
        <div className="avatar-option-grid">
          {LOCAL_AVATARS.map((avatar) => {
            const selected = profile.avatar.type === "local" && profile.avatar.value === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                className={selected ? "selected" : ""}
                onClick={() => void selectLocalAvatar(avatar.id)}
                disabled={busyAction !== null}
                aria-label={`Use ${avatar.label} avatar`}
              >
                <span style={{ background: avatar.background }}>{avatar.label.slice(0, 1)}</span>
                <small>{avatar.label}</small>
              </button>
            );
          })}
        </div>
        {profile.googleAvatarAvailable ? (
          <button
            type="button"
            className={`google-avatar-option ${profile.avatar.type === "google" ? "selected" : ""}`}
            onClick={() => void selectGoogleAvatar()}
            disabled={busyAction !== null}
          >
            <AvatarPreview
              user={{ ...profile, avatar: { type: "google", value: "google" } }}
              className="account-settings-google-avatar"
            />
            <span>Use Google profile picture</span>
          </button>
        ) : (
          <p className="account-settings-hint">Google profile picture is unavailable for this account.</p>
        )}
      </div>

      <div className="account-settings-section">
        <div className="account-settings-label-row">
          <strong>Active sessions</strong>
          <button
            type="button"
            className="account-settings-text-button"
            onClick={() => void handleLogoutOtherSessions()}
            disabled={busyAction !== null || sessions.length < 2}
          >
            {busyAction === "logout-others" ? "Revoking…" : "Log out other sessions"}
          </button>
        </div>
        <div className="account-session-list">
          {sessions.map((session) => (
            <div key={session.id} className="account-session-row">
              <div>
                <strong>{session.device}</strong>
                <span>{session.current ? "Current session" : `Last activity ${formatDate(session.lastUsedAt)}`}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleRevokeSession(session)}
                disabled={busyAction !== null}
              >
                {busyAction === `session:${session.id}` ? "…" : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {profile.authProvider === "PASSWORD" ? (
        <form className="account-settings-form" onSubmit={handleChangePassword}>
        <strong>Change password</strong>
        <label htmlFor="current-password">Current password</label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
          disabled={busyAction !== null}
        />
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          disabled={busyAction !== null}
        />
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          required
          disabled={busyAction !== null}
        />
        <button type="submit" className="account-settings-danger" disabled={busyAction !== null}>
          {busyAction === "change-password" ? "Updating…" : "Change password"}
        </button>
      </form>
      ) : (
        <p className="account-settings-hint">Password changes are managed by Google for this account.</p>
      )}
    </section>
  );
}

export default AccountSettingsPanel;
