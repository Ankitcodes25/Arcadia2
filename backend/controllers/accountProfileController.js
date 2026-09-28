const accountProfileService = require('../services/accountProfileService');
const matchHistoryService = require('../services/matchHistoryService');
const {
  getRefreshToken,
  clearRefreshCookie,
} = require('../config/refreshCookie');

function preventAccountResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}

async function checkUsernameAvailability(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const result = await accountProfileService.checkUsernameAvailability(
      req.query.username,
    );
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function getProfile(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const user = await accountProfileService.getProfile(req.user.id);
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function getSettings(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const settings = await accountProfileService.getSettings(req.user.id);
    return res.json({ settings });
  } catch (error) {
    return next(error);
  }
}

/*
 * The signed-in account's own match history.
 *
 * `req.user.id` comes from the verified access token, so a caller can only ever
 * read its own rows. There is no route that creates a match.
 */
async function getMatchHistory(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const history = await matchHistoryService.listMatchHistory({
      userId: req.user.id,
      query: req.query,
    });
    return res.json(history);
  } catch (error) {
    return next(error);
  }
}

async function setUsername(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const user = await accountProfileService.setUsername({
      userId: req.user.id,
      body: req.body,
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const user = await accountProfileService.updateProfile({
      userId: req.user.id,
      body: req.body,
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function updateAvatar(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const user = await accountProfileService.updateAvatar({
      userId: req.user.id,
      body: req.body,
    });
    return res.json({ user });
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const result = await accountProfileService.changePassword({
      userId: req.user.id,
      body: req.body,
    });
    clearRefreshCookie(res);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function listSessions(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const sessions = await accountProfileService.listSessions({
      userId: req.user.id,
      currentRefreshToken: getRefreshToken(req),
    });
    return res.json({ sessions });
  } catch (error) {
    return next(error);
  }
}

async function revokeSession(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const result = await accountProfileService.revokeSession({
      userId: req.user.id,
      sessionId: req.params.sessionId,
      currentRefreshToken: getRefreshToken(req),
    });
    if (result.current) {
      clearRefreshCookie(res);
    }
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function logoutOtherSessions(req, res, next) {
  preventAccountResponseCaching(res);
  try {
    const result = await accountProfileService.logoutOtherSessions({
      userId: req.user.id,
      currentRefreshToken: getRefreshToken(req),
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  checkUsernameAvailability,
  getProfile,
  getSettings,
  getMatchHistory,
  setUsername,
  updateProfile,
  updateAvatar,
  changePassword,
  listSessions,
  revokeSession,
  logoutOtherSessions,
};
