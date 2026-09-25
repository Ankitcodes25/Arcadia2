import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "../auth/authTypes";
import AccountSettingsPanel from "../auth/AccountSettingsPanel";
import AvatarPreview from "../auth/AvatarPreview";
import "./ProfilePopupmodal.css";

type ProfilePopupModalProps = {
  user: AuthUser;
  onClose: () => void;
  onLogout: () => void | Promise<unknown>;
  isLoggingOut: boolean;
};

const profileItems = [
  ["👤", "My Profile"],
  ["🏆", "Leaderboards"],
  ["⚙", "Settings"],
  ["?", "Help & Support"],
] as const;

function ProfilePopupModal({ user, onClose, onLogout, isLoggingOut }: ProfilePopupModalProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div ref={popupRef} className={`profile-popup ${settingsOpen ? "settings-open" : ""}`} role="menu" aria-label="Profile menu">
      <div className="profile-popup-header">
        <div className="profile-popup-identity">
          <span className="profile-popup-username">{user.username}</span>
          <AvatarPreview user={user} className="profile-popup-avatar" />
        </div>

        <div className="profile-popup-meta">
          <p className="profile-popup-email">{user.email} · {user.emailVerified ? "Verified" : "Not verified"}</p>
          <p className={`profile-popup-status status-${user.status.toLowerCase()}`}>Account Status: <strong>{user.status === "ACTIVE" ? "Active" : user.status}</strong></p>
        </div>
      </div>
      <nav className="profile-popup-nav">
        {profileItems.map(([icon, label]) => (
          <button
            key={label}
            type="button"
            className="profile-popup-item"
            role="menuitem"
            onClick={label === "Settings" ? () => setSettingsOpen(true) : onClose}
          >
            <span className="profile-popup-icon" aria-hidden="true">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className="profile-popup-item logout" role="menuitem" onClick={() => void onLogout()} disabled={isLoggingOut}>
          <span className="profile-popup-icon" aria-hidden="true">↪</span>
          <span>{isLoggingOut ? "Logging out…" : "Logout"}</span>
        </button>
      </nav>
      {settingsOpen && <AccountSettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default ProfilePopupModal;
