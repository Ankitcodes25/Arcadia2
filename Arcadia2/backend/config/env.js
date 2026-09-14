require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  port: process.env.PORT || 4000,
};
