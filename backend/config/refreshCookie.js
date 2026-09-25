const { isProduction, cookieSameSite } = require('./env');

const REFRESH_COOKIE_NAME = 'arcadia_refresh';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const REFRESH_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true,
  secure: isProduction,
  sameSite: cookieSameSite,
  // The path covers both the versioned route and the compatibility alias.
  path: '/',
});

function parseCookieHeader(header) {
  if (typeof header !== 'string' || !header) {
    return {};
  }

  return header.split(';').reduce((cookies, part) => {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 1) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      return cookies;
    }

    return cookies;
  }, {});
}

function getRefreshToken(req) {
  const cookies = parseCookieHeader(req.headers && req.headers.cookie);
  return cookies[REFRESH_COOKIE_NAME] || null;
}

function setRefreshCookie(res, refreshToken) {
  return res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshCookie(res) {
  return res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
}

module.exports = {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
  REFRESH_COOKIE_OPTIONS,
  parseCookieHeader,
  getRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
};
