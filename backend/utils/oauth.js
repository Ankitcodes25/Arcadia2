const crypto = require('node:crypto');

const OAUTH_STATE_PREFIX = 'arc_state_';
const OAUTH_HANDOFF_PREFIX = 'arc_handoff_';
const OAUTH_VALUE_BYTES = 32;
const OAUTH_STATE_PATTERN = /^arc_state_[A-Za-z0-9_-]{43}$/;
const OAUTH_HANDOFF_PATTERN = /^arc_handoff_[A-Za-z0-9_-]{43}$/;
const OAUTH_CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const OAUTH_HASH_PATTERN = /^[a-f0-9]{64}$/i;

function generateOauthValue(prefix) {
  return `${prefix}${crypto.randomBytes(OAUTH_VALUE_BYTES).toString('base64url')}`;
}

function generateOAuthState() {
  return generateOauthValue(OAUTH_STATE_PREFIX);
}

function generateOAuthHandoffCode() {
  return generateOauthValue(OAUTH_HANDOFF_PREFIX);
}

function generateOAuthCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateOAuthNonce() {
  return crypto.randomBytes(32).toString('base64url');
}

function isValidOAuthCodeVerifier(value) {
  return typeof value === 'string' && OAUTH_CODE_VERIFIER_PATTERN.test(value);
}

function derivePkceChallenge(codeVerifier) {
  if (!isValidOAuthCodeVerifier(codeVerifier)) {
    throw new Error('Invalid PKCE code verifier');
  }

  return crypto.createHash('sha256').update(codeVerifier, 'utf8').digest('base64url');
}

function isValidOAuthState(value) {
  return typeof value === 'string' && OAUTH_STATE_PATTERN.test(value);
}

function isValidOAuthHandoffCode(value) {
  return typeof value === 'string' && OAUTH_HANDOFF_PATTERN.test(value);
}

function hashOAuthValue(value) {
  if (typeof value !== 'string' || !value) {
    throw new Error('Invalid OAuth value');
  }

  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function verifyOAuthValue(value, expectedHash) {
  if (typeof value !== 'string' || !OAUTH_HASH_PATTERN.test(expectedHash || '')) {
    return false;
  }

  const actualHash = Buffer.from(hashOAuthValue(value), 'hex');
  const expectedHashBuffer = Buffer.from(expectedHash, 'hex');

  return actualHash.length === expectedHashBuffer.length
    && crypto.timingSafeEqual(actualHash, expectedHashBuffer);
}

module.exports = {
  OAUTH_STATE_PREFIX,
  OAUTH_HANDOFF_PREFIX,
  generateOAuthState,
  generateOAuthHandoffCode,
  generateOAuthCodeVerifier,
  generateOAuthNonce,
  isValidOAuthCodeVerifier,
  derivePkceChallenge,
  isValidOAuthState,
  isValidOAuthHandoffCode,
  hashOAuthValue,
  verifyOAuthValue,
};
