const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { Session } = require('../models/Session');
const { User, ACCOUNT_STATUSES } = require('../models/User');
const {
  generateRefreshToken,
  hashRefreshToken,
  isValidRefreshToken,
  verifyRefreshTokenHash,
} = require('../utils/refreshToken');
const { signAccessToken } = require('../utils/jwt');
const { REFRESH_TOKEN_TTL_MS } = require('../config/refreshCookie');

const ROTATION_CLAIM_TTL_MS = 10 * 1000;

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

function getRequestMetadata(req) {
  const ip = typeof req?.ip === 'string' ? req.ip.trim().slice(0, 64) : null;
  const userAgent = typeof req?.get === 'function'
    ? (req.get('user-agent') || '').trim().slice(0, 512)
    : null;

  return {
    ip: ip || null,
    userAgent: userAgent || null,
  };
}

function isValidCredentialVersion(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function getFamilyExpiry(familyExpiresAt) {
  if (familyExpiresAt instanceof Date && !Number.isNaN(familyExpiresAt.getTime())) {
    return familyExpiresAt;
  }
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}

async function createRefreshSession({
  userId,
  req,
  familyId = crypto.randomUUID(),
  credentialVersion,
  familyExpiresAt,
}) {
  await Session.init();

  const user = await User.findById(userId).select('tokenVersion status');
  if (!user || user.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw createError('Account is inactive', 403);
  }
  if (!isValidCredentialVersion(user.tokenVersion)) {
    throw createError('Invalid account security version', 401);
  }

  let resolvedVersion = credentialVersion;
  if (!isValidCredentialVersion(resolvedVersion)) {
    resolvedVersion = user.tokenVersion;
  }
  if (resolvedVersion !== user.tokenVersion) {
    throw createError('Invalid account security version', 401);
  }

  if (!isValidCredentialVersion(resolvedVersion)) {
    throw createError('Invalid account security version', 401);
  }

  const now = new Date();
  const absoluteExpiry = getFamilyExpiry(familyExpiresAt);
  const slidingExpiry = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const expiresAt = absoluteExpiry < slidingExpiry ? absoluteExpiry : slidingExpiry;
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await Session.create({
    userId,
    refreshTokenHash,
    familyId,
    credentialVersion: resolvedVersion,
    familyExpiresAt: absoluteExpiry,
    expiresAt,
    ...getRequestMetadata(req),
  });

  return { session, refreshToken };
}

async function findSessionByRefreshToken(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return null;
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  return Session.findOne({ refreshTokenHash })
    .select('+refreshTokenHash +rotationClaimId +rotationClaimExpiresAt +rotatedAt');
}

async function revokeFamily(familyId) {
  if (!familyId) {
    return;
  }

  await Session.updateMany(
    { familyId, revokedAt: null },
    {
      $set: { revokedAt: new Date() },
      $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 },
    },
  );
}

function hasActiveRotationClaim(session, now) {
  return Boolean(
    session?.rotationClaimId
    && session?.rotationClaimExpiresAt instanceof Date
    && session.rotationClaimExpiresAt > now
  );
}

async function releaseRotationClaim({ sessionId, claimId }) {
  if (!sessionId || !claimId) {
    return;
  }

  await Session.updateOne(
    { _id: sessionId, rotationClaimId: claimId },
    { $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 } },
  ).catch(() => {});
}

async function handleUnavailableClaim(currentSession, now) {
  if (currentSession?.expiresAt && currentSession.expiresAt <= now) {
    await revokeFamily(currentSession.familyId);
    throw createError('Refresh token expired', 401);
  }

  if (hasActiveRotationClaim(currentSession, now)) {
    // A second request that overlaps a legitimate rotation must not revoke the
    // winner's replacement session as if it were stolen-token reuse.
    throw createError('Invalid refresh token', 401);
  }

  if (currentSession?.revokedAt) {
    await revokeFamily(currentSession.familyId);
    throw createError('Refresh token reuse detected', 401);
  }

  throw createError('Invalid refresh token', 401);
}

