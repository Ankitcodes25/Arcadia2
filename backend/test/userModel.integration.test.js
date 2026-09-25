const { after, afterEach, before, beforeEach, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { once } = require('node:events');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let mongoose;
let User;
let USER_ROLES;
let ACCOUNT_STATUSES;
let GOOGLE_PROVIDER;
let authService;
let provisionAdmin;
let toSafeUser;
let connectDatabase;
let disconnectDatabase;
let validateEnvironment;
let createApp;
let signAccessToken;
let verifyAccessToken;
let Session;
let generateRefreshToken;
let hashRefreshToken;
let verifyRefreshTokenHash;
let isValidRefreshToken;
let hashSecureToken;
let REFRESH_COOKIE_NAME;
let OAuthState;
let OAuthHandoff;
let EmailVerificationToken;
let PasswordResetToken;
let RateLimitBucket;
let AdminMutationLock;
let accountActionService;
let accountProfileService;
let emailService;
let LOCAL_AVATAR_IDS;
let USERNAME_CHANGE_COOLDOWN_MS;
let getUsernameLength;
let getUsernameValidationError;
let normalizeUsername;
let toDisplayUsername;
let RESERVED_USERNAMES;
let emailMessages;
let googleOAuthService;
let generateOAuthState;
let generateOAuthHandoffCode;
let generateOAuthCodeVerifier;
let derivePkceChallenge;
let isValidOAuthCodeVerifier;
let hashOAuthValue;
let isValidOAuthState;
let isValidOAuthHandoffCode;
let OAUTH_STATE_COOKIE_NAME;
let googleMockPayload;
let googleMockRequests;

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoServer.getUri('arcadia_test');
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.FRONTEND_URL = 'http://localhost:5173';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/v1/auth/google/callback';
  process.env.GOOGLE_FRONTEND_SUCCESS_URL = 'http://localhost:5173/oauth/success';
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_FROM = 'test@example.com';
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'test-user';
  process.env.SMTP_PASSWORD = 'test-password';
  process.env.FRONTEND_EMAIL_VERIFICATION_URL = 'http://localhost:5173/';
  process.env.FRONTEND_PASSWORD_RESET_URL = 'http://localhost:5173/';

  mongoose = require('mongoose');
  ({ User, USER_ROLES, ACCOUNT_STATUSES, GOOGLE_PROVIDER } = require('../models/User'));
  authService = require('../services/authService');
  ({ provisionAdmin } = require('../services/adminProvisioner'));
  ({ toSafeUser } = require('../utils/safeUser'));
  ({ connectDatabase, disconnectDatabase } = require('../config/database'));
  ({ validateEnvironment } = require('../config/env'));
  createApp = require('../app');
  ({ signAccessToken, verifyAccessToken } = require('../utils/jwt'));
  ({ Session } = require('../models/Session'));
  ({ generateRefreshToken, hashRefreshToken, verifyRefreshTokenHash, isValidRefreshToken } = require('../utils/refreshToken'));
  ({ hashSecureToken } = require('../utils/secureToken'));
  ({ REFRESH_COOKIE_NAME } = require('../config/refreshCookie'));
  ({ OAuthState } = require('../models/OAuthState'));
  ({ OAuthHandoff } = require('../models/OAuthHandoff'));
  ({ EmailVerificationToken } = require('../models/EmailVerificationToken'));
  ({ PasswordResetToken } = require('../models/PasswordResetToken'));
  ({ RateLimitBucket } = require('../models/RateLimitBucket'));
  ({ AdminMutationLock } = require('../models/AdminMutationLock'));
  accountActionService = require('../services/accountActionService');
  accountProfileService = require('../services/accountProfileService');
  ({ LOCAL_AVATAR_IDS } = require('../config/avatar'));
  ({ USERNAME_CHANGE_COOLDOWN_MS } = accountProfileService);
  ({
    getUsernameLength,
    getUsernameValidationError,
    normalizeUsername,
    toDisplayUsername,
    RESERVED_USERNAMES,
  } = require('../utils/username'));
  emailService = require('../services/emailService');
  googleOAuthService = require('../services/googleOAuthService');
  ({
    generateOAuthState,
    generateOAuthHandoffCode,
    generateOAuthCodeVerifier,
    derivePkceChallenge,
    isValidOAuthCodeVerifier,
    hashOAuthValue,
    isValidOAuthState,
    isValidOAuthHandoffCode,
  } = require('../utils/oauth'));
  ({ OAUTH_STATE_COOKIE_NAME } = require('../config/oauthCookie'));

  await connectDatabase();
  await User.syncIndexes();
  await Session.syncIndexes();
  await OAuthState.syncIndexes();
  await OAuthHandoff.syncIndexes();
  await EmailVerificationToken.syncIndexes();
  await PasswordResetToken.syncIndexes();
  await RateLimitBucket.syncIndexes();
  await AdminMutationLock.syncIndexes();
});

after(async () => {
  if (disconnectDatabase) {
    await disconnectDatabase();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  await RateLimitBucket.deleteMany({});
  await AdminMutationLock.deleteMany({});
  await PasswordResetToken.deleteMany({});
  await EmailVerificationToken.deleteMany({});
  await OAuthHandoff.deleteMany({});
  await OAuthState.deleteMany({});
  await Session.deleteMany({});
  await User.deleteMany({});
  emailMessages = [];
  emailService.setEmailTransportForTests(async (message) => {
    emailMessages.push(message);
    return { sent: true };
  });
});

afterEach(() => {
  googleOAuthService.resetGoogleClientFactoryForTests();
  emailService.resetEmailTransportForTests();
});

async function startHttpServer() {
  const server = createApp().listen(0);
  await once(server, 'listening');
  return server;
}

function getServerUrl(server) {
  return `http://127.0.0.1:${server.address().port}`;
}

async function stopHttpServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function requestJson(server, path, options = {}) {
  const { csrfHeader = true, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  let body = fetchOptions.body;

  if (body !== undefined && typeof body !== 'string') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const method = (fetchOptions.method || 'GET').toUpperCase();
  if (csrfHeader && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['x-arcadia-request'] = '1';
  }

  const response = await fetch(`${getServerUrl(server)}${path}`, {
    ...fetchOptions,
    headers,
    body,
  });
  const text = await response.text();
  let parsedBody = null;

  if (text) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = text;
    }
  }

  return { response, body: parsedBody };
}

function getCookieValue(response, cookieName) {
  const setCookieHeader = response.headers.get('set-cookie') || '';
  const prefix = `${cookieName}=`;
  const start = setCookieHeader.indexOf(prefix);

  if (start < 0) {
    return null;
  }

  return setCookieHeader.slice(start + prefix.length).split(';')[0];
}

function getRefreshCookie(response) {
  return getCookieValue(response, REFRESH_COOKIE_NAME);
}

function getSetCookieHeader(response) {
  return response.headers.get('set-cookie') || '';
}

async function registerAndLogin(server, email = 'session@example.com') {
  const password = 'session-password-123';
  const registered = await requestJson(server, '/api/v1/auth/register', {
    method: 'POST',
    body: {
      name: 'Session User',
      email,
      password,
    },
  });
  const loggedIn = await requestJson(server, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return { registered, loggedIn, refreshCookie: getRefreshCookie(loggedIn.response) };
}

async function provisionAndLoginAdmin(
  server,
  email = 'admin@example.com',
  password = 'admin-password-123',
) {
  const provisioned = await provisionAdmin({
    name: 'Test Administrator',
    email,
    password,
  });
  const loggedIn = await requestJson(server, '/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return {
    admin: provisioned.user,
    loggedIn,
    token: loggedIn.body.token,
    refreshCookie: getRefreshCookie(loggedIn.response),
  };
}

function hashBootstrapTestRateLimitKey(route, identifier, windowStart) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`${route}\u0000${identifier}\u0000${windowStart}`, 'utf8')
    .digest('hex');
}

async function createBootstrapTestAuthRecords(user, email, suffix) {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const session = await Session.create({
    userId: user._id,
    refreshTokenHash: `bootstrap-refresh-${suffix}`,
    familyId: `bootstrap-family-${suffix}`,
    expiresAt,
  });
  const oauthHandoff = await OAuthHandoff.create({
    codeHash: `bootstrap-handoff-${suffix}`,
    userId: user._id,
    sessionId: session._id,
    expiresAt,
  });
  const passwordResetToken = await PasswordResetToken.create({
    userId: user._id,
    tokenHash: `bootstrap-reset-${suffix}`,
    expiresAt,
  });
  const emailVerificationToken = await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: `bootstrap-verification-${suffix}`,
    expiresAt,
  });
  const windowStart = Math.floor(Date.now() / (10 * 60 * 1000)) * (10 * 60 * 1000);
  const userRateLimit = await RateLimitBucket.create({
    keyHash: hashBootstrapTestRateLimitKey(
      'account:sessions:user',
      `user:${user._id}`,
      windowStart,
    ),
    route: 'account:sessions:user',
    windowStart,
    expiresAt: new Date(windowStart + 15 * 60 * 1000),
  });
  const emailRateLimit = await RateLimitBucket.create({
    keyHash: hashBootstrapTestRateLimitKey(
      'auth:login:email',
      `email:${email}`,
      windowStart,
    ),
    route: 'auth:login:email',
    windowStart,
    expiresAt: new Date(windowStart + 15 * 60 * 1000),
  });

  return {
    session,
    oauthHandoff,
    passwordResetToken,
    emailVerificationToken,
    userRateLimit,
    emailRateLimit,
  };
}

async function assertBootstrapAuthRecordsExist(userId, records) {
  assert.ok(await Session.findById(records.session._id));
  assert.ok(await OAuthHandoff.findById(records.oauthHandoff._id));
  assert.ok(await PasswordResetToken.findById(records.passwordResetToken._id));
  assert.ok(await EmailVerificationToken.findById(records.emailVerificationToken._id));
  assert.ok(await RateLimitBucket.findById(records.userRateLimit._id));
  assert.ok(await RateLimitBucket.findById(records.emailRateLimit._id));
  assert.equal(await Session.countDocuments({ userId }), 1);
  assert.equal(await OAuthHandoff.countDocuments({ userId }), 1);
  assert.equal(await PasswordResetToken.countDocuments({ userId }), 1);
  assert.equal(await EmailVerificationToken.countDocuments({ userId }), 1);
}

async function assertBootstrapAuthRecordsDeleted(userId, records) {
  assert.equal(await Session.findById(records.session._id), null);
  assert.equal(await OAuthHandoff.findById(records.oauthHandoff._id), null);
  assert.equal(await PasswordResetToken.findById(records.passwordResetToken._id), null);
  assert.equal(await EmailVerificationToken.findById(records.emailVerificationToken._id), null);
  assert.equal(await RateLimitBucket.findById(records.userRateLimit._id), null);
  assert.equal(await RateLimitBucket.findById(records.emailRateLimit._id), null);
  assert.equal(await Session.countDocuments({ userId }), 0);
  assert.equal(await OAuthHandoff.countDocuments({ userId }), 0);
  assert.equal(await PasswordResetToken.countDocuments({ userId }), 0);
  assert.equal(await EmailVerificationToken.countDocuments({ userId }), 0);
}

function assertNoSensitiveFields(payload) {
  const serialized = JSON.stringify(payload);
  for (const field of [
    'password',
    'passwordHash',
    'refreshToken',
    'refreshTokenHash',
    'resetToken',
    'resetTokenHash',
    'verificationToken',
    'verificationTokenHash',
    'GOOGLE_CLIENT_SECRET',
    'SMTP_PASSWORD',
    'JWT_SECRET',
    'tokenVersion',
    'userId',
  ]) {
    assert.equal(serialized.includes(field), false, `${field} must not be serialized`);
  }
}

function googlePayload(overrides = {}) {
  return {
    iss: 'https://accounts.google.com',
    aud: process.env.GOOGLE_CLIENT_ID,
    sub: 'google-subject-123',
    email: 'oauth-user@example.com',
    email_verified: true,
    name: 'Google User',
    picture: 'https://lh3.googleusercontent.com/a/arcadia-test-profile',
    ...overrides,
  };
}

