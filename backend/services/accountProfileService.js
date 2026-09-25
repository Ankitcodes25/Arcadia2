const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  User,
  ACCOUNT_STATUSES,
  GOOGLE_PROVIDER,
} = require('../models/User');
const { Session } = require('../models/Session');
const { toAccountProfile } = require('../utils/safeUser');
const {
  normalizeUsername,
  toDisplayUsername,
  getUsernameValidationError,
} = require('../utils/username');
const {
  normalizeDisplayName,
  getDisplayNameValidationError,
  getTrustedGooglePictureUrl,
} = require('../utils/profileValidation');
const {
  AVATAR_TYPES,
  GOOGLE_AVATAR_VALUE,
  isAllowedLocalAvatarId,
  isSupportedAvatarType,
} = require('../config/avatar');
const {
  getPasswordValidationError,
  getBcryptByteLengthError,
} = require('../utils/passwordPolicy');
const { hashPassword } = require('../utils/bcrypt');
const { PasswordResetToken } = require('../models/PasswordResetToken');
const {
  isValidRefreshToken,
  hashRefreshToken,
} = require('../utils/refreshToken');
const { revokeAllRefreshSessions } = require('./refreshSessionService');

const USERNAME_CHANGE_COOLDOWN_MS = 60 * 1000;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function isRequestObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function assertOnlyKeys(body, allowedKeys) {
  if (!isRequestObject(body)) {
    throw createError('Request body must be an object', 400);
  }

  const unexpectedKey = Object.keys(body).find((key) => !allowedKeys.includes(key));
  if (unexpectedKey) {
    throw createError('Request contains unsupported fields', 400);
  }
}

function parseObjectId(value, message = 'Invalid ID') {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) {
    throw createError(message, 400);
  }

  return new mongoose.Types.ObjectId(value).toString();
}

async function getProfile(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw createError('Account not found', 404);
  }

  return toAccountProfile(user);
}

async function getSettings(userId) {
  return getProfile(userId);
}

async function checkUsernameAvailability(username) {
  const validationError = getUsernameValidationError(username);
  if (validationError) {
    return { available: false };
  }

  const normalized = normalizeUsername(username);
  const existing = await User.exists({ usernameNormalized: normalized });
  return { available: !existing };
}

async function setUsername({ userId, body }) {
  assertOnlyKeys(body, ['username']);
  const { username } = body;
  const validationError = getUsernameValidationError(username);
  if (validationError) {
    throw createError(validationError, 400);
  }

  const normalized = normalizeUsername(username);
  const displayUsername = toDisplayUsername(username);
  const user = await User.findById(userId)
    .select('+usernameNormalized +usernameChangedAt');
  if (!user) {
    throw createError('Account not found', 404);
  }

  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw createError('Account is inactive', 403);
  }

  // The comparison value can be unchanged while the visible casing/spacing
  // still needs to be updated, so both forms have to match to be a no-op.
  if (user.usernameNormalized === normalized && user.username === displayUsername) {
    return toAccountProfile(user);
  }

  const now = new Date();
  if (
    user.usernameChangedAt
    && user.usernameChangedAt.getTime() > now.getTime() - USERNAME_CHANGE_COOLDOWN_MS
  ) {
    throw createError('Username can be changed once every 60 seconds', 429);
  }

  let updatedUser;
  try {
    updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        usernameNormalized: user.usernameNormalized || null,
      },
      {
        $set: {
          username: displayUsername,
          usernameNormalized: normalized,
          usernameChangedAt: now,
        },
      },
      { returnDocument: 'after' },
    ).select('+usernameNormalized +usernameChangedAt');
  } catch (error) {
    if (error && error.code === 11000) {
      throw createError('That username is already taken', 409);
    }
    throw error;
  }

  if (!updatedUser) {
    const latestUser = await User.findById(userId)
      .select('+usernameNormalized +usernameChangedAt');
    if (latestUser && latestUser.usernameNormalized === normalized) {
      return toAccountProfile(latestUser);
    }
    throw createError('Username changed concurrently; please retry', 409);
  }

  return toAccountProfile(updatedUser);
}

async function updateProfile({ userId, body }) {
  assertOnlyKeys(body, ['displayName']);
  if (!Object.prototype.hasOwnProperty.call(body, 'displayName')) {
    throw createError('Display name is required', 400);
  }

  const validationError = getDisplayNameValidationError(body.displayName);
  if (validationError) {
    throw createError(validationError, 400);
  }

  const displayName = normalizeDisplayName(body.displayName);
  const user = await User.findOneAndUpdate(
    { _id: userId, status: ACCOUNT_STATUSES.ACTIVE },
    { $set: { displayName } },
    { returnDocument: 'after' },
  );
  if (!user) {
    throw createError('Account not found', 404);
  }

  return toAccountProfile(user);
}

