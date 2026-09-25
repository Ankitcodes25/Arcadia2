const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hasRefreshCookie(req) {
  const cookie = req.get('cookie');
  return typeof cookie === 'string' && /(?:^|;\s*)arcadia_refresh=/.test(cookie);
}

function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const hasBrowserContext = Boolean(req.get('origin') || req.get('sec-fetch-site'));
  const hasClientHeader = req.get('x-arcadia-request') === '1';

  // Cookie-authenticated state changes always require the non-simple custom
  // header. This also protects clients that omit Origin/Fetch Metadata.
  if ((hasBrowserContext || hasRefreshCookie(req)) && !hasClientHeader) {
    return res.status(403).json({ error: 'Request verification failed' });
  }

  return next();
}

module.exports = csrfProtection;
