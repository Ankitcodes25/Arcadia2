const { EmailVerificationToken } = require('../models/EmailVerificationToken');
const { PasswordResetToken } = require('../models/PasswordResetToken');
const { User, ACCOUNT_STATUSES, GOOGLE_PROVIDER } = require('../models/User');
const { Session } = require('../models/Session');
const normalizeEmail = require('../utils/normalizeEmail');
const {
  generateVerificationToken,
  generatePasswordResetToken,
  isValidSecureToken,
  hashSecureToken,
  verifySecureTokenHash,
} = require('../utils/secureToken');
const { getPasswordValidationError } = require('../utils/passwordPolicy');
const { hashPassword } = require('../utils/bcrypt');
const emailService = require('./emailService');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;
const GENERIC_VERIFICATION_MESSAGE = 'If the account is eligible, a verification email has been sent.';
const GENERIC_RESET_MESSAGE = 'If the account is eligible, a password reset email has been sent.';

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
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw createError('Request contains unsupported fields', 400);
  }
}

async function issueVerificationForUser(userId) {
  await EmailVerificationToken.init();
  const now = new Date();
  const cutoff = new Date(now.getTime() - VERIFICATION_RESEND_COOLDOWN_MS);
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      status: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: { $ne: true },
      'google.provider': { $ne: GOOGLE_PROVIDER },
      $or: [
        { verificationEmailRequestedAt: null },
        { verificationEmailRequestedAt: { $exists: false } },
        { verificationEmailRequestedAt: { $lte: cutoff } },
      ],
    },
    { $set: { verificationEmailRequestedAt: now } },
    { returnDocument: 'after' },
  );

  if (!user) {
    return { sent: false, reason: 'not_eligible' };
  }

  await EmailVerificationToken.updateMany(
    { userId, consumedAt: null },
    { $set: { consumedAt: now } },
  );

  const rawToken = generateVerificationToken();
  await EmailVerificationToken.create({
    userId,
    tokenHash: hashSecureToken(rawToken),
    expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
  });

  let delivery = { sent: false, reason: 'delivery_failed' };
  try {
    delivery = await emailService.sendVerificationEmail({ to: user.email, token: rawToken });
  } catch {
    delivery = { sent: false, reason: 'delivery_failed' };
  }

  return {
    sent: Boolean(delivery && delivery.sent === true),
    reason: delivery && delivery.reason ? delivery.reason : 'delivery_failed',
  };
}

async function verifyEmailToken(rawToken) {
  if (!isValidSecureToken(rawToken) || !rawToken.startsWith('arc_verify_')) {
    throw createError('Invalid or expired verification token', 400);
  }

  const now = new Date();
  const tokenRecord = await EmailVerificationToken.findOneAndUpdate(
    {
      tokenHash: hashSecureToken(rawToken),
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { returnDocument: 'after' },
  ).select('+tokenHash');

  if (!tokenRecord || !verifySecureTokenHash(rawToken, tokenRecord.tokenHash)) {
    throw createError('Invalid or expired verification token', 400);
  }

  const user = await User.findById(tokenRecord.userId);
  if (!user) {
    throw createError('Invalid or expired verification token', 400);
  }
  if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw createError('Account is inactive', 403);
  }

  if (!user.emailVerified) {
    await User.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
  }

  return { message: 'Email verified successfully.' };
}

async function resendVerification(email, body) {
  if (body !== undefined) assertOnlyKeys(body, ['email']);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizeEmail.isValidEmail(normalizedEmail)) {
    return { message: GENERIC_VERIFICATION_MESSAGE };
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user || user.status !== ACCOUNT_STATUSES.ACTIVE || user.emailVerified || user.google?.provider === GOOGLE_PROVIDER) {
    return { message: GENERIC_VERIFICATION_MESSAGE };
  }

  await issueVerificationForUser(user._id);
  return { message: GENERIC_VERIFICATION_MESSAGE };
}