async function updateAvatar({ userId, body }) {
  assertOnlyKeys(body, ['type', 'value']);
  if (!isSupportedAvatarType(body.type)) {
    throw createError('Avatar type must be local or google', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError('Account not found', 404);
  }
  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw createError('Account is inactive', 403);
  }

  let avatar;
  if (body.type === AVATAR_TYPES.LOCAL) {
    if (!isAllowedLocalAvatarId(body.value)) {
      throw createError('Invalid local avatar', 400);
    }
    avatar = {
      type: AVATAR_TYPES.LOCAL,
      value: body.value,
    };
  } else {
    if (
      body.value !== undefined
      && body.value !== GOOGLE_AVATAR_VALUE
    ) {
      throw createError('Invalid Google avatar selection', 400);
    }

    const googlePictureUrl = getTrustedGooglePictureUrl(
      user.google && user.google.pictureUrl,
    );
    if (
      !user.google
      || user.google.provider !== GOOGLE_PROVIDER
      || !googlePictureUrl
    ) {
      throw createError('Google profile picture is unavailable', 400);
    }

    avatar = {
      type: AVATAR_TYPES.GOOGLE,
      value: GOOGLE_AVATAR_VALUE,
    };
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    { $set: { avatar } },
    { returnDocument: 'after' },
  );
  if (!updatedUser) {
    throw createError('Account not found', 404);
  }
  return toAccountProfile(updatedUser);
}

async function changePassword({ userId, body }) {
  assertOnlyKeys(body, ['currentPassword', 'newPassword']);
  const { currentPassword, newPassword } = body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw createError('Current and new passwords are required', 400);
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw createError('Account not found', 404);
  }
  if (!user.passwordHash) {
    throw createError('Password authentication is not configured for this account', 400);
  }

  const currentPasswordLengthError = getBcryptByteLengthError(currentPassword);
  if (currentPasswordLengthError) {
    throw createError('Current password is incorrect', 401);
  }

  const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentPasswordMatches) {
    throw createError('Current password is incorrect', 401);
  }

  const passwordError = getPasswordValidationError(newPassword);
  if (passwordError) {
    throw createError(passwordError, 400);
  }

  const passwordHash = await hashPassword(newPassword);
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      status: ACCOUNT_STATUSES.ACTIVE,
      tokenVersion: user.tokenVersion,
    },
    {
      $set: { passwordHash },
      $inc: { tokenVersion: 1 },
    },
    { returnDocument: 'after' },
  ).select('-passwordHash');

  if (!updatedUser) {
    throw createError('Account changed concurrently; please log in again', 409);
  }

  await revokeAllRefreshSessions(userId);
  await PasswordResetToken.updateMany(
    { userId, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );

  return { message: 'Password changed successfully. Please log in again.' };
}

function getDeviceLabel(userAgent) {
  if (typeof userAgent !== 'string' || !userAgent.trim()) {
    return 'Unknown device';
  }

  const value = userAgent.toLowerCase();
  const browser = value.includes('edg/')
    ? 'Edge'
    : value.includes('chrome/')
      ? 'Chrome'
      : value.includes('firefox/')
        ? 'Firefox'
        : value.includes('safari/')
          ? 'Safari'
          : 'Browser';
  const platform = value.includes('android')
    ? 'Android'
    : value.includes('iphone') || value.includes('ipad')
      ? 'iOS'
      : value.includes('mac os')
        ? 'macOS'
        : value.includes('windows')
          ? 'Windows'
          : value.includes('linux')
            ? 'Linux'
            : 'Unknown platform';

  return `${browser} on ${platform}`;
}

async function getCurrentSessionId(userId, currentRefreshToken) {
  if (!isValidRefreshToken(currentRefreshToken)) {
    return null;
  }

  const currentHash = hashRefreshToken(currentRefreshToken);
  const currentSession = await Session.findOne({
    userId,
    refreshTokenHash: currentHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('_id');

  return currentSession ? String(currentSession._id) : null;
}

function toSafeSession(session, currentSessionId) {
  return {
    id: String(session._id),
    createdAt: session.createdAt || null,
    lastUsedAt: session.lastUsedAt || null,
    expiresAt: session.expiresAt || null,
    current: String(session._id) === currentSessionId,
    device: getDeviceLabel(session.userAgent),
  };
}

async function listSessions({ userId, currentRefreshToken }) {
  const currentSessionId = await getCurrentSessionId(userId, currentRefreshToken);
  const sessions = await Session.find({
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select('+userAgent')
    .sort({ lastUsedAt: -1, createdAt: -1 });

  return sessions.map((session) => toSafeSession(session, currentSessionId));
}

async function revokeSession({ userId, sessionId, currentRefreshToken }) {
  const normalizedSessionId = parseObjectId(sessionId, 'Invalid session ID');
  const session = await Session.findOne({
    _id: normalizedSessionId,
    userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).select('_id');
  if (!session) {
    throw createError('Session not found', 404);
  }

  const currentSessionId = await getCurrentSessionId(userId, currentRefreshToken);
  const current = String(session._id) === currentSessionId;
  const result = await Session.updateOne(
    { _id: session._id, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  if (!result.matchedCount) {
    throw createError('Session not found', 404);
  }

  return {
    current,
    message: current
      ? 'Current session revoked. Please log in again.'
      : 'Session revoked',
  };
}

async function logoutOtherSessions({ userId, currentRefreshToken }) {
  const currentSessionId = await getCurrentSessionId(userId, currentRefreshToken);
  if (!currentSessionId) {
    throw createError('Current session not found', 400);
  }

  const result = await Session.updateMany(
    {
      userId,
      _id: { $ne: currentSessionId },
      revokedAt: null,
    },
    { $set: { revokedAt: new Date() } },
  );

  return {
    revokedCount: Number(result.modifiedCount || 0),
    message: 'Other sessions revoked',
  };
}

module.exports = {
  USERNAME_CHANGE_COOLDOWN_MS,
  getProfile,
  getSettings,
  checkUsernameAvailability,
  setUsername,
  updateProfile,
  updateAvatar,
  changePassword,
  listSessions,
  revokeSession,
  logoutOtherSessions,
};
