const bcrypt = require('bcryptjs');
const { bcryptCost } = require('../config/env');

function getBcryptCost() {
  return bcryptCost;
}

async function hashPassword(password) {
  return bcrypt.hash(password, getBcryptCost());
}

async function needsRehash(passwordHash) {
  try {
    return bcrypt.getRounds(passwordHash) < getBcryptCost();
  } catch {
    return true;
  }
}

module.exports = {
  getBcryptCost,
  hashPassword,
  needsRehash,
};
