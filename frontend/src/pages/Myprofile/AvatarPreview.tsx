import { useEffect, useState } from "react";
import type { AuthUser } from "../../auth/authTypes";
import { getInitials } from "../../auth/authUtils";
import { getLocalAvatarOption, getSafeGoogleAvatarUrl } from "../../auth/avatarCatalog";
import "./AvatarPreview.css";

type AvatarPreviewProps = {
  user: AuthUser & { googleAvatarUrl?: string | null };
  className?: string;
};

/*
 * The Google picture is only rendered when the shared catalogue rules accept the
 * URL, and a load failure falls back to the safe local avatar rather than
 * leaving a broken image. The rules themselves live in `avatarCatalog` so every
 * surface that offers the Google option applies exactly the same validation.
 */
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
