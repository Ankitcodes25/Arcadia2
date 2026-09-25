const adminUserService = require('../services/adminUserService');

function preventAdminResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}

function getAuthenticatedUserId(req) {
  return req.auth && req.auth.userId
    ? req.auth.userId
    : req.user && req.user.id;
}

async function listUsers(req, res, next) {
  preventAdminResponseCaching(res);
  try {
    const result = await adminUserService.listUsers(req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getUserDetails(req, res, next) {
  preventAdminResponseCaching(res);
  try {
    const user = await adminUserService.getUserDetails(req.params.userId);
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateUserStatus(req, res, next) {
  preventAdminResponseCaching(res);
  try {
    const user = await adminUserService.updateUserStatus({
      userId: req.params.userId,
      status: req.body && req.body.status,
      actingUserId: getAuthenticatedUserId(req),
      body: req.body,
    });
    return res.json({ message: 'User status updated', user });
  } catch (error) {
    return next(error);
  }
}

async function updateUserRole(req, res, next) {
  preventAdminResponseCaching(res);
  try {
    const user = await adminUserService.updateUserRole({
      userId: req.params.userId,
      role: req.body && req.body.role,
      actingUserId: getAuthenticatedUserId(req),
      body: req.body,
    });
    return res.json({ message: 'User role updated', user });
  } catch (error) {
    return next(error);
  }
}

async function logoutAllUserSessions(req, res, next) {
  preventAdminResponseCaching(res);
  try {
    await adminUserService.logoutAllUserSessions({
      userId: req.params.userId,
      actingUserId: getAuthenticatedUserId(req),
    });
    return res.json({ message: 'All user sessions revoked' });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listUsers,
  getUserDetails,
  updateUserStatus,
  updateUserRole,
  logoutAllUserSessions,
};
