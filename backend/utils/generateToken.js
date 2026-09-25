const { signAccessToken } = require('./jwt');

// Backward-compatible export for code that previously imported generateToken.
module.exports = signAccessToken;
