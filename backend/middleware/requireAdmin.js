const { USER_ROLES } = require('../models/User');

function requireAdmin(req, res, next) {
  if (!req.user || !req.auth || !req.auth.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // req.user is populated from the current database record by authMiddleware.
  // Authorization is never derived from the JWT role claim or request content.
  if (req.user.role !== USER_ROLES.ADMIN) {
    return res.status(403).json({ error: 'Administrator access required' });
  }

  return next();
}

module.exports = requireAdmin;