function setGoogleMock(payload = googlePayload()) {
  googleMockPayload = payload;
  googleMockRequests = [];
  googleOAuthService.setGoogleClientFactoryForTests(() => ({
    generateAuthUrl: ({ state, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod, nonce }) => {
      const query = new URLSearchParams({
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        nonce,
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${query.toString()}`;
    },
    getToken: async ({ code, codeVerifier }) => {
      googleMockRequests.push({ code, codeVerifier });
      if (code === 'invalid-code') {
        throw new Error('mock invalid code');
      }
      return { tokens: { id_token: 'mock-google-id-token' } };
    },
    verifyIdToken: async ({ audience }) => ({
      getPayload: () => ({ ...googleMockPayload, aud: googleMockPayload.aud || audience }),
    }),
  }));
}

async function startGoogleOAuth(server) {
  const result = await requestJson(server, '/api/v1/auth/google', {
    method: 'GET',
    redirect: 'manual',
  });
  const location = result.response.headers.get('location');
  const state = location ? new URL(location).searchParams.get('state') : null;
  const stateCookie = getCookieValue(result.response, OAUTH_STATE_COOKIE_NAME);

  return { ...result, location, state, stateCookie };
}

async function completeGoogleCallback(
  server,
  {
    state,
    stateCookie,
    code = 'valid-code',
    error,
    nonceOverride,
    omitNonce = false,
    extraQuery = {},
  },
) {
  if (state && googleMockPayload) {
    const stateRecord = await OAuthState.findOne({ stateHash: hashOAuthValue(state) })
      .select('+nonce');
    if (stateRecord) {
      googleMockPayload.nonce = nonceOverride === undefined
        ? stateRecord.nonce
        : nonceOverride;
    }
    if (omitNonce) {
      delete googleMockPayload.nonce;
    }
  }

  const query = new URLSearchParams();
  if (state) query.set('state', state);
  if (code) query.set('code', code);
  if (error) query.set('error', error);
  for (const [key, value] of Object.entries(extraQuery)) {
    query.set(key, value);
  }

  return requestJson(server, `/api/v1/auth/google/callback?${query.toString()}`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'user-agent': 'google-oauth-test',
      ...(stateCookie ? { cookie: `${OAUTH_STATE_COOKIE_NAME}=${stateCookie}` } : {}),
    },
  });
}

function getLocationQuery(location, key) {
  const url = new URL(location, 'http://localhost');
  return url.searchParams.get(key)
    || new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash).get(key);
}

const WELCOME_SUBJECT = 'Welcome to Arcadia 🎮 — Your Journey Starts Here';
const WELCOME_BACK_SUBJECT = 'Welcome Back to Arcadia 🎮';

function getEmailsWithSubject(subject) {
  return emailMessages.filter((message) => message.subject === subject);
}

function clearEmailMessages() {
  emailMessages.length = 0;
}

function getEmailToken(message, parameter) {
  const match = message.text.match(/https?:\/\/[^\s]+/);
  if (!match) {
    return null;
  }

  const url = new URL(match[0]);
  return url.searchParams.get(parameter)
    || new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash).get(parameter);
}

test('creates users with normalized email, USER role, active status, and timestamps', async () => {
  const user = await User.create({
    email: '  Player@Example.COM  ',
    name: '  Player  ',
    passwordHash: 'hashed-password',
  });

  assert.equal(user.email, 'player@example.com');
  assert.equal(user.name, 'Player');
  assert.equal(user.role, USER_ROLES.USER);
  assert.equal(user.status, ACCOUNT_STATUSES.ACTIVE);
  assert.equal(user.tokenVersion, 0);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.updatedAt instanceof Date);
  assert.equal(user.toJSON().passwordHash, undefined);
});

test('enforces a unique normalized email', async () => {
  await User.create({
    email: 'same@example.com',
    passwordHash: 'first-hash',
  });

  await assert.rejects(
    () => User.create({
      email: ' SAME@EXAMPLE.COM ',
      passwordHash: 'second-hash',
    }),
    (error) => error && error.code === 11000,
  );
});

test('does not select password hashes unless explicitly requested and safe serialization is allowlisted', async () => {
  const created = await User.create({
    email: 'safe@example.com',
    passwordHash: 'secret-hash',
    google: {
      provider: GOOGLE_PROVIDER,
      subject: 'google-subject-123',
      email: 'safe@example.com',
    },
  });

  const withoutHash = await User.findById(created._id);
  assert.equal(withoutHash.passwordHash, undefined);

  const withHash = await User.findById(created._id).select('+passwordHash');
  assert.equal(withHash.passwordHash, 'secret-hash');

  const safe = toSafeUser(withoutHash);
  assert.equal(safe.passwordHash, undefined);
  assert.equal(safe.google, undefined);
  assert.deepEqual(
    Object.keys(safe).sort(),
    [
      'authProvider',
      'avatar',
      'avatarSource',
      'createdAt',
      'displayName',
      'email',
      'emailVerified',
      'googleAvatarAvailable',
      'googleAvatarUrl',
      'id',
      'lastLoginAt',
      'name',
      'role',
      'status',
      'updatedAt',
      'username',
      'usernameSetupRequired',
    ].sort(),
  );
});

test('public registration stores a hash, ignores a client-supplied role, and returns safe data', async () => {
  const result = await authService.register({
    email: 'Public@Example.com',
    password: 'public-password-123',
    name: 'Public User',
    role: USER_ROLES.ADMIN,
  });

  assert.equal(result.user.role, USER_ROLES.USER);
  assert.equal(result.user.passwordHash, undefined);

  const stored = await User.findOne({ email: 'public@example.com' }).select('+passwordHash');
  assert.equal(stored.role, USER_ROLES.USER);
  assert.notEqual(stored.passwordHash, 'public-password-123');
  assert.equal(await bcrypt.compare('public-password-123', stored.passwordHash), true);
});

test('login updates last-login metadata without exposing credentials', async () => {
  await authService.register({
    name: 'Login Metadata User',
    email: 'login@example.com',
    password: 'login-password-123',
  });

  const result = await authService.login(
    { email: ' LOGIN@EXAMPLE.COM ', password: 'login-password-123' },
    { ip: '127.0.0.1', userAgent: 'integration-test' },
  );

  assert.equal(result.user.passwordHash, undefined);
  assert.ok(result.user.lastLoginAt instanceof Date);

  const stored = await User.findOne({ email: 'login@example.com' }).select('+passwordHash');
  assert.equal(stored.lastLoginIp, '127.0.0.1');
  assert.equal(stored.lastLoginUserAgent, 'integration-test');
});

test('non-active accounts cannot authenticate', async () => {
  await User.create({
    email: 'suspended@example.com',
    passwordHash: await bcrypt.hash('suspended-password-123', 10),
    status: ACCOUNT_STATUSES.SUSPENDED,
  });

  await assert.rejects(
    () => authService.login({
      email: 'suspended@example.com',
      password: 'suspended-password-123',
    }),
    (error) => error && error.statusCode === 401,
  );
});

test('controlled admin provisioning creates one admin and is idempotent', async () => {
  const result = await provisionAdmin({
    email: 'Admin@Example.com',
    password: 'admin-password-123',
    name: 'Arcadia Admin',
  });

  assert.equal(result.created, true);
  assert.equal(result.replacedUser, false);
  assert.equal(result.adminCount, 1);
  assert.equal(result.user.role, USER_ROLES.ADMIN);
  assert.equal(result.user.passwordHash, undefined);

  const rerun = await provisionAdmin({
    email: 'admin@example.com',
    password: 'admin-password-123',
  });

  assert.equal(rerun.created, false);
  assert.equal(rerun.replacedUser, false);
  assert.equal(rerun.adminCount, 1);
  assert.equal(rerun.user.id, result.user.id);
  assert.equal(rerun.user.role, USER_ROLES.ADMIN);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 1);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('admin bootstrap replaces only the exact USER and all of its auth/security records', async () => {
  const normalizedEmail = 'bootstrap-replace@example.com';
  const oldUser = await User.create({
    email: normalizedEmail,
    name: 'Existing Bootstrap User',
    passwordHash: 'old-user-password-hash',
    role: USER_ROLES.USER,
    status: ACCOUNT_STATUSES.ACTIVE,
    emailVerified: true,
  });
  const oldUserId = oldUser._id;
  const targetRecords = await createBootstrapTestAuthRecords(oldUser, normalizedEmail, 'target');
  const unrelatedUser = await User.create({
    email: 'unrelated-user@example.com',
    name: 'Unrelated User',
    passwordHash: 'unrelated-password-hash',
    role: USER_ROLES.USER,
  });
  const unrelatedRecords = await createBootstrapTestAuthRecords(
    unrelatedUser,
    unrelatedUser.email,
    'unrelated',
  );
  const unrelatedOAuthState = await OAuthState.create({
    stateHash: 'unrelated-oauth-state',
    codeVerifier: 'unrelated-code-verifier',
    nonce: 'unrelated-nonce',
    expiresAt: new Date(Date.now() + 60 * 1000),
  });

  const result = await provisionAdmin({
    email: normalizedEmail.toUpperCase(),
    password: 'fresh-admin-password-123',
    name: 'Fresh Arcadia Admin',
  });

  assert.equal(result.created, true);
  assert.equal(result.replacedUser, true);
  assert.equal(result.adminCount, 1);
  assert.notEqual(result.user.id, String(oldUserId));
  assert.equal(result.user.role, USER_ROLES.ADMIN);
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(await User.findById(oldUserId), null);

  const freshAdmin = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  assert.equal(freshAdmin.role, USER_ROLES.ADMIN);
  assert.equal(freshAdmin.status, ACCOUNT_STATUSES.ACTIVE);
  assert.equal(await bcrypt.compare('fresh-admin-password-123', freshAdmin.passwordHash), true);
  assert.equal(await bcrypt.compare('old-user-password-123', freshAdmin.passwordHash), false);

  await assertBootstrapAuthRecordsDeleted(oldUserId, targetRecords);
  assert.ok(await User.findById(unrelatedUser._id));
  await assertBootstrapAuthRecordsExist(unrelatedUser._id, unrelatedRecords);
  assert.ok(await OAuthState.findById(unrelatedOAuthState._id));
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 1);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('admin bootstrap leaves an existing ADMIN and its records untouched', async () => {
  const normalizedEmail = 'existing-bootstrap-admin@example.com';
  const first = await provisionAdmin({
    email: normalizedEmail,
    password: 'existing-admin-password-123',
    name: 'Existing Admin',
  });
  const existingAdmin = await User.findOne({ email: normalizedEmail });
  const records = await createBootstrapTestAuthRecords(existingAdmin, normalizedEmail, 'existing-admin');

  const rerun = await provisionAdmin({
    email: normalizedEmail.toUpperCase(),
    password: 'existing-admin-password-123',
  });

  assert.equal(rerun.created, false);
  assert.equal(rerun.replacedUser, false);
  assert.equal(rerun.adminCount, 1);
  assert.equal(rerun.user.id, first.user.id);
  assert.equal(await User.findById(existingAdmin._id).then((user) => user.role), USER_ROLES.ADMIN);
  await assertBootstrapAuthRecordsExist(existingAdmin._id, records);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 1);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('admin bootstrap aborts without mutation when another admin already exists', async () => {
  const existingAdmin = await User.create({
    email: 'other-admin@example.com',
    passwordHash: 'other-admin-password-hash',
    role: USER_ROLES.ADMIN,
    status: ACCOUNT_STATUSES.ACTIVE,
  });
  const targetUser = await User.create({
    email: 'blocked-bootstrap-user@example.com',
    passwordHash: 'blocked-user-password-hash',
    role: USER_ROLES.USER,
  });
  const targetRecords = await createBootstrapTestAuthRecords(
    targetUser,
    targetUser.email,
    'blocked-target',
  );

  await assert.rejects(
    () => provisionAdmin({
      email: targetUser.email,
      password: 'blocked-admin-password-123',
      name: 'Blocked Admin',
    }),
    (error) => error?.provisioningCode === 'ANOTHER_ADMIN_EXISTS' && error?.statusCode === 409,
  );

  assert.ok(await User.findById(targetUser._id));
  await assertBootstrapAuthRecordsExist(targetUser._id, targetRecords);
  assert.equal(await User.findById(existingAdmin._id).then((user) => user.role), USER_ROLES.ADMIN);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 1);

  await assert.rejects(
    () => provisionAdmin({
      email: 'missing-bootstrap@example.com',
      password: 'missing-admin-password-123',
      name: 'Missing Admin',
    }),
    (error) => error?.provisioningCode === 'ANOTHER_ADMIN_EXISTS' && error?.statusCode === 409,
  );
  assert.equal(await User.findOne({ email: 'missing-bootstrap@example.com' }), null);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 1);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('standalone admin bootstrap restores the exact USER when admin creation fails', async () => {
  const normalizedEmail = 'rollback-create@example.com';
  const oldUser = await User.create({
    email: normalizedEmail,
    name: 'Rollback User',
    passwordHash: await bcrypt.hash('rollback-old-password-123', 10),
    role: USER_ROLES.USER,
    status: ACCOUNT_STATUSES.ACTIVE,
  });
  const oldUserId = oldUser._id;
  const records = await createBootstrapTestAuthRecords(oldUser, normalizedEmail, 'rollback-create');
  const originalCreate = User.create;
  User.create = async () => {
    throw new Error('forced admin creation failure');
  };

  try {
    await assert.rejects(
      () => provisionAdmin({
        email: normalizedEmail,
        password: 'rollback-admin-password-123',
        name: 'Rollback Admin',
      }),
      (error) => error?.safeMessage === 'Admin bootstrap failed; rollback completed',
    );
  } finally {
    User.create = originalCreate;
  }

  const restoredUser = await User.findById(oldUserId).select('+passwordHash');
  assert.equal(restoredUser.email, normalizedEmail);
  assert.equal(restoredUser.role, USER_ROLES.USER);
  assert.equal(restoredUser.status, ACCOUNT_STATUSES.ACTIVE);
  assert.equal(await bcrypt.compare('rollback-old-password-123', restoredUser.passwordHash), true);
  assert.equal(await bcrypt.compare('rollback-admin-password-123', restoredUser.passwordHash), false);
  await assertBootstrapAuthRecordsExist(oldUserId, records);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 0);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('standalone admin bootstrap restores records when associated-data deletion fails', async () => {
  const normalizedEmail = 'rollback-delete@example.com';
  const oldUser = await User.create({
    email: normalizedEmail,
    name: 'Rollback Deletion User',
    passwordHash: 'rollback-deletion-password-hash',
    role: USER_ROLES.USER,
    status: ACCOUNT_STATUSES.ACTIVE,
  });
  const oldUserId = oldUser._id;
  const records = await createBootstrapTestAuthRecords(oldUser, normalizedEmail, 'rollback-delete');
  const originalDeleteMany = OAuthHandoff.collection.deleteMany;
  OAuthHandoff.collection.deleteMany = async () => {
    throw new Error('forced auth-record deletion failure');
  };

  try {
    await assert.rejects(
      () => provisionAdmin({
        email: normalizedEmail,
        password: 'rollback-delete-password-123',
        name: 'Rollback Deletion Admin',
      }),
      (error) => error?.safeMessage === 'Admin bootstrap failed; rollback completed',
    );
  } finally {
    OAuthHandoff.collection.deleteMany = originalDeleteMany;
  }

  const restoredUser = await User.findById(oldUserId);
  assert.equal(restoredUser.email, normalizedEmail);
  assert.equal(restoredUser.role, USER_ROLES.USER);
  assert.equal(restoredUser.status, ACCOUNT_STATUSES.ACTIVE);
  await assertBootstrapAuthRecordsExist(oldUserId, records);
  assert.equal(await User.countDocuments({ role: USER_ROLES.ADMIN }), 0);
  assert.equal(await AdminMutationLock.countDocuments({}), 0);
});

test('versioned registration validates input, normalizes email, and ignores client roles', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: '  Ankit Das  ',
        email: '  User@Example.COM  ',
        password: 'register-password-123',
        role: USER_ROLES.ADMIN,
      },
    });

    assert.equal(registered.response.status, 201);
    assert.equal(registered.body.user.email, 'user@example.com');
    assert.equal(registered.body.user.name, 'Ankit Das');
    assert.equal(registered.body.user.role, USER_ROLES.USER);
    assert.equal(registered.body.user.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(registered.body.user.passwordHash, undefined);
    assert.equal(typeof registered.body.token, 'string');
    assert.equal(isValidRefreshToken(getRefreshCookie(registered.response)), true);

    const duplicate = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Another User',
        email: ' USER@EXAMPLE.COM ',
        password: 'another-password-123',
      },
    });

    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.error, 'Unable to create an account with those details');

    const withoutDisplayName = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        username: 'Ankit Das',
        email: 'missing-name@example.com',
        password: 'missing-name-password',
      },
    });

    // Arcadia signup no longer asks for a display name, so registration must
    // succeed and keep the entered username exactly as it was typed.
    assert.equal(withoutDisplayName.response.status, 201);
    assert.equal(withoutDisplayName.body.user.name, '');
    assert.equal(withoutDisplayName.body.user.displayName, '');
    assert.equal(withoutDisplayName.body.user.username, 'Ankit Das');
    assert.equal(withoutDisplayName.body.user.usernameSetupRequired, false);
  } finally {
    await stopHttpServer(server);
  }
});

test('login returns generic failures and rejects inactive accounts', async () => {
  const server = await startHttpServer();

  try {
    await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Login User',
        email: 'login-api@example.com',
        password: 'login-api-password-123',
      },
    });

    const successfulLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: ' LOGIN-API@EXAMPLE.COM ',
        password: 'login-api-password-123',
      },
    });

    assert.equal(successfulLogin.response.status, 200);
    assert.equal(successfulLogin.body.user.email, 'login-api@example.com');
    assert.equal(successfulLogin.body.user.passwordHash, undefined);
    assert.ok(successfulLogin.body.user.lastLoginAt);

    const wrongPassword = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'login-api@example.com',
        password: 'wrong-password-123',
      },
    });

    const unknownEmail = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'unknown-api@example.com',
        password: 'wrong-password-123',
      },
    });

    assert.equal(wrongPassword.response.status, 401);
    assert.equal(unknownEmail.response.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
    assert.equal(wrongPassword.body.error, 'Invalid email or password');

    await User.create({
      email: 'inactive-api@example.com',
      passwordHash: await bcrypt.hash('inactive-api-password-123', 10),
      status: ACCOUNT_STATUSES.SUSPENDED,
    });

    const inactiveLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'inactive-api@example.com',
        password: 'inactive-api-password-123',
      },
    });

    assert.equal(inactiveLogin.response.status, 401);
    assert.equal(inactiveLogin.body.error, 'Invalid email or password');
  } finally {
    await stopHttpServer(server);
  }
});

test('JWT middleware protects /me, uses current database role, and hides credentials', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'JWT User',
        email: 'jwt-api@example.com',
        password: 'jwt-api-password-123',
      },
    });

    const token = registered.body.token;
    const claims = verifyAccessToken(token);

    assert.equal(claims.sub, registered.body.user.id);
    assert.equal(claims.role, USER_ROLES.USER);
    assert.equal(claims.type, 'access');
    assert.equal(claims.tokenVersion, 0);
    assert.ok(claims.iat);
    assert.ok(claims.exp);
    assert.equal(claims.password, undefined);
    assert.equal(claims.passwordHash, undefined);
    assert.equal(claims.refreshToken, undefined);
    assert.equal(claims.clientSecret, undefined);
    assert.equal(claims.email, undefined);

    const me = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(me.response.status, 200);
    assert.equal(me.body.id, registered.body.user.id);
    assert.equal(me.body.role, USER_ROLES.USER);
    assert.equal(me.body.passwordHash, undefined);
    assert.equal(JSON.stringify(me.body).includes('passwordHash'), false);

    const missingAuth = await requestJson(server, '/api/v1/auth/me');
    assert.equal(missingAuth.response.status, 401);

    const invalidAuth = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: 'Bearer invalid-token' },
    });
    assert.equal(invalidAuth.response.status, 401);

    const missingVersionToken = jwt.sign(
      { sub: registered.body.user.id, role: USER_ROLES.USER, type: 'access' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
    const missingVersionAuth = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${missingVersionToken}` },
    });
    assert.equal(missingVersionAuth.response.status, 401);

    const expiredToken = jwt.sign(
      { sub: registered.body.user.id, role: USER_ROLES.USER, type: 'access' },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: -1 },
    );
    const expiredAuth = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    assert.equal(expiredAuth.response.status, 401);

    const forgedRoleToken = signAccessToken({
      _id: registered.body.user.id,
      role: USER_ROLES.ADMIN,
    });
    const roleChecked = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${forgedRoleToken}` },
    });
    assert.equal(roleChecked.response.status, 200);
    assert.equal(roleChecked.body.role, USER_ROLES.USER);

    const inactiveUser = await User.create({
      email: 'inactive-me@example.com',
      passwordHash: await bcrypt.hash('inactive-me-password-123', 10),
      status: ACCOUNT_STATUSES.SUSPENDED,
    });
    const inactiveToken = signAccessToken({
      _id: inactiveUser._id,
      role: USER_ROLES.USER,
    });
    const inactiveMe = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${inactiveToken}` },
    });
    assert.equal(inactiveMe.response.status, 403);
    assert.equal(inactiveMe.body.error, 'Account is inactive');

    const legacyRoute = await requestJson(server, '/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(legacyRoute.response.status, 200);
    assert.equal(legacyRoute.body.id, registered.body.user.id);
  } finally {
    await stopHttpServer(server);
  }
});

