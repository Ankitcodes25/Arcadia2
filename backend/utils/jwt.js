const crypto = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const { USER_ROLES } = require('../models/User');

const ACCESS_TOKEN_ALGORITHM = 'HS256';
const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_TYPE = 'access';
const ACCESS_TOKEN_ISSUER = 'arcadia-backend';
const ACCESS_TOKEN_AUDIENCE = 'arcadia-web';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getUserId(user) {
  const id = user && (user._id || user.id);
  const normalized = id ? String(id) : '';

  if (!mongoose.isValidObjectId(normalized)) {
    throw new Error('Cannot sign a token without a valid user id');
  }

  return normalized;
}

function getUserRole(user) {
  return user && user.role === USER_ROLES.ADMIN
    ? USER_ROLES.ADMIN
    : USER_ROLES.USER;
}

function getUserTokenVersion(user) {
  const tokenVersion = user && user.tokenVersion;
  if (tokenVersion === undefined) {
    return 0;
  }

  if (!Number.isSafeInteger(tokenVersion) || tokenVersion < 0) {
    throw new Error('Cannot sign a token with an invalid token version');
  }

  return tokenVersion;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: getUserId(user),
      role: getUserRole(user),
      type: ACCESS_TOKEN_TYPE,
      tokenVersion: getUserTokenVersion(user),
    },
    jwtSecret,
    {
      algorithm: ACCESS_TOKEN_ALGORITHM,
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      jwtid: crypto.randomUUID(),
    },
  );
}

function verifyAccessToken(token) {
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Token is required');
  }

  const payload = jwt.verify(token, jwtSecret, {
    algorithms: [ACCESS_TOKEN_ALGORITHM],
    issuer: ACCESS_TOKEN_ISSUER,
    audience: ACCESS_TOKEN_AUDIENCE,
  });

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid token payload');
  }

  if (payload.type !== ACCESS_TOKEN_TYPE) {
    throw new Error('Invalid token type');
  }

  if (
    typeof payload.sub !== 'string'
    || !mongoose.isValidObjectId(payload.sub)
    || Object.prototype.hasOwnProperty.call(payload, 'id')
  ) {
    throw new Error('Invalid token subject');
  }

  if (!Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 0) {
    throw new Error('Invalid token version');
  }

  if (![USER_ROLES.USER, USER_ROLES.ADMIN].includes(payload.role)) {
    throw new Error('Invalid token role');
  }

  if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
    throw new Error('Invalid token timestamps');
  }

  if (typeof payload.jti !== 'string' || !UUID_PATTERN.test(payload.jti)) {
    throw new Error('Invalid token identifier');
  }

  return payload;
}

module.exports = {
  ACCESS_TOKEN_ALGORITHM,
  ACCESS_TOKEN_TTL,
  ACCESS_TOKEN_TYPE,
  ACCESS_TOKEN_ISSUER,
  ACCESS_TOKEN_AUDIENCE,
  signAccessToken,
  verifyAccessToken,
};
