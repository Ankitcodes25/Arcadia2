const authService = require('../services/authService');
const { validateCredentials } = require('../validators/authValidator');

async function register(req, res, next) {
  try {
    const validationError = validateCredentials(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const result = await authService.register(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const validationError = validateCredentials(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

function me(req, res) {
  const user = authService.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ id: user.id, email: user.email, name: user.name });
}

module.exports = { register, login, me };