test('backward-compatible auth routes use the same service and malformed JSON is rejected safely', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/auth/register', {
      method: 'POST',
      body: {
        name: 'Legacy User',
        email: 'legacy@example.com',
        password: 'legacy-password-123',
      },
    });
    assert.equal(registered.response.status, 201);

    const loginResult = await requestJson(server, '/auth/login', {
      method: 'POST',
      body: {
        email: 'legacy@example.com',
        password: 'legacy-password-123',
      },
    });
    assert.equal(loginResult.response.status, 200);

    const malformed = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(malformed.response.status, 400);
    assert.equal(malformed.body.error, 'Malformed JSON request');
    assert.equal(JSON.stringify(malformed.body).includes('SyntaxError'), false);
  } finally {
    await stopHttpServer(server);
  }
});

test('login creates a hashed refresh session and sets an HTTP-only cookie', async () => {
  const server = await startHttpServer();

  try {
    const { registered, loggedIn, refreshCookie } = await registerAndLogin(server, 'session-login@example.com');

    assert.equal(registered.response.status, 201);
    assert.equal(loggedIn.response.status, 200);
    assert.equal(isValidRefreshToken(refreshCookie), true);
    assert.equal(loggedIn.body.refreshToken, undefined);
    assert.equal(JSON.stringify(loggedIn.body).includes(refreshCookie), false);

    const cookieHeader = getSetCookieHeader(loggedIn.response);
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /Path=\//i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    assert.match(cookieHeader, /Max-Age=2592000/i);

    const refreshTokenHash = hashRefreshToken(refreshCookie);
    const session = await Session.findOne({ refreshTokenHash }).select('+refreshTokenHash');
    const user = await User.findById(registered.body.user.id);

    assert.ok(session);
    assert.equal(session.userId.toString(), user._id.toString());
    assert.equal(session.refreshTokenHash, refreshTokenHash);
    assert.equal(verifyRefreshTokenHash(refreshCookie, refreshTokenHash), true);
    assert.equal(verifyRefreshTokenHash(generateRefreshToken(), refreshTokenHash), false);
    assert.notEqual(session.refreshTokenHash, refreshCookie);
    assert.equal(await Session.findOne({ refreshTokenHash: refreshCookie }), null);
  } finally {
    await stopHttpServer(server);
  }
});

test('refresh rotates the token and session while preserving access-token behavior', async () => {
  const server = await startHttpServer();

  try {
    const { registered, loggedIn, refreshCookie: oldCookie } = await registerAndLogin(server, 'rotation@example.com');
    const oldHash = hashRefreshToken(oldCookie);
    const oldSession = await Session.findOne({ refreshTokenHash: oldHash });
    assert.ok(oldSession);
    assert.equal(oldSession.credentialVersion, 0);

    const refreshed = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldCookie}` },
    });

    assert.equal(refreshed.response.status, 200);
    assert.equal(refreshed.body.refreshToken, undefined);
    assert.equal(typeof refreshed.body.token, 'string');
    assert.equal(verifyAccessToken(refreshed.body.token).tokenVersion, 0);
    assert.equal(refreshed.body.user.passwordHash, undefined);

    const newCookie = getRefreshCookie(refreshed.response);
    assert.equal(isValidRefreshToken(newCookie), true);
    assert.notEqual(newCookie, oldCookie);

    const newHash = hashRefreshToken(newCookie);
    const newSession = await Session.findOne({ refreshTokenHash: newHash });
    const revokedOldSession = await Session.findById(oldSession._id);

    assert.ok(newSession);
    assert.equal(revokedOldSession.revokedAt instanceof Date, true);
    assert.equal(newSession.revokedAt, null);
    assert.equal(newSession.familyId, oldSession.familyId);
     assert.equal(newSession.credentialVersion, oldSession.credentialVersion);
    assert.equal(revokedOldSession.replacedBySessionId.toString(), newSession._id.toString());
    assert.equal(JSON.stringify(refreshed.body).includes(newCookie), false);

    const meWithOldAccessToken = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${loggedIn.body.token}` },
    });
    assert.equal(meWithOldAccessToken.response.status, 200);
    assert.equal(meWithOldAccessToken.body.id, registered.body.user.id);

    const meWithNewAccessToken = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${refreshed.body.token}` },
    });
    assert.equal(meWithNewAccessToken.response.status, 200);
  } finally {
    await stopHttpServer(server);
  }
});

test('reusing a rotated refresh token revokes the token family', async () => {
  const server = await startHttpServer();

  try {
    const { refreshCookie: oldCookie } = await registerAndLogin(server, 'reuse@example.com');
    const refreshed = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldCookie}` },
    });
    const newCookie = getRefreshCookie(refreshed.response);

    const replay = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldCookie}` },
    });

    assert.equal(replay.response.status, 401);
    assert.equal(replay.body.error, 'Refresh token reuse detected');
    assert.match(getSetCookieHeader(replay.response), /arcadia_refresh=;/i);

    const familySessions = await Session.find({ familyId: (await Session.findOne({ refreshTokenHash: hashRefreshToken(oldCookie) })).familyId });
    assert.equal(familySessions.every((session) => session.revokedAt instanceof Date), true);

    const replayNew = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${newCookie}` },
    });
    assert.equal(replayNew.response.status, 401);
  } finally {
    await stopHttpServer(server);
  }
});

test('refresh rejects missing, expired, and revoked cookies', async () => {
  const server = await startHttpServer();

  try {
    const missing = await requestJson(server, '/api/v1/auth/refresh', { method: 'POST' });
    assert.equal(missing.response.status, 401);
    assert.equal(missing.body.error, 'Refresh token required');

    const { registered, refreshCookie: expiredCookie } = await registerAndLogin(server, 'expired-refresh@example.com');
    const expiredSession = await Session.findOne({ refreshTokenHash: hashRefreshToken(expiredCookie) });
    await Session.updateOne({ _id: expiredSession._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${expiredCookie}` },
    });
    assert.equal(expired.response.status, 401);

    const { refreshCookie: revokedCookie } = await registerAndLogin(server, 'revoked-refresh@example.com');
    const logoutResult = await requestJson(server, '/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${revokedCookie}` },
    });
    assert.equal(logoutResult.response.status, 200);

    const revoked = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${revokedCookie}` },
    });
    assert.equal(revoked.response.status, 401);
    assert.equal(revoked.body.error, 'Refresh token reuse detected');

    assert.ok(registered);
  } finally {
    await stopHttpServer(server);
  }
});

test('inactive users cannot refresh and logout is idempotent', async () => {
  const server = await startHttpServer();

  try {
    const { registered, refreshCookie } = await registerAndLogin(server, 'inactive-refresh@example.com');
    await User.updateOne(
      { _id: registered.body.user.id },
      { $set: { status: ACCOUNT_STATUSES.SUSPENDED } },
    );

    const inactiveRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${refreshCookie}` },
    });
    assert.equal(inactiveRefresh.response.status, 403);
    assert.equal(inactiveRefresh.body.error, 'Account is inactive');
    assert.match(getSetCookieHeader(inactiveRefresh.response), /arcadia_refresh=;/i);

    const noCookieLogout = await requestJson(server, '/api/v1/auth/logout', { method: 'POST' });
    assert.equal(noCookieLogout.response.status, 200);
    assert.equal(noCookieLogout.body.message, 'Logged out successfully');
  } finally {
    await stopHttpServer(server);
  }
});

test('logout-all revokes every refresh session for the authenticated user', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Multi Session User',
        email: 'multi-session@example.com',
        password: 'multi-session-password-123',
      },
    });
    const firstLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'multi-session@example.com', password: 'multi-session-password-123' },
    });
    const secondLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'multi-session@example.com', password: 'multi-session-password-123' },
    });
    const firstCookie = getRefreshCookie(firstLogin.response);
    const secondCookie = getRefreshCookie(secondLogin.response);

    const logoutAll = await requestJson(server, '/api/v1/auth/logout-all', {
      method: 'POST',
      headers: { authorization: `Bearer ${secondLogin.body.token}` },
    });
    assert.equal(logoutAll.response.status, 200);
    assert.equal(logoutAll.body.message, 'All sessions revoked');

    const staleAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${secondLogin.body.token}` },
    });
    assert.equal(staleAccess.response.status, 401);

    const sessions = await Session.find({ userId: registered.body.user.id });
    assert.equal(sessions.length, 3);
    assert.equal(sessions.every((session) => session.revokedAt instanceof Date), true);

    for (const cookie of [firstCookie, secondCookie]) {
      const refreshAttempt = await requestJson(server, '/api/v1/auth/refresh', {
        method: 'POST',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${cookie}` },
      });
      assert.equal(refreshAttempt.response.status, 401);
    }
  } finally {
    await stopHttpServer(server);
  }
});

