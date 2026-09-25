const accountActionService = require('../services/accountActionService');
const { clearRefreshCookie } = require('../config/refreshCookie');

function preventTokenResponseCaching(res) {
  res.set('Cache-Control', 'no-store');
}

async function verifyEmail(req, res, next) {
  preventTokenResponseCaching(res);
  try {
    const token = req.method === 'GET'
      ? (typeof req.query.token === 'string' ? req.query.token : null)
      : req.body && typeof req.body.token === 'string' ? req.body.token : null;
    const result = await accountActionService.verifyEmailToken(token);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function resendVerification(req, res, next) {
  preventTokenResponseCaching(res);
  try {
    const email = req.body && typeof req.body.email === 'string' ? req.body.email : '';
    const result = await accountActionService.resendVerification(email, req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  preventTokenResponseCaching(res);
  try {
    const email = req.body && typeof req.body.email === 'string' ? req.body.email : '';
    const result = await accountActionService.forgotPassword(email, req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function resetPassword(req, res, next) {
  preventTokenResponseCaching(res);
  try {
    const token = req.body && typeof req.body.token === 'string' ? req.body.token : null;
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    const result = await accountActionService.resetPassword({
      token,
      password,
      body: req.body,
    });
    clearRefreshCookie(res);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
