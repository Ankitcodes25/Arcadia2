const { User, ACCOUNT_STATUSES } = require('../models/User');
const { toSafeUser } = require('../utils/safeUser');
const { verifyAccessToken, ACCESS_TOKEN_TYPE } = require('../utils/jwt');

function unauthorized(res, message = 'Authentication required') {
  res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
  return res.status(401).json({ error: message });
}

async function authMiddleware(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return unauthorized(res, 'Authentication required');
  }

  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return unauthorized(res, 'Invalid authentication header');
  }

  let payload;
  try {
    payload = verifyAccessToken(parts[1]);
  } catch {
    return unauthorized(res, 'Invalid or expired token');
  }

  if (payload.type !== ACCESS_TOKEN_TYPE) {
    return unauthorized(res, 'Invalid or expired token');
  }

  try {
    const user = await User.findById(payload.sub).select('-passwordHash');

    if (!user) {
      return unauthorized(res, 'Invalid or expired token');
    }

    if (
      !Number.isSafeInteger(user.tokenVersion)
      || user.tokenVersion < 0
      || payload.tokenVersion !== user.tokenVersion
    ) {
      return unauthorized(res, 'Invalid or expired token');
    }

    if (user.status !== ACCOUNT_STATUSES.ACTIVE) {
      return res.status(403).json({ error: 'Account is inactive' });
    }

    const safeUser = toSafeUser(user);
    req.user = safeUser;
    req.auth = {
      userId: safeUser.id,
      role: safeUser.role,
      tokenType: payload.type,
    };

    return next();
  } catch (error) {
    /*
     * A cast failure while loading the account means the stored record is
     * malformed, which covers the numeric security fields (`tokenVersion`) and
     * the numeric progression field (`totalXp`). Such a token is never trusted,
     * and the request fails closed with the same generic message.
     */
    if (error && error.name === 'CastError') {
      return unauthorized(res, 'Invalid or expired token');
    }
    return next(error);
  }
}

module.exports = authMiddleware;