test('Google OAuth start creates a random, hashed, short-lived state attempt', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const first = await startGoogleOAuth(server);
    const second = await startGoogleOAuth(server);

    assert.equal(first.response.status, 302);
    assert.ok(first.location.startsWith('https://accounts.google.com/'));
    assert.equal(isValidOAuthState(first.state), true);
    assert.equal(isValidOAuthState(first.stateCookie), true);
    assert.notEqual(first.state, second.state);

    const stateRecord = await OAuthState.findOne({ stateHash: hashOAuthValue(first.state) })
      .select('+stateHash +codeVerifier +nonce');
    assert.ok(stateRecord);
    assert.equal(stateRecord.stateHash, hashOAuthValue(first.state));
    assert.notEqual(stateRecord.stateHash, first.state);
    assert.equal(isValidOAuthCodeVerifier(stateRecord.codeVerifier), true);
    assert.ok(stateRecord.codeVerifier.length >= 43);
    assert.ok(stateRecord.nonce.length >= 32);
    assert.equal(derivePkceChallenge(stateRecord.codeVerifier), new URL(first.location).searchParams.get('code_challenge'));
    assert.equal(new URL(first.location).searchParams.get('code_challenge_method'), 'S256');
    assert.equal(new URL(first.location).searchParams.get('nonce'), stateRecord.nonce);
    assert.equal(stateRecord.expiresAt instanceof Date, true);
    const secondStateRecord = await OAuthState.findOne({ stateHash: hashOAuthValue(second.state) })
      .select('+codeVerifier +nonce');
    assert.notEqual(secondStateRecord.codeVerifier, stateRecord.codeVerifier);
    assert.notEqual(secondStateRecord.nonce, stateRecord.nonce);
    assert.equal(await OAuthState.countDocuments({ stateHash: first.state }), 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('Google OAuth rejects invalid, expired, and reused state', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const invalid = await completeGoogleCallback(server, {
      state: 'arc_state_invalid',
      stateCookie: 'arc_state_invalid',
    });
    assert.equal(invalid.response.status, 302);
    assert.equal(getLocationQuery(invalid.response.headers.get('location'), 'oauth_error'), 'invalid_state');

    const expiredStart = await startGoogleOAuth(server);
    await OAuthState.updateOne(
      { stateHash: hashOAuthValue(expiredStart.state) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await completeGoogleCallback(server, {
      state: expiredStart.state,
      stateCookie: expiredStart.stateCookie,
    });
    assert.equal(expired.response.status, 302);
    assert.equal(getLocationQuery(expired.response.headers.get('location'), 'oauth_error'), 'invalid_state');

    const reusableStart = await startGoogleOAuth(server);
    const firstCallback = await completeGoogleCallback(server, {
      state: reusableStart.state,
      stateCookie: reusableStart.stateCookie,
    });
    assert.equal(firstCallback.response.status, 302);
    const reused = await completeGoogleCallback(server, {
      state: reusableStart.state,
      stateCookie: reusableStart.stateCookie,
    });
    assert.equal(reused.response.status, 302);
    assert.equal(getLocationQuery(reused.response.headers.get('location'), 'oauth_error'), 'invalid_state');
  } finally {
    await stopHttpServer(server);
  }
});

test('Google identity validation rejects invalid issuer, audience, and unverified email', async () => {
  const invalidPayloads = [
    googlePayload({ iss: 'https://evil.example.com' }),
    googlePayload({ aud: 'wrong-client-id' }),
    googlePayload({ email_verified: false }),
    googlePayload({ nonce: 'wrong-nonce' }),
    googlePayload({ nonce: undefined }),
  ];

  const codeVerifier = generateOAuthCodeVerifier();
  const nonce = 'direct-test-nonce';
  for (const payload of invalidPayloads) {
    const payloadWithNonce = Object.prototype.hasOwnProperty.call(payload, 'nonce')
      ? payload
      : { ...payload, nonce };
    setGoogleMock(payloadWithNonce);
    await assert.rejects(
      () => googleOAuthService.exchangeAuthorizationCode('valid-code', {
        codeVerifier,
        nonce,
      }),
      (error) => error && error.statusCode === 401,
    );
  }

  assert.throws(
    () => googleOAuthService.getGoogleOAuthConfig({}),
    /Google OAuth is not configured/,
  );
});

test('PKCE verifier is generated server-side, sent only to Google exchange, and consumed atomically', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const transaction = await OAuthState.findOne({ stateHash: hashOAuthValue(started.state) })
      .select('+codeVerifier +nonce');
    const locationUrl = new URL(started.location);

    assert.equal(isValidOAuthCodeVerifier(transaction.codeVerifier), true);
    assert.equal(derivePkceChallenge(transaction.codeVerifier), locationUrl.searchParams.get('code_challenge'));
    assert.equal(locationUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(locationUrl.searchParams.get('code_verifier'), null);
    assert.equal(locationUrl.searchParams.get('nonce'), transaction.nonce);

    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
      extraQuery: { code_verifier: 'client-supplied-verifier' },
    });
    assert.equal(callback.response.status, 302);
    assert.equal(googleMockRequests[0].codeVerifier, transaction.codeVerifier);
    assert.notEqual(googleMockRequests[0].codeVerifier, 'client-supplied-verifier');

    const consumed = await OAuthState.findById(transaction._id).select('+codeVerifier +nonce');
    assert.equal(consumed.codeVerifier, undefined);
    assert.equal(consumed.nonce, undefined);
  } finally {
    await stopHttpServer(server);
  }
});

test('OIDC nonce is transaction-bound and missing or mismatched nonce is rejected', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const wrongNonceStart = await startGoogleOAuth(server);
    const wrongNonce = await completeGoogleCallback(server, {
      state: wrongNonceStart.state,
      stateCookie: wrongNonceStart.stateCookie,
      nonceOverride: 'wrong-nonce',
    });
    assert.equal(wrongNonce.response.status, 302);
    assert.equal(getLocationQuery(wrongNonce.response.headers.get('location'), 'oauth_error'), 'authentication_failed');

    const missingNonceStart = await startGoogleOAuth(server);
    const missingNonce = await completeGoogleCallback(server, {
      state: missingNonceStart.state,
      stateCookie: missingNonceStart.stateCookie,
      omitNonce: true,
    });
    assert.equal(missingNonce.response.status, 302);
    assert.equal(getLocationQuery(missingNonce.response.headers.get('location'), 'oauth_error'), 'authentication_failed');
    assert.equal(await User.countDocuments({ 'google.subject': 'google-subject-123' }), 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('verified Google identity creates a USER and completes through a one-time handoff', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const transaction = await OAuthState.findOne({ stateHash: hashOAuthValue(started.state) })
      .select('+codeVerifier +nonce');
    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
      extraQuery: { code_verifier: 'attacker-controlled-verifier' },
    });

    assert.equal(callback.response.status, 302);
    assert.equal(googleMockRequests.length, 1);
    assert.equal(googleMockRequests[0].code, 'valid-code');
    assert.equal(googleMockRequests[0].codeVerifier, transaction.codeVerifier);
    const consumedTransaction = await OAuthState.findById(transaction._id)
      .select('+codeVerifier +nonce');
    assert.equal(consumedTransaction.codeVerifier, undefined);
    assert.equal(consumedTransaction.nonce, undefined);
    const location = callback.response.headers.get('location');
    const handoffCode = getLocationQuery(location, 'oauth_code');
    assert.equal(isValidOAuthHandoffCode(handoffCode), true);
    assert.equal(getLocationQuery(location, 'token'), null);
    assert.equal(getLocationQuery(location, 'access_token'), null);
    assert.equal(getLocationQuery(location, 'refresh_token'), null);
    assert.equal(getLocationQuery(location, 'code_verifier'), null);
    assert.equal(getLocationQuery(location, 'code_challenge'), null);
    assert.equal(getLocationQuery(location, 'nonce'), null);
    assert.equal(JSON.stringify(location).includes(transaction.codeVerifier), false);
    assert.equal(JSON.stringify(location).includes(transaction.nonce), false);
    assert.equal(JSON.stringify(location).includes('mock-google-id-token'), false);

    const refreshCookie = getCookieValue(callback.response, REFRESH_COOKIE_NAME);
    assert.equal(isValidRefreshToken(refreshCookie), true);

    const user = await User.findOne({ email: 'oauth-user@example.com' }).select('+passwordHash');
    assert.ok(user);
    assert.equal(user.role, USER_ROLES.USER);
    assert.equal(user.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(user.emailVerified, true);
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.google.provider, 'GOOGLE');
    assert.equal(user.google.subject, 'google-subject-123');
    assert.equal(user.avatar.type, 'google');
    assert.equal(user.avatar.value, 'google');
    assert.ok(user.lastLoginAt instanceof Date);
    assert.ok(user.lastLoginIp);
    assert.equal(user.lastLoginUserAgent, 'google-oauth-test');

    const session = await Session.findOne({ userId: user._id, revokedAt: null }).select('+refreshTokenHash');
    assert.ok(session);
    assert.equal(session.refreshTokenHash, hashRefreshToken(refreshCookie));
    assert.equal(await Session.findOne({ refreshTokenHash: refreshCookie }), null);

    const handoff = await OAuthHandoff.findOne({ codeHash: hashOAuthValue(handoffCode) }).select('+codeHash');
    assert.ok(handoff);
    assert.equal(handoff.userId.toString(), user._id.toString());
    assert.equal(handoff.sessionId.toString(), session._id.toString());
    assert.equal(handoff.codeHash, hashOAuthValue(handoffCode));
    assert.equal(handoff.accessToken, undefined);

    const exchanged = await requestJson(server, '/api/v1/auth/google/exchange', {
      method: 'POST',
      body: { code: handoffCode },
    });
    assert.equal(exchanged.response.status, 200);
    assert.equal(exchanged.body.user.id, user._id.toString());
    assert.equal(exchanged.body.user.passwordHash, undefined);
    assert.equal(exchanged.body.googleToken, undefined);
    assert.equal(JSON.stringify(exchanged.body).includes('mock-google-id-token'), false);
    assert.equal(verifyAccessToken(exchanged.body.token).sub, user._id.toString());

    const consumedHandoff = await OAuthHandoff.findById(handoff._id);
    assert.ok(consumedHandoff.consumedAt instanceof Date);

    const replay = await requestJson(server, '/api/v1/auth/google/exchange', {
      method: 'POST',
      body: { code: handoffCode },
    });
    assert.equal(replay.response.status, 401);
  } finally {
    await stopHttpServer(server);
  }
});

test('existing Google identity logs in again and updates normal session metadata', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const firstStart = await startGoogleOAuth(server);
    const firstCallback = await completeGoogleCallback(server, {
      state: firstStart.state,
      stateCookie: firstStart.stateCookie,
    });
    assert.equal(firstCallback.response.status, 302);

    const secondStart = await startGoogleOAuth(server);
    const secondCallback = await completeGoogleCallback(server, {
      state: secondStart.state,
      stateCookie: secondStart.stateCookie,
    });
    assert.equal(secondCallback.response.status, 302);

    const user = await User.findOne({ 'google.subject': 'google-subject-123' });
    assert.equal(await User.countDocuments({ 'google.subject': 'google-subject-123' }), 1);
    assert.ok(user.lastLoginAt instanceof Date);
    assert.equal(await Session.countDocuments({ userId: user._id, revokedAt: null }), 2);
  } finally {
    await stopHttpServer(server);
  }
});

test('Google login rejects inactive accounts and does not overwrite password accounts', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const firstStart = await startGoogleOAuth(server);
    const firstCallback = await completeGoogleCallback(server, {
      state: firstStart.state,
      stateCookie: firstStart.stateCookie,
    });
    const user = await User.findOne({ 'google.subject': 'google-subject-123' });
    await User.updateOne({ _id: user._id }, { $set: { status: ACCOUNT_STATUSES.SUSPENDED } });

    const inactiveStart = await startGoogleOAuth(server);
    const inactiveCallback = await completeGoogleCallback(server, {
      state: inactiveStart.state,
      stateCookie: inactiveStart.stateCookie,
    });
    assert.equal(inactiveCallback.response.status, 302);
    assert.equal(getLocationQuery(inactiveCallback.response.headers.get('location'), 'oauth_error'), 'authentication_failed');

    const localUser = await authService.register({
      name: 'Local User',
      email: 'local-conflict@example.com',
      password: 'local-conflict-password-123',
    });
    const originalLocalUser = await User.findById(localUser.user.id).select('+passwordHash');
    const originalLocalPasswordHash = originalLocalUser.passwordHash;
    const localSessionCountBeforeGoogle = await Session.countDocuments({ userId: localUser.user.id });
    setGoogleMock(googlePayload({
      sub: 'different-google-subject',
      email: 'local-conflict@example.com',
    }));
    const conflictStart = await startGoogleOAuth(server);
    const conflictCallback = await completeGoogleCallback(server, {
      state: conflictStart.state,
      stateCookie: conflictStart.stateCookie,
    });
    assert.equal(conflictCallback.response.status, 302);
    const conflictLocation = conflictCallback.response.headers.get('location');
    assert.equal(getLocationQuery(conflictLocation, 'oauth_error'), 'account_exists');
    assert.equal(getLocationQuery(conflictLocation, 'oauth_code'), null);
    assert.equal(getLocationQuery(conflictLocation, 'role'), null);

    const unchangedLocalUser = await User.findById(localUser.user.id).select('+passwordHash');
    assert.equal(unchangedLocalUser.role, USER_ROLES.USER);
    assert.equal(unchangedLocalUser.google?.subject, undefined);
    assert.equal(unchangedLocalUser.passwordHash, originalLocalPasswordHash);
    assert.equal(await User.countDocuments({ email: 'local-conflict@example.com' }), 1);
    assert.equal(await User.countDocuments({ 'google.subject': 'different-google-subject' }), 0);
    assert.equal(await OAuthHandoff.countDocuments({ userId: localUser.user.id }), 0);
    assert.equal(
      await Session.countDocuments({ userId: localUser.user.id }),
      localSessionCountBeforeGoogle,
    );
    assert.ok(firstCallback.response.status === 302);
  } finally {
    await stopHttpServer(server);
  }
});

test('Google login uses the same safe account-exists condition for an existing ADMIN password account', async () => {
  const server = await startHttpServer();

  try {
    const existingAdmin = await User.create({
      email: 'oauth-role-conflict@example.com',
      name: 'Existing Password Admin',
      passwordHash: await bcrypt.hash('existing-admin-password-123', 10),
      role: USER_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.ACTIVE,
    });
    const existingAdminId = existingAdmin._id;
    const originalPasswordHash = existingAdmin.passwordHash;
    setGoogleMock(googlePayload({
      sub: 'admin-conflict-google-subject',
      email: 'oauth-role-conflict@example.com',
    }));

    const started = await startGoogleOAuth(server);
    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
    });
    const location = callback.response.headers.get('location');

    assert.equal(callback.response.status, 302);
    assert.equal(getLocationQuery(location, 'oauth_error'), 'account_exists');
    assert.equal(getLocationQuery(location, 'oauth_code'), null);
    assert.equal(getLocationQuery(location, 'role'), null);
    assert.equal(location.includes('ADMIN'), false);
    assert.equal(location.includes(originalPasswordHash), false);

    const unchangedAdmin = await User.findById(existingAdminId).select('+passwordHash');
    assert.equal(unchangedAdmin.role, USER_ROLES.ADMIN);
    assert.equal(unchangedAdmin.google?.subject, undefined);
    assert.equal(Boolean(unchangedAdmin.passwordHash), true);
    assert.equal(unchangedAdmin.passwordHash === originalPasswordHash, true);
    assert.equal(await User.countDocuments({ email: 'oauth-role-conflict@example.com' }), 1);
    assert.equal(await User.countDocuments({ 'google.subject': 'admin-conflict-google-subject' }), 0);
    assert.equal(await Session.countDocuments({ userId: existingAdminId }), 0);
    assert.equal(await OAuthHandoff.countDocuments({ userId: existingAdminId }), 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('Google callback handles user denial safely', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const denied = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
      code: null,
      error: 'access_denied',
    });

    assert.equal(denied.response.status, 302);
    assert.equal(getLocationQuery(denied.response.headers.get('location'), 'oauth_error'), 'access_denied');
    assert.equal(await User.countDocuments({ 'google.subject': 'google-subject-123' }), 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('password signup sends exactly one welcome email with the configured frontend CTA', async () => {
  const server = await startHttpServer();

  try {
    const response = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Welcome New User',
        email: 'welcome-new@example.com',
        password: 'welcome-new-password-123',
      },
    });

    assert.equal(response.response.status, 201);
    const welcomeEmails = getEmailsWithSubject(WELCOME_SUBJECT);
    assert.equal(welcomeEmails.length, 1);
    assert.equal(welcomeEmails[0].to, 'welcome-new@example.com');
    assert.match(welcomeEmails[0].text, /Your Arcadia account is ready/);
    assert.match(welcomeEmails[0].text, /ENTER ARCADIA → http:\/\/localhost:5173\//);
    assert.match(welcomeEmails[0].html, /WELCOME TO ARCADIA/);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 0);
    assert.equal(getEmailsWithSubject('Verify your Arcadia email').length, 1);
  } finally {
    await stopHttpServer(server);
  }
});

