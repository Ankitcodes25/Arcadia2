const { isProduction, securityHstsMaxAge } = require('../config/env');

function securityHeaders(req, res, next) {
  res.removeHeader('X-Powered-By');
  res.set({
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-DNS-Prefetch-Control': 'off',
    'X-Download-Options': 'noopen',
    'X-Frame-Options': 'DENY',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
  });

  if (isProduction && securityHstsMaxAge > 0) {
    res.set('Strict-Transport-Security', `max-age=${securityHstsMaxAge}; includeSubDomains`);
  }

  return next();
}

module.exports = securityHeaders;
