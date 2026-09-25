const DISPLAY_NAME_MAX_LENGTH = 80;
const GOOGLE_PICTURE_URL_MAX_LENGTH = 2048;
const GOOGLE_IMAGE_HOSTS = Object.freeze([
  'googleusercontent.com',
  'gstatic.com',
]);

function normalizeDisplayName(value) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ')
    : '';
}

function getDisplayNameValidationError(value) {
  if (typeof value !== 'string') {
    return 'Display name must be text';
  }

  if (/[\u0000-\u001F\u007F]/.test(value) || /\p{Cf}/u.test(value)) {
    return 'Display name contains invalid characters';
  }

  const normalized = normalizeDisplayName(value);
  if (normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`;
  }

  // Angle brackets and control characters are rejected rather than escaped in
  // profile text, keeping the stored value safe for every current and future UI.
  if (/[<>]/.test(normalized) || /[\u0000-\u001F\u007F]/.test(normalized)) {
    return 'Display name contains invalid characters';
  }

  return null;
}

function getTrustedGooglePictureUrl(value) {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.length > GOOGLE_PICTURE_URL_MAX_LENGTH
  ) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();
    const isGoogleImageHost = GOOGLE_IMAGE_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );

    if (
      url.protocol !== 'https:'
      || !isGoogleImageHost
      || url.port
      || url.username
      || url.password
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

module.exports = {
  DISPLAY_NAME_MAX_LENGTH,
  GOOGLE_PICTURE_URL_MAX_LENGTH,
  normalizeDisplayName,
  getDisplayNameValidationError,
  getTrustedGooglePictureUrl,
};
