const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { users } = require('../models/userStore');
const { jwtSecret } = require('../config/env');

async function register({ email, password, name }) {
  if (users.find((user) => user.email === email)) {
    const error = new Error('Email exists');
    error.statusCode = 409;
    throw error;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: String(Date.now()), email, name: name || '', password: hashed };
  users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

async function login({ email, password }) {
  const user = users.find((candidate) => candidate.email === email);
  if (!user) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const error = new Error('Invalid credentials');
    error.statusCode = 401;
    throw error;
  }
  const token = jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

function getUserById(id) {
  return users.find((user) => user.id === id);
}

module.exports = { register, login, getUserById };