test('existing password login sends exactly one safe welcome-back email', async () => {
  const server = await startHttpServer();

  try {
    await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Returning Password User',
        email: 'welcome-back-password@example.com',
        password: 'welcome-back-password-123',
      },
    });
    clearEmailMessages();

    const response = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'welcome-back-password@example.com',
        password: 'welcome-back-password-123',
      },
    });

    assert.equal(response.response.status, 200);
    const welcomeBackEmails = getEmailsWithSubject(WELCOME_BACK_SUBJECT);
    assert.equal(welcomeBackEmails.length, 1);
    assert.equal(welcomeBackEmails[0].to, 'welcome-back-password@example.com');
    assert.match(welcomeBackEmails[0].text, /Your games are waiting/);
    assert.match(welcomeBackEmails[0].text, /RETURN TO ARCADIA → http:\/\/localhost:5173\//);
    assert.match(welcomeBackEmails[0].html, /WELCOME BACK/);
    assert.doesNotMatch(welcomeBackEmails[0].text, /ADMIN|passwordHash|accessToken|refreshToken|Bearer/);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT).length, 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('new Google OAuth signup sends one welcome and no welcome-back email', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
    });

    assert.equal(callback.response.status, 302);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT).length, 1);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 0);
    assert.equal(getEmailsWithSubject('Verify your Arcadia email').length, 0);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT)[0].to, 'oauth-user@example.com');
  } finally {
    await stopHttpServer(server);
  }
});

test('existing Google OAuth login sends one welcome-back email without duplicate sends', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const firstStart = await startGoogleOAuth(server);
    const firstCallback = await completeGoogleCallback(server, {
      state: firstStart.state,
      stateCookie: firstStart.stateCookie,
    });
    assert.equal(firstCallback.response.status, 302);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT).length, 1);
    clearEmailMessages();

    const secondStart = await startGoogleOAuth(server);
    const secondCallback = await completeGoogleCallback(server, {
      state: secondStart.state,
      stateCookie: secondStart.stateCookie,
    });

    assert.equal(secondCallback.response.status, 302);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 1);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT).length, 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('failed login, refresh, me, and logout do not send welcome-back email', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'No Extra Email User',
        email: 'no-extra-email@example.com',
        password: 'no-extra-email-password-123',
      },
    });
    assert.equal(registered.response.status, 201);
    clearEmailMessages();

    const failed = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'no-extra-email@example.com',
        password: 'wrong-password-123',
      },
    });
    assert.equal(failed.response.status, 401);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 0);

    const loggedIn = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'no-extra-email@example.com',
        password: 'no-extra-email-password-123',
      },
    });
    assert.equal(loggedIn.response.status, 200);
    const accessToken = loggedIn.body.token;
    const firstRefreshCookie = getRefreshCookie(loggedIn.response);
    clearEmailMessages();

    const refreshed = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${firstRefreshCookie}` },
    });
    assert.equal(refreshed.response.status, 200);

    const me = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(me.response.status, 200);

    const loggedOut = await requestJson(server, '/api/v1/auth/logout', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${getRefreshCookie(refreshed.response)}` },
    });
    assert.equal(loggedOut.response.status, 200);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('welcome delivery failures do not block password signup or login', async () => {
  const server = await startHttpServer();

  try {
    emailService.setEmailTransportForTests(async () => {
      throw new Error('test transport failure');
    });
    const signup = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Transport Failure Signup',
        email: 'transport-signup@example.com',
        password: 'transport-signup-password-123',
      },
    });
    assert.equal(signup.response.status, 201);
    assert.ok(await User.exists({ email: 'transport-signup@example.com' }));

    emailService.setEmailTransportForTests(async (message) => {
      emailMessages.push(message);
      return { sent: true };
    });
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Transport Failure Login',
        email: 'transport-login@example.com',
        password: 'transport-login-password-123',
      },
    });
    assert.equal(registered.response.status, 201);
    clearEmailMessages();

    emailService.setEmailTransportForTests(async () => {
      throw new Error('test transport failure');
    });
    const login = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'transport-login@example.com',
        password: 'transport-login-password-123',
      },
    });

    assert.equal(login.response.status, 200);
    assert.equal(login.body.user.email, 'transport-login@example.com');
  } finally {
    await stopHttpServer(server);
  }
});

test('admin welcome-back content does not disclose role information', async () => {
  const server = await startHttpServer();

  try {
    await User.create({
      email: 'welcome-admin@example.com',
      name: 'Welcome Admin',
      displayName: 'Welcome Admin',
      passwordHash: await bcrypt.hash('welcome-admin-password-123', 10),
      role: USER_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.ACTIVE,
    });
    clearEmailMessages();

    const login = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'welcome-admin@example.com',
        password: 'welcome-admin-password-123',
      },
    });

    assert.equal(login.response.status, 200);
    const welcomeBackEmails = getEmailsWithSubject(WELCOME_BACK_SUBJECT);
    assert.equal(welcomeBackEmails.length, 1);
    assert.doesNotMatch(welcomeBackEmails[0].text, /ADMIN|passwordHash|accessToken|refreshToken|Bearer/);
    assert.doesNotMatch(welcomeBackEmails[0].html, /ADMIN|passwordHash|accessToken|refreshToken|Bearer/);
  } finally {
    await stopHttpServer(server);
  }
});

test('failed Google authentication does not send a welcome email', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
      nonceOverride: 'wrong-nonce',
    });

    assert.equal(callback.response.status, 302);
    assert.equal(getEmailsWithSubject(WELCOME_SUBJECT).length, 0);
    assert.equal(getEmailsWithSubject(WELCOME_BACK_SUBJECT).length, 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('registration creates an unverified account and stores only a verification-token hash', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Verify User',
        email: 'verify-registration@example.com',
        password: 'verify-registration-password',
      },
    });

    assert.equal(registered.response.status, 201);
    assert.equal(registered.body.user.emailVerified, false);
    assert.equal(registered.body.verificationEmailSent, true);
    assert.equal(registered.body.verificationToken, undefined);

    const user = await User.findOne({ email: 'verify-registration@example.com' }).select('+passwordHash');
    assert.equal(user.emailVerified, false);
    assert.equal(user.passwordHash.includes('verify-registration-password'), false);

    const rawToken = getEmailToken(emailMessages[0], 'verification_token');
    assert.ok(rawToken);
    const stored = await EmailVerificationToken.findOne({ userId: user._id }).select('+tokenHash');
    assert.equal(stored.tokenHash, hashSecureToken(rawToken));
    assert.notEqual(stored.tokenHash, rawToken);
    assert.equal(stored.toJSON().tokenHash, undefined);
  } finally {
    await stopHttpServer(server);
  }
});

test('registration remains successful when email delivery is not configured', async () => {
  const server = await startHttpServer();
  const emailVariables = [
    'EMAIL_PROVIDER',
    'EMAIL_FROM',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'FRONTEND_EMAIL_VERIFICATION_URL',
    'FRONTEND_PASSWORD_RESET_URL',
  ];
  const savedEmailEnvironment = Object.fromEntries(
    emailVariables.map((name) => [name, process.env[name]]),
  );

  try {
    for (const name of emailVariables) {
      delete process.env[name];
    }

    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'No Email Provider',
        email: 'no-email-provider@example.com',
        password: 'no-email-provider-password',
      },
    });

    assert.equal(registered.response.status, 201);
    assert.equal(registered.body.verificationEmailSent, false);
    assert.equal(registered.body.verificationToken, undefined);
    assert.ok(await User.exists({ email: 'no-email-provider@example.com' }));
  } finally {
    for (const [name, value] of Object.entries(savedEmailEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await stopHttpServer(server);
  }
});

test('email verification consumes a token once and rejects invalid, expired, and missing tokens', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Verify Flow',
        email: 'verify-flow@example.com',
        password: 'verify-flow-password',
      },
    });
    const rawToken = getEmailToken(emailMessages[0], 'verification_token');
    const verified = await requestJson(server, `/api/v1/auth/verify-email?token=${encodeURIComponent(rawToken)}`);
    assert.equal(verified.response.status, 200);
    assert.equal(verified.body.token, undefined);

    const verifiedUser = await User.findById(registered.body.user.id);
    assert.equal(verifiedUser.emailVerified, true);

    const replay = await requestJson(server, `/api/v1/auth/verify-email?token=${encodeURIComponent(rawToken)}`);
    assert.equal(replay.response.status, 400);

    const invalid = await requestJson(server, '/api/v1/auth/verify-email?token=arc_verify_invalid');
    assert.equal(invalid.response.status, 400);
    const missing = await requestJson(server, '/api/v1/auth/verify-email');
    assert.equal(missing.response.status, 400);

    const expiredUser = await authService.register({
      name: 'Expired Verification',
      email: 'expired-verification@example.com',
      password: 'expired-verification-password',
    });
    const expiredIssue = await accountActionService.issueVerificationForUser(expiredUser.user.id);
    const expiredRecord = await EmailVerificationToken.findOne({ userId: expiredUser.user.id, consumedAt: null });
    await EmailVerificationToken.updateOne({ _id: expiredRecord._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await requestJson(server, `/api/v1/auth/verify-email?token=${encodeURIComponent(emailMessages.at(-1).text.match(/verification_token=([^&\s]+)/)[1])}`);
    assert.equal(expired.response.status, 400);
    assert.equal(expiredIssue.sent, true);
  } finally {
    await stopHttpServer(server);
  }
});

test('resend verification is generic, rate-limited, and invalidates old tokens', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        name: 'Resend User',
        email: 'resend-verification@example.com',
        password: 'resend-verification-password',
      },
    });
    const firstToken = getEmailToken(emailMessages[0], 'verification_token');
    const firstRecord = await EmailVerificationToken.findOne({ tokenHash: hashSecureToken(firstToken) });
    await EmailVerificationToken.collection.updateOne(
      { _id: firstRecord._id },
      { $set: { createdAt: new Date(Date.now() - 120000), consumedAt: new Date(Date.now() - 120000) } },
    );
    await User.updateOne(
      { _id: registered.body.user.id },
      { $set: { verificationEmailRequestedAt: new Date(Date.now() - 120000) } },
    );

    const resent = await requestJson(server, '/api/v1/auth/resend-verification', {
      method: 'POST',
      body: { email: ' RESEND-VERIFICATION@EXAMPLE.COM ' },
    });
    assert.equal(resent.response.status, 200);
    assert.equal(resent.body.message, 'If the account is eligible, a verification email has been sent.');

    const secondToken = getEmailToken(emailMessages.at(-1), 'verification_token');
    assert.notEqual(secondToken, firstToken);
    const oldVerification = await requestJson(server, `/api/v1/auth/verify-email?token=${encodeURIComponent(firstToken)}`);
    assert.equal(oldVerification.response.status, 400);

    const cooldown = await requestJson(server, '/api/v1/auth/resend-verification', {
      method: 'POST',
      body: { email: 'resend-verification@example.com' },
    });
    assert.equal(cooldown.response.status, 200);
    assert.equal(cooldown.body.message, resent.body.message);

    const unknown = await requestJson(server, '/api/v1/auth/resend-verification', {
      method: 'POST',
      body: { email: 'unknown-resend@example.com' },
    });
    assert.deepEqual(unknown.body, cooldown.body);
    assert.ok(registered.body.user.id);
  } finally {
    await stopHttpServer(server);
  }
});

test('forgot-password is generic and stores only a reset-token hash', async () => {
  const server = await startHttpServer();

  try {
    const user = await authService.register({
      name: 'Reset User',
      email: 'reset-user@example.com',
      password: 'reset-user-password',
    });

    const response = await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: ' RESET-USER@EXAMPLE.COM ' },
    });
    assert.equal(response.response.status, 200);
    assert.equal(response.body.message, 'If the account is eligible, a password reset email has been sent.');
    assert.equal(response.body.resetToken, undefined);

    const rawToken = getEmailToken(emailMessages.at(-1), 'reset_token');
    assert.ok(rawToken);
    const stored = await PasswordResetToken.findOne({ userId: user.user.id }).select('+tokenHash');
    assert.equal(stored.tokenHash, hashSecureToken(rawToken));
    assert.notEqual(stored.tokenHash, rawToken);
    assert.equal(stored.toJSON().tokenHash, undefined);

    const unknown = await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'unknown-reset@example.com' },
    });
    assert.deepEqual(unknown.body, response.body);
  } finally {
    await stopHttpServer(server);
  }
});

