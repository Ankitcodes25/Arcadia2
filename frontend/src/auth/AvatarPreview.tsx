import { useEffect, useState } from "react";
import type { AuthUser } from "./authTypes";
import { getInitials } from "./authUtils";
import { getLocalAvatarOption } from "./avatarCatalog";
import "./AvatarPreview.css";

type AvatarPreviewProps = {
  user: AuthUser & { googleAvatarUrl?: string | null };
  className?: string;
};

function getSafeGoogleAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const trusted = ["googleusercontent.com", "gstatic.com"].some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
    if (url.protocol !== "https:" || !trusted || url.username || url.password || url.port) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function AvatarPreview({ user, className = "" }: AvatarPreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const googleUrl = getSafeGoogleAvatarUrl(user.googleAvatarUrl);
  const useGoogleImage = user.avatar.type === "google" && Boolean(googleUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [googleUrl, user.avatar.type, user.avatar.value]);

  if (useGoogleImage) {
    return (
      <img
        className={`avatar-preview-image ${className}`.trim()}
        src={googleUrl || ""}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
      />
    );
  }

  const localAvatar = getLocalAvatarOption(user.avatar.value);
  return (
    <span
      className={`avatar-preview-placeholder ${localAvatar.className} ${className}`.trim()}
      style={{ background: localAvatar.background }}
      aria-label={`${localAvatar.label} avatar`}
      role="img"
    >
      {getInitials(user)}
    </span>
  );
}

export default AvatarPreview;
