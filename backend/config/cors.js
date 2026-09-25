const { allowedOrigins } = require('./env');

const allowedOriginSet = new Set(allowedOrigins);

function normalizeOriginHeader(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim();
  }
}

function isAllowedOrigin(origin) {
  const normalized = normalizeOriginHeader(origin);
  return Boolean(normalized && allowedOriginSet.has(normalized));
}

function rejectUnexpectedOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  return next();
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Arcadia-Request'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  maxAge: 600,
  optionsSuccessStatus: 204,
};

module.exports = corsOptions;
module.exports.corsOptions = corsOptions;
module.exports.allowedOrigins = allowedOrigins;
module.exports.allowedOriginSet = allowedOriginSet;
module.exports.isAllowedOrigin = isAllowedOrigin;
module.exports.rejectUnexpectedOrigin = rejectUnexpectedOrigin;