test('password reset changes the hash, consumes the token, revokes sessions, and requires login again', async () => {
  const server = await startHttpServer();

  try {
    await authService.register({
      name: 'Reset Login User',
      email: 'reset-login@example.com',
      password: 'old-password-123',
    });
    const loginBefore = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'reset-login@example.com', password: 'old-password-123' },
    });
    const oldRefreshCookie = getRefreshCookie(loginBefore.response);
    const oldAccessToken = loginBefore.body.token;

    await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'reset-login@example.com' },
    });
    const rawToken = getEmailToken(emailMessages.at(-1), 'reset_token');
    const reset = await requestJson(server, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: rawToken, password: 'new-password-123' },
    });

    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.password, undefined);
    assert.equal(reset.body.passwordHash, undefined);
    assert.equal(reset.body.token, undefined);

    const staleAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${oldAccessToken}` },
    });
    assert.equal(staleAccess.response.status, 401);
    assert.equal(staleAccess.body.error, 'Invalid or expired token');

    const user = await User.findOne({ email: 'reset-login@example.com' }).select('+passwordHash');
    assert.equal(await bcrypt.compare('new-password-123', user.passwordHash), true);
    assert.equal(await bcrypt.compare('old-password-123', user.passwordHash), false);
    assert.equal(await Session.countDocuments({ userId: user._id, revokedAt: null }), 0);

    const oldRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldRefreshCookie}` },
    });
    assert.equal(oldRefresh.response.status, 401);

    const replay = await requestJson(server, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: rawToken, password: 'another-password-123' },
    });
    assert.equal(replay.response.status, 400);

    const newLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'reset-login@example.com', password: 'new-password-123' },
    });
    assert.equal(newLogin.response.status, 200);

    const newAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${newLogin.body.token}` },
    });
    assert.equal(newAccess.response.status, 200);
  } finally {
    await stopHttpServer(server);
  }
});

test('expired and invalid reset tokens are rejected without changing authentication', async () => {
  const server = await startHttpServer();

  try {
    const user = await authService.register({
      name: 'Expired Reset User',
      email: 'expired-reset@example.com',
      password: 'expired-reset-password',
    });
    await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: user.user.email },
    });
    const rawToken = getEmailToken(emailMessages.at(-1), 'reset_token');
    const record = await PasswordResetToken.findOne({ userId: user.user.id, consumedAt: null });
    await PasswordResetToken.updateOne({ _id: record._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const expired = await requestJson(server, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: rawToken, password: 'new-expired-password' },
    });
    assert.equal(expired.response.status, 400);

    const invalid = await requestJson(server, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: 'arc_reset_invalid', password: 'new-invalid-password' },
    });
    assert.equal(invalid.response.status, 400);
  } finally {
    await stopHttpServer(server);
  }
});

test('Google-only accounts do not receive a fake password reset token', async () => {
  const server = await startHttpServer();

  try {
    await User.create({
      email: 'google-reset@example.com',
      name: 'Google Reset User',
      role: USER_ROLES.USER,
      status: ACCOUNT_STATUSES.ACTIVE,
      emailVerified: true,
      google: {
        provider: GOOGLE_PROVIDER,
        subject: 'google-reset-subject',
        email: 'google-reset@example.com',
      },
    });

    const response = await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: 'google-reset@example.com' },
    });
    assert.equal(response.response.status, 200);
    assert.equal(response.body.message, 'If the account is eligible, a password reset email has been sent.');
    assert.equal(await PasswordResetToken.countDocuments({ userId: (await User.findOne({ email: 'google-reset@example.com' }))._id }), 0);
    assert.equal(emailMessages.filter((message) => message.to === 'google-reset@example.com').length, 0);
  } finally {
    await stopHttpServer(server);
  }
});

test('account-action routes are available through the compatibility auth mount', async () => {
  const server = await startHttpServer();

  try {
    const forgot = await requestJson(server, '/auth/forgot-password', {
      method: 'POST',
      body: { email: 'compatibility@example.com' },
    });
    assert.equal(forgot.response.status, 200);
    assert.equal(forgot.body.message, 'If the account is eligible, a password reset email has been sent.');

    const resend = await requestJson(server, '/auth/resend-verification', {
      method: 'POST',
      body: { email: 'compatibility@example.com' },
    });
    assert.equal(resend.response.status, 200);
    assert.equal(resend.body.message, 'If the account is eligible, a verification email has been sent.');

    const verify = await requestJson(server, '/auth/verify-email');
    assert.equal(verify.response.status, 400);
  } finally {
    await stopHttpServer(server);
  }
});

test('admin RBAC requires authentication and the current database ADMIN role', async () => {
  const server = await startHttpServer();

  try {
    const user = await registerAndLogin(server, 'rbac-user@example.com');
    const unauthenticated = await requestJson(server, '/api/v1/admin/users');
    assert.equal(unauthenticated.response.status, 401);

    const userRequest = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${user.loggedIn.body.token}` },
    });
    assert.equal(userRequest.response.status, 403);

    const admin = await provisionAndLoginAdmin(server, 'rbac-admin@example.com');
    const allowed = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(Array.isArray(allowed.body.users), true);
    assertNoSensitiveFields(allowed.body);

    const compatibility = await requestJson(server, '/admin/users', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(compatibility.response.status, 200);

    const userClaims = verifyAccessToken(user.loggedIn.body.token);
    const forgedAdminToken = signAccessToken({
      _id: user.registered.body.user.id,
      role: USER_ROLES.ADMIN,
      tokenVersion: userClaims.tokenVersion,
    });
    const forgedRoleRequest = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${forgedAdminToken}` },
    });
    assert.equal(forgedRoleRequest.response.status, 403);

    await User.updateOne(
      { _id: admin.admin.id },
      { $set: { role: USER_ROLES.USER } },
    );
    const changedDatabaseRole = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(changedDatabaseRole.response.status, 403);
  } finally {
    await stopHttpServer(server);
  }
});

test('admin user list and details are paginated and safely serialized', async () => {
  const server = await startHttpServer();

  try {
    const admin = await provisionAndLoginAdmin(server, 'list-admin@example.com');
    const firstUser = await registerAndLogin(server, 'list-user-one@example.com');
    await registerAndLogin(server, 'list-user-two@example.com');

    const firstPage = await requestJson(server, '/api/v1/admin/users?page=1&limit=1', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(firstPage.response.status, 200);
    assert.equal(firstPage.body.users.length, 1);
    assert.equal(firstPage.body.pagination.page, 1);
    assert.equal(firstPage.body.pagination.limit, 1);
    assert.equal(firstPage.body.pagination.total, 3);
    assert.equal(firstPage.body.pagination.totalPages, 3);
    assertNoSensitiveFields(firstPage.body);

    const secondPage = await requestJson(server, '/api/v1/admin/users?page=2&limit=1', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(secondPage.response.status, 200);
    assert.equal(secondPage.body.users.length, 1);
    assert.notEqual(secondPage.body.users[0].id, firstPage.body.users[0].id);

    const clamped = await requestJson(server, '/api/v1/admin/users?limit=999', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(clamped.response.status, 200);
    assert.equal(clamped.body.pagination.limit, 100);

    for (const query of ['page=0', 'limit=0', 'page=NaN', 'limit=Infinity', 'limit=-1']) {
      const invalid = await requestJson(server, `/api/v1/admin/users?${query}`, {
        headers: { authorization: `Bearer ${admin.token}` },
      });
      assert.equal(invalid.response.status, 400, query);
    }

    const details = await requestJson(server, `/api/v1/admin/users/${firstUser.registered.body.user.id}`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(details.response.status, 200);
    assert.equal(details.body.user.id, firstUser.registered.body.user.id);
    assertNoSensitiveFields(details.body);

    const invalidId = await requestJson(server, '/api/v1/admin/users/not-an-object-id', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(invalidId.response.status, 400);

    const missing = await requestJson(server, '/api/v1/admin/users/000000000000000000000000', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(missing.response.status, 404);
  } finally {
    await stopHttpServer(server);
  }
});

test('admin status management deactivates and reactivates users without issuing tokens', async () => {
  const server = await startHttpServer();

  try {
    const admin = await provisionAndLoginAdmin(server, 'status-admin@example.com');
    const target = await registerAndLogin(server, 'status-target@example.com');
    const targetId = target.registered.body.user.id;

    const deactivated = await requestJson(server, `/api/v1/admin/users/${targetId}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { status: 'INACTIVE' },
    });
    assert.equal(deactivated.response.status, 200);
    assert.equal(deactivated.body.user.status, ACCOUNT_STATUSES.SUSPENDED);
    assert.equal(deactivated.body.token, undefined);
    assertNoSensitiveFields(deactivated.body);

    const staleAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${target.loggedIn.body.token}` },
    });
    assert.equal(staleAccess.response.status, 401);

    const staleRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${target.refreshCookie}` },
    });
    assert.equal(staleRefresh.response.status, 401);
    assert.equal(await Session.countDocuments({ userId: targetId, revokedAt: null }), 0);

    const inactiveDetails = await requestJson(server, `/api/v1/admin/users/${targetId}`, {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(inactiveDetails.response.status, 200);
    assert.equal(inactiveDetails.body.user.status, ACCOUNT_STATUSES.SUSPENDED);

    const reactivated = await requestJson(server, `/api/v1/admin/users/${targetId}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { status: 'ACTIVE' },
    });
    assert.equal(reactivated.response.status, 200);
    assert.equal(reactivated.body.user.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(reactivated.body.token, undefined);

    const stillStale = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${target.loggedIn.body.token}` },
    });
    assert.equal(stillStale.response.status, 401);

    const newLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'status-target@example.com', password: 'session-password-123' },
    });
    assert.equal(newLogin.response.status, 200);
    const newAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${newLogin.body.token}` },
    });
    assert.equal(newAccess.response.status, 200);

    const selfDeactivation = await requestJson(server, `/api/v1/admin/users/${admin.admin.id.toUpperCase()}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { status: 'INACTIVE' },
    });
    assert.equal(selfDeactivation.response.status, 403);
    const adminStillValid = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(adminStillValid.response.status, 200);

    const invalidStatus = await requestJson(server, `/api/v1/admin/users/${targetId}/status`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { status: 'DELETED' },
    });
    assert.equal(invalidStatus.response.status, 400);
  } finally {
    await stopHttpServer(server);
  }
});

test('admin logout-all revokes a target user sessions and access tokens', async () => {
  const server = await startHttpServer();

  try {
    const admin = await provisionAndLoginAdmin(server, 'revoke-admin@example.com');
    const target = await registerAndLogin(server, 'revoke-target@example.com');

    const response = await requestJson(server, `/api/v1/admin/users/${target.registered.body.user.id}/logout-all`, {
      method: 'POST',
      headers: { authorization: `Bearer ${admin.token}` },
    });
    assert.equal(response.response.status, 200);
    assert.equal(response.body.message, 'All user sessions revoked');
    assert.equal(response.body.token, undefined);
    assertNoSensitiveFields(response.body);

    const staleAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${target.loggedIn.body.token}` },
    });
    assert.equal(staleAccess.response.status, 401);

    const staleRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${target.refreshCookie}` },
    });
    assert.equal(staleRefresh.response.status, 401);
    assert.equal(await Session.countDocuments({ userId: target.registered.body.user.id, revokedAt: null }), 0);

    const newLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'revoke-target@example.com', password: 'session-password-123' },
    });
    assert.equal(newLogin.response.status, 200);
  } finally {
    await stopHttpServer(server);
  }
});