async function issuePasswordResetForUser(userId) {
  await PasswordResetToken.init();
  const now = new Date();
  const cutoff = new Date(now.getTime() - RESET_REQUEST_COOLDOWN_MS);
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      status: ACCOUNT_STATUSES.ACTIVE,
      passwordHash: { $exists: true, $ne: null },
      'google.provider': { $ne: GOOGLE_PROVIDER },
      $or: [
        { passwordResetRequestedAt: null },
        { passwordResetRequestedAt: { $exists: false } },
        { passwordResetRequestedAt: { $lte: cutoff } },
      ],
    },
    { $set: { passwordResetRequestedAt: now } },
    { returnDocument: 'after' },
  );

  if (!user) {
    return { sent: false, reason: 'not_eligible' };
  }

  await PasswordResetToken.updateMany(
    { userId, consumedAt: null },
    { $set: { consumedAt: now } },
  );

  const rawToken = generatePasswordResetToken();
  await PasswordResetToken.create({
    userId,
    tokenHash: hashSecureToken(rawToken),
    credentialVersion: user.tokenVersion,
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  });

  let delivery = { sent: false, reason: 'delivery_failed' };
  try {
    delivery = await emailService.sendPasswordResetEmail({ to: user.email, token: rawToken });
  } catch {
    delivery = { sent: false, reason: 'delivery_failed' };
  }

  return {
    sent: Boolean(delivery && delivery.sent === true),
    reason: delivery && delivery.reason ? delivery.reason : 'delivery_failed',
  };
}

async function forgotPassword(email, body) {
  if (body !== undefined) assertOnlyKeys(body, ['email']);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizeEmail.isValidEmail(normalizedEmail)) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  if (!user || user.status !== ACCOUNT_STATUSES.ACTIVE || !user.passwordHash || user.google?.provider === GOOGLE_PROVIDER) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  await issuePasswordResetForUser(user._id);
  return { message: GENERIC_RESET_MESSAGE };
}

async function resetPassword({ token, password, body } = {}) {
  if (body !== undefined) assertOnlyKeys(body, ['token', 'password']);
  if (!isValidSecureToken(token) || !token.startsWith('arc_reset_')) {
    throw createError('Invalid or expired password reset token', 400);
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    throw createError(passwordError, 400);
  }

  const now = new Date();
  const tokenRecord = await PasswordResetToken.findOneAndUpdate(
    {
      tokenHash: hashSecureToken(token),
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { returnDocument: 'after' },
  ).select('+tokenHash');

  if (!tokenRecord || !verifySecureTokenHash(token, tokenRecord.tokenHash)) {
    throw createError('Invalid or expired password reset token', 400);
  }

  const user = await User.findById(tokenRecord.userId).select('+passwordHash');
  if (
    !user
    || user.status !== ACCOUNT_STATUSES.ACTIVE
    || !user.passwordHash
    || user.google?.provider === GOOGLE_PROVIDER
    || !Number.isSafeInteger(user.tokenVersion)
    || user.tokenVersion !== tokenRecord.credentialVersion
  ) {
    throw createError('Invalid or expired password reset token', 400);
  }

  const passwordHash = await hashPassword(password);
  await User.updateOne(
    { _id: user._id },
    {
      $set: { passwordHash },
      $inc: { tokenVersion: 1 },
    },
  );
  await Session.updateMany(
    { userId: user._id, revokedAt: null },
    {
      $set: { revokedAt: now },
      $unset: { rotationClaimId: 1, rotationClaimExpiresAt: 1 },
    },
  );
  await PasswordResetToken.updateMany(
    { userId: user._id, consumedAt: null },
    { $set: { consumedAt: now } },
  );

  return { message: 'Password reset successfully. You can now log in.' };
}

module.exports = {
  VERIFICATION_TOKEN_TTL_MS,
  RESET_TOKEN_TTL_MS,
  VERIFICATION_RESEND_COOLDOWN_MS,
  RESET_REQUEST_COOLDOWN_MS,
  GENERIC_VERIFICATION_MESSAGE,
  GENERIC_RESET_MESSAGE,
  issueVerificationForUser,
  verifyEmailToken,
  resendVerification,
  issuePasswordResetForUser,
  forgotPassword,
  resetPassword,
};