async function rotateRefreshSession({ refreshToken, req }) {
  if (!isValidRefreshToken(refreshToken)) {
    throw createError('Invalid refresh token', 401);
  }

  const currentSession = await findSessionByRefreshToken(refreshToken);
  if (!currentSession) {
    throw createError('Invalid refresh token', 401);
  }

  if (!verifyRefreshTokenHash(refreshToken, currentSession.refreshTokenHash)) {
    throw createError('Invalid refresh token', 401);
  }

  const now = new Date();
  if (
    currentSession.revokedAt
    || currentSession.expiresAt <= now
    || (currentSession.familyExpiresAt && currentSession.familyExpiresAt <= now)
  ) {
    await handleUnavailableClaim(currentSession, now);
  }

  if (!isValidCredentialVersion(currentSession.credentialVersion)) {
    await revokeFamily(currentSession.familyId);
    throw createError('Invalid refresh token', 401);
  }

  const user = await User.findById(currentSession.userId).select('-passwordHash');
  if (!user) {
    await revokeFamily(currentSession.familyId);
    throw createError('Invalid refresh token', 401);
  }

  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    await revokeFamily(currentSession.familyId);
    throw createError('Account is inactive', 403);
  }

  if (
    !isValidCredentialVersion(user.tokenVersion)
    || user.tokenVersion !== currentSession.credentialVersion
  ) {
    await revokeFamily(currentSession.familyId);
    throw createError('Invalid refresh token', 401);
  }

  const claimId = crypto.randomUUID();
  const claimExpiresAt = new Date(now.getTime() + ROTATION_CLAIM_TTL_MS);
  const replacementId = new mongoose.Types.ObjectId();
  const claimedSession = await Session.findOneAndUpdate(
    {
      _id: currentSession._id,
      refreshTokenHash: currentSession.refreshTokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
      $and: [
        {
          $or: [
            { familyExpiresAt: { $gt: now } },
            { familyExpiresAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { rotationClaimId: null },
            { rotationClaimExpiresAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        rotationClaimId: claimId,
        rotationClaimExpiresAt: claimExpiresAt,
        lastUsedAt: now,
      },
    },
    { returnDocument: 'after' },
  ).select('+rotationClaimId +rotationClaimExpiresAt +rotatedAt');

  if (!claimedSession) {
    const latestSession = await Session.findById(currentSession._id)
      .select('+refreshTokenHash +rotationClaimId +rotationClaimExpiresAt +rotatedAt');
    await handleUnavailableClaim(latestSession, new Date());
  }

  const replacementToken = generateRefreshToken();
  const replacementTokenHash = hashRefreshToken(replacementToken);
  const markedSession = await Session.findOneAndUpdate(
    {
      _id: currentSession._id,
      rotationClaimId: claimId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: now,
        rotatedAt: now,
        replacedBySessionId: replacementId,
        lastUsedAt: now,
      },
    },
    { returnDocument: 'after' },
  ).select('+rotationClaimId +rotationClaimExpiresAt +rotatedAt');

  if (!markedSession) {
    await releaseRotationClaim({ sessionId: currentSession._id, claimId });
    await revokeFamily(currentSession.familyId);
    throw createError('Invalid refresh token', 401);
  }

  let replacementSession;
  try {
    replacementSession = await Session.create({
      _id: replacementId,
      userId: user._id,
      refreshTokenHash: replacementTokenHash,
      familyId: currentSession.familyId,
      credentialVersion: currentSession.credentialVersion,
      familyExpiresAt: currentSession.familyExpiresAt,
      expiresAt: currentSession.expiresAt,
      ...getRequestMetadata(req),
    });
  } catch (error) {
    await Session.findOneAndUpdate(
      {
        _id: currentSession._id,
        rotationClaimId: claimId,
        revokedAt: now,
      },
      {
        $set: { revokedAt: null, rotatedAt: null, replacedBySessionId: null },
        $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 },
      },
    );
    throw error;
  }

  const currentUser = await User.findOne({
    _id: user._id,
    tokenVersion: currentSession.credentialVersion,
    status: ACCOUNT_STATUSES.ACTIVE,
  }).select('-passwordHash');

  if (!currentUser) {
    await Session.updateOne(
      { _id: replacementSession._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    await revokeFamily(currentSession.familyId);
    throw createError('Invalid refresh token', 401);
  }

  return {
    user: currentUser,
    accessToken: signAccessToken(currentUser),
    refreshToken: replacementToken,
    session: replacementSession,
    rotationClaim: {
      sessionId: currentSession._id,
      claimId,
    },
  };
}

async function revokeRefreshToken(refreshToken) {
  if (!isValidRefreshToken(refreshToken)) {
    return false;
  }

  const refreshTokenHash = hashRefreshToken(refreshToken);
  const session = await Session.findOne({ refreshTokenHash }).select('_id revokedAt');
  if (!session) {
    return false;
  }

  if (!session.revokedAt) {
    await Session.updateOne(
      { _id: session._id, revokedAt: null },
      {
        $set: { revokedAt: new Date() },
        $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 },
      },
    );
  }

  return true;
}

async function revokeAllRefreshSessions(userId) {
  await Session.updateMany(
    { userId, revokedAt: null },
    {
      $set: { revokedAt: new Date() },
      $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 },
    },
  );
}

module.exports = {
  ROTATION_CLAIM_TTL_MS,
  createRefreshSession,
  rotateRefreshSession,
  releaseRotationClaim,
  revokeRefreshToken,
  revokeAllRefreshSessions,
};