test('admin role management is allowlisted, invalidates old tokens, and protects self-demotion', async () => {
  const server = await startHttpServer();

  try {
    const admin = await provisionAndLoginAdmin(server, 'role-admin@example.com');
    const target = await registerAndLogin(server, 'role-target@example.com');

    const userAttempt = await requestJson(server, `/api/v1/admin/users/${target.registered.body.user.id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${target.loggedIn.body.token}` },
      body: { role: USER_ROLES.ADMIN },
    });
    assert.equal(userAttempt.response.status, 403);

    const invalidRole = await requestJson(server, `/api/v1/admin/users/${target.registered.body.user.id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { role: 'SUPER_ADMIN' },
    });
    assert.equal(invalidRole.response.status, 400);

    const promoted = await requestJson(server, `/api/v1/admin/users/${target.registered.body.user.id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { role: USER_ROLES.ADMIN },
    });
    assert.equal(promoted.response.status, 200);
    assert.equal(promoted.body.user.role, USER_ROLES.ADMIN);
    assertNoSensitiveFields(promoted.body);

    const staleTargetAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${target.loggedIn.body.token}` },
    });
    assert.equal(staleTargetAccess.response.status, 401);

    const staleTargetRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${target.refreshCookie}` },
    });
    assert.equal(staleTargetRefresh.response.status, 401);
    assert.equal(await Session.countDocuments({ userId: target.registered.body.user.id, revokedAt: null }), 0);

    const promotedLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'role-target@example.com', password: 'session-password-123' },
    });
    assert.equal(promotedLogin.response.status, 200);
    assert.equal(promotedLogin.body.user.role, USER_ROLES.ADMIN);

    const promotedAdminRequest = await requestJson(server, '/api/v1/admin/users', {
      headers: { authorization: `Bearer ${promotedLogin.body.token}` },
    });
    assert.equal(promotedAdminRequest.response.status, 200);

    const selfDemotion = await requestJson(server, `/api/v1/admin/users/${admin.admin.id.toUpperCase()}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { role: USER_ROLES.USER },
    });
    assert.equal(selfDemotion.response.status, 403);
    assert.equal((await User.findById(admin.admin.id)).role, USER_ROLES.ADMIN);

    const demoted = await requestJson(server, `/api/v1/admin/users/${target.registered.body.user.id}/role`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${admin.token}` },
      body: { role: USER_ROLES.USER },
    });
    assert.equal(demoted.response.status, 200);
    assert.equal(demoted.body.user.role, USER_ROLES.USER);

    const demotedAdminAccess = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${promotedLogin.body.token}` },
    });
    assert.equal(demotedAdminAccess.response.status, 401);
  } finally {
    await stopHttpServer(server);
  }
});

test('registration accepts Unicode usernames, preserves the entered form, and keeps uniqueness case-insensitive', async () => {
  const server = await startHttpServer();

  try {
    const registered = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        username: 'Ankit Das',
        email: 'username-owner@example.com',
        password: 'username-owner-password',
      },
    });
    assert.equal(registered.response.status, 201);
    assert.equal(registered.body.user.username, 'Ankit Das');
    assert.equal(registered.body.user.usernameSetupRequired, false);
    assert.equal(registered.body.user.name, '');
    assert.equal(registered.body.user.displayName, '');

    const stored = await User.findOne({ email: 'username-owner@example.com' })
      .select('+usernameNormalized');
    // The visible username keeps the exact entered form; the normalized value
    // exists only for comparison and uniqueness.
    assert.equal(stored.username, 'Ankit Das');
    assert.equal(stored.usernameNormalized, 'ankit das');

    const duplicate = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        username: 'ANKIT DAS',
        email: 'username-duplicate@example.com',
        password: 'username-duplicate-password',
      },
    });
    assert.equal(duplicate.response.status, 409);
    assert.equal(duplicate.body.error, 'That username is already taken');

    const unavailable = await requestJson(
      server,
      '/api/v1/account/username-availability?username=AnKiT%20DaS',
    );
    assert.equal(unavailable.response.status, 200);
    assert.deepEqual(unavailable.body, { available: false });

    const compatibility = await requestJson(
      server,
      '/account/username-availability?username=available_name',
    );
    assert.deepEqual(compatibility.body, { available: true });

    const legacy = await requestJson(server, '/api/v1/auth/register', {
      method: 'POST',
      body: {
        email: 'legacy-username@example.com',
        password: 'legacy-username-password',
      },
    });
    assert.equal(legacy.response.status, 201);
    assert.equal(legacy.body.user.username, null);
    assert.equal(legacy.body.user.usernameSetupRequired, true);
  } finally {
    await stopHttpServer(server);
  }
});

test('username rules allow visible Unicode and reject unsafe, out-of-range and reserved values', () => {
  // Exactly 20 code points, plus 20 code points that need 40 UTF-16 units.
  const twentyCharacters = 'Ankit Das Arcadia 25';
  assert.equal(getUsernameLength(twentyCharacters), 20);
  const twentyEmoji = '\u{1F600}'.repeat(20);
  assert.equal(getUsernameLength(twentyEmoji), 20);
  assert.equal(twentyEmoji.length, 40);

  const accepted = [
    'Ankit',
    'Ankit Das',
    'Ankit_Das',
    'Ankit@Arcadia',
    'ARCADIA 25',
    'Ａｎｋｉｔ',
    'Ankit ⚡',
    'player!',
    '<script>',
    '../../',
    '\u{1F600}ab',
    twentyCharacters,
    twentyEmoji,
  ];

  for (const username of accepted) {
    assert.equal(getUsernameValidationError(username), null, username);
    // The stored visible form keeps the exact entered characters.
    assert.equal(toDisplayUsername(username), username, username);
  }

  const rejected = [
    '',
    '   ',
    'ab',
    '\u{1F642}',
    'Ankit Das Arcadia 250',
    'bad\u0001name',
    'zero\u200bwidth',
    'bidi\u202Eoverride',
    'line\u2028break',
    'private\uE000use',
    'admin',
    'Admin',
    'ARCADIA',
    'help',
  ];

  for (const username of rejected) {
    assert.notEqual(getUsernameValidationError(username), null, username);
  }

  // Reserved names stay blocked regardless of the allowed character set.
  for (const reserved of RESERVED_USERNAMES) {
    assert.notEqual(getUsernameValidationError(reserved), null, reserved);
    assert.notEqual(getUsernameValidationError(reserved.toUpperCase()), null, reserved);
  }

  // Only the comparison value is case folded; the visible value never is.
  assert.equal(normalizeUsername('Ankit Das'), 'ankit das');
  assert.equal(toDisplayUsername('Ankit Das'), 'Ankit Das');
  assert.equal(normalizeUsername('ANKIT@Arcadia'), 'ankit@arcadia');
  assert.equal(toDisplayUsername('  Ankit Das  '), 'Ankit Das');
});

test('registration and availability enforce the same username rules over HTTP', async () => {
  const server = await startHttpServer();

  try {
    // Representative accepted values: visible punctuation, spaces, uppercase,
    // Unicode and an emoji-counted username must all be stored as entered.
    const accepted = ['Ankit@Arcadia', 'Ａｎｋｉｔ', '\u{1F600}ab'];
    for (const [index, username] of accepted.entries()) {
      const response = await requestJson(server, '/api/v1/auth/register', {
        method: 'POST',
        body: {
          username,
          email: `username-valid-${index}@example.com`,
          password: 'username-valid-password',
        },
      });
      assert.equal(response.response.status, 201, username);
      assert.equal(response.body.user.username, username, username);

      const available = await requestJson(
        server,
        `/api/v1/account/username-availability?username=${encodeURIComponent(username)}`,
      );
      assert.equal(available.response.status, 200, username);
      assert.deepEqual(available.body, { available: false }, username);
    }

    // Rejected values stay rejected over HTTP, and availability never leaks or
    // accepts an invalid, unsafe or reserved name.
    const rejected = ['', 'ab', 'zero\u200bwidth', 'admin', 'Ankit Das Arcadia 250'];
    for (const [index, username] of rejected.entries()) {
      const response = await requestJson(server, '/api/v1/auth/register', {
        method: 'POST',
        body: {
          username,
          email: `username-invalid-${index}@example.com`,
          password: 'username-invalid-password',
        },
      });
      assert.equal(response.response.status, 400, username);

      const available = await requestJson(
        server,
        `/api/v1/account/username-availability?username=${encodeURIComponent(username)}`,
      );
      assert.equal(available.response.status, 200, username);
      assert.deepEqual(available.body, { available: false }, username);
    }
  } finally {
    await stopHttpServer(server);
  }
});

test('username setup is atomic, cooldown-protected, and cannot mass-assign security fields', async () => {
  const server = await startHttpServer();

  try {
    const account = await registerAndLogin(server, 'username-setup@example.com');
    const userId = account.registered.body.user.id;
    const originalVersion = (await User.findById(userId)).tokenVersion;

    const available = await requestJson(
      server,
      '/api/v1/account/username-availability?username=Player_01',
    );
    assert.deepEqual(available.body, { available: true });

    const massAssignment = await requestJson(server, '/api/v1/account/username', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: {
        username: 'Player_01',
        role: USER_ROLES.ADMIN,
        status: ACCOUNT_STATUSES.SUSPENDED,
        tokenVersion: 99,
      },
    });
    assert.equal(massAssignment.response.status, 400);

    const first = await requestJson(server, '/api/v1/account/username', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: { username: 'Player_01' },
    });
    assert.equal(first.response.status, 200);
    assert.equal(first.body.user.username, 'Player_01');

    const cooldown = await requestJson(server, '/api/v1/account/username', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: { username: 'player_02' },
    });
    assert.equal(cooldown.response.status, 429);
    assert.equal(cooldown.body.error, 'Username can be changed once every 60 seconds');

    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { usernameChangedAt: new Date(Date.now() - USERNAME_CHANGE_COOLDOWN_MS - 1000) } },
    );
    const second = await requestJson(server, '/api/v1/account/username', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: { username: 'PLAYER_02' },
    });
    assert.equal(second.response.status, 200);
    assert.equal(second.body.user.username, 'PLAYER_02');

    // A case-only change keeps the same comparison value but must still update
    // the visible username instead of being treated as a no-op.
    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { usernameChangedAt: new Date(Date.now() - USERNAME_CHANGE_COOLDOWN_MS - 1000) } },
    );
    const recased = await requestJson(server, '/api/v1/account/username', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: { username: 'player_02' },
    });
    assert.equal(recased.response.status, 200);
    assert.equal(recased.body.user.username, 'player_02');

    const stored = await User.findById(userId);
    assert.equal(stored.role, USER_ROLES.USER);
    assert.equal(stored.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(stored.tokenVersion, originalVersion);
    assert.equal(stored.email, 'username-setup@example.com');
  } finally {
    await stopHttpServer(server);
  }
});

test('profile and settings return safe data and only allow display-name updates', async () => {
  const server = await startHttpServer();

  try {
    const account = await registerAndLogin(server, 'profile-safe@example.com');
    const headers = { authorization: `Bearer ${account.loggedIn.body.token}` };
    const profile = await requestJson(server, '/api/v1/account/profile', { headers });
    assert.equal(profile.response.status, 200);
    assert.equal(profile.body.user.username, null);
    assert.equal(profile.body.user.displayName, 'Session User');
    assert.equal(profile.body.user.avatar.type, 'local');
    assert.equal(profile.body.user.googleAvatarAvailable, false);
    assertNoSensitiveFields(profile.body);

    const settings = await requestJson(server, '/api/v1/account/settings', { headers });
    assert.equal(settings.response.status, 200);
    assert.equal(settings.body.settings.email, 'profile-safe@example.com');
    assertNoSensitiveFields(settings.body);

    const updated = await requestJson(server, '/api/v1/account/profile', {
      method: 'PATCH',
      headers,
      body: { displayName: '  Arcadia   Player  ' },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.user.displayName, 'Arcadia Player');

    for (const displayName of ['<script>alert(1)</script>', 'Bad\u0001Name', 'Bad\nName', 'x'.repeat(81)]) {
      const invalid = await requestJson(server, '/api/v1/account/profile', {
        method: 'PATCH',
        headers,
        body: { displayName },
      });
      assert.equal(invalid.response.status, 400);
    }

    const massAssignment = await requestJson(server, '/api/v1/account/profile', {
      method: 'PATCH',
      headers,
      body: {
        displayName: 'Safe Name',
        role: USER_ROLES.ADMIN,
        status: ACCOUNT_STATUSES.SUSPENDED,
        email: 'changed@example.com',
        tokenVersion: 99,
        google: { provider: GOOGLE_PROVIDER },
      },
    });
    assert.equal(massAssignment.response.status, 400);

    const stored = await User.findById(account.registered.body.user.id);
    assert.equal(stored.displayName, 'Arcadia Player');
    assert.equal(stored.role, USER_ROLES.USER);
    assert.equal(stored.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(stored.email, 'profile-safe@example.com');
    assert.equal(stored.google?.provider, undefined);
    assert.equal(stored.google?.subject, undefined);
  } finally {
    await stopHttpServer(server);
  }
});

test('local avatar selection is authoritative and cannot mutate account identity or accept URLs', async () => {
  const server = await startHttpServer();

  try {
    const account = await registerAndLogin(server, 'local-avatar@example.com');
    const headers = { authorization: `Bearer ${account.loggedIn.body.token}` };
    const before = await User.findById(account.registered.body.user.id).select('+tokenVersion');

    const selected = await requestJson(server, '/api/v1/account/avatar', {
      method: 'PATCH',
      headers,
      body: { type: 'local', value: 'avatar-03' },
    });
    assert.equal(selected.response.status, 200);
    assert.deepEqual(selected.body.user.avatar, { type: 'local', value: 'avatar-03' });
    assert.equal(selected.body.user.avatarSource, 'local');

    for (const body of [
      { type: 'local', value: 'avatar-99' },
      { type: 'url', value: 'https://example.com/avatar.png' },
      { type: 'google', value: 'https://example.com/google.png' },
    ]) {
      const invalid = await requestJson(server, '/api/v1/account/avatar', {
        method: 'PATCH',
        headers,
        body,
      });
      assert.equal(invalid.response.status, 400);
    }

    const after = await User.findById(account.registered.body.user.id).select('+tokenVersion');
    assert.equal(after.username, before.username);
    assert.equal(after.email, before.email);
    assert.equal(after.role, before.role);
    assert.equal(after.status, before.status);
    assert.equal(after.tokenVersion, before.tokenVersion);
    assert.equal(after.google?.provider, undefined);
    assert.equal(after.google?.subject, undefined);
  } finally {
    await stopHttpServer(server);
  }
});

test('verified Google avatars can switch both ways and fall back safely when unavailable', async () => {
  const server = await startHttpServer();

  try {
    setGoogleMock();
    const started = await startGoogleOAuth(server);
    const callback = await completeGoogleCallback(server, {
      state: started.state,
      stateCookie: started.stateCookie,
    });
    const handoffCode = getLocationQuery(callback.response.headers.get('location'), 'oauth_code');
    const refreshCookie = getRefreshCookie(callback.response);
    const exchanged = await requestJson(server, '/api/v1/auth/google/exchange', {
      method: 'POST',
      body: { code: handoffCode },
    });
    const headers = {
      authorization: `Bearer ${exchanged.body.token}`,
      cookie: `${REFRESH_COOKIE_NAME}=${refreshCookie}`,
    };

    const profile = await requestJson(server, '/api/v1/account/profile', { headers });
    assert.equal(profile.body.user.googleAvatarAvailable, true);
    assert.equal(
      profile.body.user.googleAvatarUrl,
      'https://lh3.googleusercontent.com/a/arcadia-test-profile',
    );
    assert.equal(profile.body.user.avatar.type, 'google');

    const userId = profile.body.user.id;
    const before = await User.findById(userId).select('+tokenVersion');
    const googleAvatar = await requestJson(server, '/api/v1/account/avatar', {
      method: 'PATCH',
      headers,
      body: { type: 'google' },
    });
    assert.equal(googleAvatar.response.status, 200);
    assert.deepEqual(googleAvatar.body.user.avatar, { type: 'google', value: 'google' });

    const localAvatar = await requestJson(server, '/api/v1/account/avatar', {
      method: 'PATCH',
      headers,
      body: { type: 'local', value: LOCAL_AVATAR_IDS[4] },
    });
    assert.equal(localAvatar.response.status, 200);
    assert.equal(localAvatar.body.user.avatar.value, LOCAL_AVATAR_IDS[4]);

    await requestJson(server, '/api/v1/account/avatar', {
      method: 'PATCH',
      headers,
      body: { type: 'google' },
    });
    await User.updateOne({ _id: userId }, { $set: { 'google.pictureUrl': null } });
    const fallback = await requestJson(server, '/api/v1/account/profile', { headers });
    assert.equal(fallback.body.user.googleAvatarAvailable, false);
    assert.equal(fallback.body.user.googleAvatarUrl, null);
    assert.equal(fallback.body.user.avatar.type, 'local');

    const after = await User.findById(userId).select('+tokenVersion');
    assert.equal(after.email, before.email);
    assert.equal(after.role, before.role);
    assert.equal(after.status, before.status);
    assert.equal(after.tokenVersion, before.tokenVersion);
    assert.equal(after.google.subject, before.google.subject);
  } finally {
    await stopHttpServer(server);
  }
});

test('password change verifies the current password, revokes sessions, and never configures Google-only accounts', async () => {
  const server = await startHttpServer();

  try {
    const account = await registerAndLogin(server, 'change-password@example.com');
    const oldAccessToken = account.loggedIn.body.token;
    const oldRefreshCookie = account.refreshCookie;
    const headers = { authorization: `Bearer ${oldAccessToken}` };

    const wrongCurrent = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers,
      body: { currentPassword: 'wrong-password', newPassword: 'new-password-123' },
    });
    assert.equal(wrongCurrent.response.status, 401);

    const weakPassword = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers,
      body: { currentPassword: 'session-password-123', newPassword: 'short' },
    });
    assert.equal(weakPassword.response.status, 400);

    const changed = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers,
      body: {
        currentPassword: 'session-password-123',
        newPassword: 'new-password-123',
      },
    });
    assert.equal(changed.response.status, 200);
    assertNoSensitiveFields(changed.body);

    const staleAccess = await requestJson(server, '/api/v1/auth/me', { headers });
    assert.equal(staleAccess.response.status, 401);
    const staleRefresh = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldRefreshCookie}` },
    });
    assert.equal(staleRefresh.response.status, 401);
    const oldLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'change-password@example.com', password: 'session-password-123' },
    });
    assert.equal(oldLogin.response.status, 401);
    const newLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'change-password@example.com', password: 'new-password-123' },
    });
    assert.equal(newLogin.response.status, 200);

    const googleUser = await User.create({
      email: 'google-password-change@example.com',
      name: 'Google Password User',
      displayName: 'Google Password User',
      google: {
        provider: GOOGLE_PROVIDER,
        subject: 'google-password-subject',
        email: 'google-password-change@example.com',
        pictureUrl: 'https://lh3.googleusercontent.com/a/google-password-user',
      },
      emailVerified: true,
    });
    const googleToken = signAccessToken(googleUser);
    const googleResponse = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers: { authorization: `Bearer ${googleToken}` },
      body: { currentPassword: 'anything', newPassword: 'new-password-123' },
    });
    assert.equal(googleResponse.response.status, 400);
    assert.equal(
      googleResponse.body.error,
      'Password authentication is not configured for this account',
    );
    const unchangedGoogleUser = await User.findById(googleUser._id).select('+passwordHash');
    assert.equal(unchangedGoogleUser.passwordHash, undefined);
  } finally {
    await stopHttpServer(server);
  }
});

