const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/accountProfileController');
const rateLimits = require('../middleware/rateLimit');

const router = express.Router();

// Public, non-enumerating availability lookup.
router.get('/username-availability', ...rateLimits.usernameAvailability, controller.checkUsernameAvailability);

// Every other account endpoint requires the existing access-token middleware.
router.use(authMiddleware);

// GET /api/v1/account/profile
router.get('/profile', controller.getProfile);
// GET /api/v1/account/settings
router.get('/settings', controller.getSettings);
// PATCH /api/v1/account/username
router.patch('/username', ...rateLimits.usernameChange, controller.setUsername);
// PATCH /api/v1/account/profile
router.patch('/profile', controller.updateProfile);
// PATCH /api/v1/account/avatar
router.patch('/avatar', controller.updateAvatar);
// POST /api/v1/account/change-password
router.post('/change-password', ...rateLimits.changePassword, controller.changePassword);
// GET /api/v1/account/sessions
router.get('/sessions', ...rateLimits.sessionManagement, controller.listSessions);
// POST /api/v1/account/sessions/logout-others
router.post('/sessions/logout-others', ...rateLimits.sessionManagement, controller.logoutOtherSessions);
// DELETE /api/v1/account/sessions/:sessionId
router.delete('/sessions/:sessionId', ...rateLimits.sessionManagement, controller.revokeSession);

module.exports = router;
