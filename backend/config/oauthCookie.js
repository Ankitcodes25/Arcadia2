const { isProduction } = require('./env');
const { parseCookieHeader } = require('./refreshCookie');

const OAUTH_STATE_COOKIE_NAME = 'arcadia_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const OAUTH_STATE_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
});

function getOAuthStateCookie(req) {
  const cookies = parseCookieHeader(req.headers && req.headers.cookie);
  return cookies[OAUTH_STATE_COOKIE_NAME] || null;
}

function setOAuthStateCookie(res, state) {
  return res.cookie(OAUTH_STATE_COOKIE_NAME, state, {
    ...OAUTH_STATE_COOKIE_OPTIONS,
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

function clearOAuthStateCookie(res) {
  return res.clearCookie(OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_COOKIE_OPTIONS);
}

module.exports = {
  OAUTH_STATE_COOKIE_NAME,
  OAUTH_STATE_TTL_MS,
  OAUTH_STATE_COOKIE_OPTIONS,
  getOAuthStateCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
};
