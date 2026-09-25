const {
  USER_ROLES,
  ACCOUNT_STATUSES,
  GOOGLE_PROVIDER,
} = require('../models/User');
const {
  AVATAR_TYPES,
  DEFAULT_LOCAL_AVATAR_ID,
  GOOGLE_AVATAR_VALUE,
  isAllowedLocalAvatarId,
} = require('../config/avatar');
const { getTrustedGooglePictureUrl } = require('./profileValidation');

function getGoogleIdentity(user, source) {
  if (user && typeof user === 'object' && user.google) {
    return user.google;
  }

  return source && source.google ? source.google : null;
}

function getSafeAvatar(sourceAvatar, googlePictureUrl) {
  const requestedType = sourceAvatar && sourceAvatar.type;
  const useGoogle = requestedType === AVATAR_TYPES.GOOGLE && Boolean(googlePictureUrl);
  const type = useGoogle ? AVATAR_TYPES.GOOGLE : AVATAR_TYPES.LOCAL;
  const requestedValue = sourceAvatar && sourceAvatar.value;
  const value = useGoogle
    ? GOOGLE_AVATAR_VALUE
    : isAllowedLocalAvatarId(requestedValue)
      ? requestedValue
      : DEFAULT_LOCAL_AVATAR_ID;

  return { type, value };
}

function toSafeUser(user) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const id = source._id || source.id;
  const googleIdentity = getGoogleIdentity(user, source);
  const googlePictureUrl = getTrustedGooglePictureUrl(
    googleIdentity && googleIdentity.pictureUrl,
  );
  const avatar = getSafeAvatar(source.avatar, googlePictureUrl);
  const hasUsername = typeof source.username === 'string' && source.username.length > 0;

  return {
    id: id ? String(id) : null,
    email: typeof source.email === 'string' ? source.email : '',
    name: typeof source.name === 'string' ? source.name : '',
    username: hasUsername ? source.username : null,
    displayName: typeof source.displayName === 'string'
      ? source.displayName
      : typeof source.name === 'string' ? source.name : '',
    avatar,
    avatarSource: avatar.type,
    googleAvatarAvailable: Boolean(googlePictureUrl),
    googleAvatarUrl: googlePictureUrl || null,
    authProvider: (
      googleIdentity && googleIdentity.provider === GOOGLE_PROVIDER
    ) || source.authProvider === 'GOOGLE'
      ? 'GOOGLE'
      : 'PASSWORD',
    usernameSetupRequired: !hasUsername,
    role: source.role === USER_ROLES.ADMIN ? USER_ROLES.ADMIN : USER_ROLES.USER,
    status: Object.values(ACCOUNT_STATUSES).includes(source.status)
      ? source.status
      : ACCOUNT_STATUSES.ACTIVE,
    emailVerified: Boolean(source.emailVerified),
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || null,
    lastLoginAt: source.lastLoginAt || null,
  };
}

function toAccountProfile(user) {
  const safeUser = toSafeUser(user);
  if (!safeUser) {
    return null;
  }

  return {
    ...safeUser,
    googleAvatarUrl: safeUser.googleAvatarUrl,
  };
}

module.exports = {
  toSafeUser,
  toAccountProfile,
};
