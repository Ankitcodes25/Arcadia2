const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

module.exports = generateToken;
