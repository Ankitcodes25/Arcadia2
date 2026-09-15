function validateCredentials({ email, password }) {
  if (!email || !password) {
    return 'Missing email or password';
  }
  return null;
}

module.exports = { validateCredentials };