test('account sessions are owner-scoped, safely listed, individually revocable, and support logout-others', async () => {
  const server = await startHttpServer();

  try {
    const account = await registerAndLogin(server, 'sessions-owner@example.com');
    const secondLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'sessions-owner@example.com', password: 'session-password-123' },
    });
    const thirdLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'sessions-owner@example.com', password: 'session-password-123' },
    });
    const currentCookie = getRefreshCookie(thirdLogin.response);
    const currentHash = hashRefreshToken(currentCookie);
    const currentSession = await Session.findOne({ refreshTokenHash: currentHash });
    const otherOwnSession = await Session.findOne({
      userId: account.registered.body.user.id,
      _id: { $ne: currentSession._id },
      revokedAt: null,
    });
    const headers = {
      authorization: `Bearer ${thirdLogin.body.token}`,
      cookie: `${REFRESH_COOKIE_NAME}=${currentCookie}`,
    };

    const listed = await requestJson(server, '/api/v1/account/sessions', { headers });
    assert.equal(listed.response.status, 200);
    assert.equal(listed.body.sessions.length, 4);
    assert.equal(listed.body.sessions.filter((session) => session.current).length, 1);
    assertNoSensitiveFields(listed.body);
    for (const session of listed.body.sessions) {
      assert.deepEqual(
        Object.keys(session).sort(),
        ['createdAt', 'current', 'device', 'expiresAt', 'id', 'lastUsedAt'].sort(),
      );
    }

    const otherAccount = await registerAndLogin(server, 'sessions-other@example.com');
    const foreignSession = await Session.findOne({
      userId: otherAccount.registered.body.user.id,
      revokedAt: null,
    });
    const foreignAttempt = await requestJson(
      server,
      `/api/v1/account/sessions/${foreignSession._id}`,
      { method: 'DELETE', headers },
    );
    assert.equal(foreignAttempt.response.status, 404);
    assert.ok(await Session.findById(foreignSession._id));

    const revoked = await requestJson(
      server,
      `/api/v1/account/sessions/${otherOwnSession._id}`,
      { method: 'DELETE', headers },
    );
    assert.equal(revoked.response.status, 200);
    assert.equal(revoked.body.current, false);
    assert.equal(getSetCookieHeader(revoked.response), '');

    const logoutOthers = await requestJson(
      server,
      '/api/v1/account/sessions/logout-others',
      { method: 'POST', headers },
    );
    assert.equal(logoutOthers.response.status, 200);
    assert.equal(logoutOthers.body.revokedCount, 2);
    assert.equal(
      await Session.countDocuments({ userId: account.registered.body.user.id, revokedAt: null }),
      1,
    );

    const newCurrentLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: 'sessions-owner@example.com', password: 'session-password-123' },
    });
    const newCurrentCookie = getRefreshCookie(newCurrentLogin.response);
    const revokeCurrent = await requestJson(
      server,
      `/api/v1/account/sessions/${(await Session.findOne({
        refreshTokenHash: hashRefreshToken(newCurrentCookie),
      }))._id}`,
      {
        method: 'DELETE',
        headers: {
          authorization: `Bearer ${newCurrentLogin.body.token}`,
          cookie: `${REFRESH_COOKIE_NAME}=${newCurrentCookie}`,
        },
      },
    );
    assert.equal(revokeCurrent.response.status, 200);
    assert.equal(revokeCurrent.body.current, true);
    assert.match(getSetCookieHeader(revokeCurrent.response), /arcadia_refresh=;/i);
  } finally {
    await stopHttpServer(server);
  }
});

test('environment validation requires a database URI and a sufficiently long JWT secret', () => {
  const validSecret = 'a'.repeat(32);
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: '', JWT_SECRET: validSecret }),
    /MONGODB_URI is required/,
  );
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: 'mongodb://localhost/arcadia', JWT_SECRET: 'short' }),
    /JWT_SECRET must be at least 32 characters/,
  );
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: 'mongodb+srv://cluster.example', JWT_SECRET: 'a'.repeat(32) }),
    /MONGODB_URI must include a database name/,
  );
});

test('security headers, explicit CORS, and CSRF protection are enforced', async () => {
  const server = await startHttpServer();
  try {
    const missing = await requestJson(server, '/api/v1/account/profile');
    assert.equal(missing.response.headers.get('x-powered-by'), null);
    assert.equal(missing.response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(missing.response.headers.get('x-frame-options'), 'DENY');
    assert.equal(missing.response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(missing.response.headers.get('cache-control'), 'no-store');
    assert.match(missing.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);

    const allowed = await requestJson(server, '/api/v1/account/username-availability?username=allowed_user', {
      headers: { origin: 'http://localhost:5173' },
    });
    assert.equal(allowed.response.status, 200);
    assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(allowed.response.headers.get('access-control-allow-credentials'), 'true');

    const rejected = await requestJson(server, '/api/v1/account/username-availability?username=allowed_user', {
      headers: { origin: 'https://evil.example' },
    });
    assert.equal(rejected.response.status, 403);
    assert.equal(rejected.response.headers.get('access-control-allow-origin'), null);

    const preflight = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'X-Arcadia-Request',
      },
    });
    assert.equal(preflight.response.status, 204);
    assert.equal(preflight.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');

    const csrf = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      csrfHeader: false,
      headers: { origin: 'http://localhost:5173' },
      body: { email: 'csrf@example.com', password: 'csrf-password-123' },
    });
    assert.equal(csrf.response.status, 403);
    assert.equal(csrf.body.error, 'Request verification failed');

    const notFound = await requestJson(server, '/api/v1/no-such-route');
    assert.equal(notFound.response.status, 404);
    assert.equal(notFound.body.error, 'Route not found');
  } finally {
    await stopHttpServer(server);
  }
});

test('sensitive login requests receive a generic rate-limit response', async () => {
  const server = await startHttpServer();
  try {
    let last;
    for (let index = 0; index < 21; index += 1) {
      last = await requestJson(server, '/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'rate-limit@example.com', password: 'short' },
      });
    }
    assert.equal(last.response.status, 429);
    assert.equal(last.body.error, 'Too many requests. Please try again later.');
    assert.ok(Number(last.response.headers.get('retry-after')) >= 1);
    assert.equal(last.response.headers.get('ratelimit-limit'), '20');
    assert.notEqual(last.response.headers.get('access-control-allow-origin'), '*');
  } finally {
    await stopHttpServer(server);
  }
});

test('hostile JWT claims and authorization headers fail closed', async () => {
  const server = await startHttpServer();
  try {
    const account = await registerAndLogin(server, 'hostile-jwt@example.com');
    const userId = account.loggedIn.body.user.id;
    const now = Math.floor(Date.now() / 1000);
    const base = {
      sub: userId,
      role: 'USER',
      type: 'access',
      tokenVersion: 0,
      iat: now,
      exp: now + 300,
    };
    const token = (payload, options = {}) => jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      issuer: 'arcadia-backend',
      audience: 'arcadia-web',
      jwtid: crypto.randomUUID(),
      noTimestamp: true,
      ...options,
    });
    const { exp: _exp, ...withoutExpiration } = base;
    const hostileTokens = [
      jwt.sign(base, 'wrong-secret', {
        algorithm: 'HS256',
        issuer: 'arcadia-backend',
        audience: 'arcadia-web',
        jwtid: crypto.randomUUID(),
        noTimestamp: true,
      }),
      token({ ...base, type: 'refresh' }),
      token({ ...base, sub: 'not-an-object-id' }),
      token({ ...base, tokenVersion: '0' }),
      token({ ...base, role: 'SUPER_ADMIN' }),
      token(withoutExpiration),
      token(base, { algorithm: 'HS384' }),
    ];
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(base)).toString('base64url');
    hostileTokens.push(`${header}.${payload}.`);

    for (const hostileToken of hostileTokens) {
      const response = await requestJson(server, '/api/v1/auth/me', {
        headers: { authorization: `Bearer ${hostileToken}` },
      });
      assert.equal(response.response.status, 401);
    }

    for (const malformedHeader of ['Basic token', 'Bearer', 'Bearer one two', 'Bearer a.b.c.d']) {
      const response = await requestJson(server, '/api/v1/auth/me', {
        headers: { authorization: malformedHeader },
      });
      assert.equal(response.response.status, 401);
    }

    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { tokenVersion: 'malformed' } },
    );
    const malformedPersistedVersion = await requestJson(server, '/api/v1/auth/me', {
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
    });
    assert.equal(malformedPersistedVersion.response.status, 401);
  } finally {
    await stopHttpServer(server);
  }
});

test('concurrent refresh rotation does not revoke the winning session', async () => {
  const server = await startHttpServer();
  try {
    const account = await registerAndLogin(server, 'concurrent-refresh@example.com');
    const oldCookie = account.refreshCookie;
    const responses = await Promise.all([
      requestJson(server, '/api/v1/auth/refresh', {
        method: 'POST',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldCookie}` },
      }),
      requestJson(server, '/api/v1/auth/refresh', {
        method: 'POST',
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldCookie}` },
      }),
    ]);
    const statuses = responses.map((result) => result.response.status).sort();
    assert.deepEqual(statuses, [200, 401]);
    const winner = responses.find((result) => result.response.status === 200);
    const oldSession = await Session.findOne({ refreshTokenHash: hashRefreshToken(oldCookie) });
    assert.equal(await Session.countDocuments({ familyId: oldSession.familyId, revokedAt: null }), 1);
    const winnerCookie = getRefreshCookie(winner.response);
    const usable = await requestJson(server, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE_NAME}=${winnerCookie}` },
    });
    assert.equal(usable.response.status, 200);
  } finally {
    await stopHttpServer(server);
  }
});

test('outstanding password-reset tokens are consumed by a password change', async () => {
  const server = await startHttpServer();
  try {
    const account = await registerAndLogin(server, 'reset-invalidation@example.com');
    const forgot = await requestJson(server, '/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: account.loggedIn.body.user.email },
    });
    assert.equal(forgot.response.status, 200);
    const resetToken = getEmailToken(emailMessages.at(-1), 'reset_token');
    const resetRecord = await PasswordResetToken.findOne({ tokenHash: hashSecureToken(resetToken) });
    assert.equal(resetRecord.credentialVersion, 0);
    const changed = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: {
        currentPassword: 'session-password-123',
        newPassword: 'new-session-password-123',
        role: 'ADMIN',
      },
    });
    assert.equal(changed.response.status, 400);

    const validChange = await requestJson(server, '/api/v1/account/change-password', {
      method: 'POST',
      headers: { authorization: `Bearer ${account.loggedIn.body.token}` },
      body: {
        currentPassword: 'session-password-123',
        newPassword: 'new-session-password-123',
      },
    });
    assert.equal(validChange.response.status, 200);
    const resetAttempt = await requestJson(server, '/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, password: 'attacker-password-123' },
    });
    assert.equal(resetAttempt.response.status, 400);
    const newLogin = await requestJson(server, '/api/v1/auth/login', {
      method: 'POST',
      body: { email: account.loggedIn.body.user.email, password: 'new-session-password-123' },
    });
    assert.equal(newLogin.response.status, 200);
  } finally {
    await stopHttpServer(server);
  }
});

test('OAuth state and handoff consumption are single-use under concurrency', async () => {
  const stateTransaction = await googleOAuthService.createOAuthState();
  const stateResults = await Promise.allSettled([
    googleOAuthService.consumeOAuthState({
      state: stateTransaction.state,
      stateCookie: stateTransaction.state,
    }),
    googleOAuthService.consumeOAuthState({
      state: stateTransaction.state,
      stateCookie: stateTransaction.state,
    }),
  ]);
  assert.equal(stateResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(stateResults.filter((result) => result.status === 'rejected').length, 1);

  const created = await authService.register({
    name: 'OAuth Race User',
    email: 'oauth-race@example.com',
    password: 'oauth-race-password-123',
  });
  const refreshService = require('../services/refreshSessionService');
  const session = await refreshService.createRefreshSession({
    userId: created.user.id,
    req: { ip: '127.0.0.1', get: () => 'oauth-race' },
  });
  const code = await googleOAuthService.createOAuthHandoff({
    userId: created.user.id,
    sessionId: session.session._id,
    credentialVersion: 0,
  });
  const handoffResults = await Promise.allSettled([
    googleOAuthService.consumeOAuthHandoff(code),
    googleOAuthService.consumeOAuthHandoff(code),
  ]);
  assert.equal(handoffResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(handoffResults.filter((result) => result.status === 'rejected').length, 1);
});

test('production configuration fails closed for unsafe environments', () => {
  const secret = crypto.randomBytes(32).toString('hex');
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost/arcadia',
      JWT_SECRET: secret,
      FRONTEND_URL: 'http://example.com',
    }),
    /TLS|FRONTEND_URL|origin/i,
  );
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'prodction',
      MONGODB_URI: 'mongodb://localhost/arcadia',
      JWT_SECRET: secret,
    }),
    /NODE_ENV/,
  );
  assert.throws(
    () => validateEnvironment({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://cluster.example/arcadia?tls=true',
      JWT_SECRET: secret,
      FRONTEND_URL: 'https://example.com/path',
    }),
    /origin/i,
  );
});

test('production cookie and OAuth settings require secure explicit transport', () => {
  const script = `
    const refresh = require('./config/refreshCookie');
    const oauth = require('./config/oauthCookie');
    process.stdout.write(JSON.stringify({
      refresh: refresh.REFRESH_COOKIE_OPTIONS,
      oauth: oauth.OAUTH_STATE_COOKIE_OPTIONS,
    }));
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb+srv://cluster.example/arcadia?tls=true',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      FRONTEND_URL: 'https://accounts.example.com',
      CORS_ORIGIN: 'https://accounts.example.com',
      COOKIE_SAME_SITE: 'none',
      TRUST_PROXY: 'false',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  const options = JSON.parse(result.stdout);
  assert.equal(options.refresh.httpOnly, true);
  assert.equal(options.refresh.secure, true);
  assert.equal(options.refresh.sameSite, 'none');
  assert.equal(options.oauth.httpOnly, true);
  assert.equal(options.oauth.secure, true);
  assert.equal(options.oauth.sameSite, 'lax');
});

test('missing Google OAuth configuration returns a safe 503 instead of a generic server error', async () => {
  const server = await startHttpServer();
  const names = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'GOOGLE_FRONTEND_SUCCESS_URL',
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    const response = await requestJson(server, '/api/v1/auth/google');
    assert.equal(response.response.status, 503);
    assert.deepEqual(response.body, { error: 'Google OAuth is not configured' });
    assert.equal(response.response.headers.get('cache-control'), 'no-store');
  } finally {
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    }
    await stopHttpServer(server);
  }
});


