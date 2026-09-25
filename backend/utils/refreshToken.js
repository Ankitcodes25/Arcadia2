const crypto = require('node:crypto');

const REFRESH_TOKEN_PREFIX = 'arc_rt_';
const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_PATTERN = /^arc_rt_[A-Za-z0-9_-]{43}$/;
const REFRESH_TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/i;

function generateRefreshToken() {
  return `${REFRESH_TOKEN_PREFIX}${crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')}`;
}

function isValidRefreshToken(token) {
  return typeof token === 'string' && REFRESH_TOKEN_PATTERN.test(token);
}

function hashRefreshToken(token) {
  if (!isValidRefreshToken(token)) {
    throw new Error('Invalid refresh token');
  }

  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function verifyRefreshTokenHash(token, expectedHash) {
  if (!isValidRefreshToken(token) || !REFRESH_TOKEN_HASH_PATTERN.test(expectedHash || '')) {
    return false;
  }

  const actualHash = Buffer.from(hashRefreshToken(token), 'hex');
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  return actualHash.length === expectedHashBuffer.length
    && crypto.timingSafeEqual(actualHash, expectedHashBuffer);
}

module.exports = {
  REFRESH_TOKEN_PREFIX,
  REFRESH_TOKEN_BYTES,
  generateRefreshToken,
  isValidRefreshToken,
  hashRefreshToken,
  verifyRefreshTokenHash,
};
