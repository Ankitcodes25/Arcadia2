const normalizeEmail = require('../utils/normalizeEmail');
const {
  getPasswordValidationError,
  getBcryptByteLengthError,
} = require('../utils/passwordPolicy');
const { getUsernameValidationError } = require('../utils/username');
const { getDisplayNameValidationError } = require('../utils/profileValidation');

function isRequestBody(body) {
  return body && typeof body === 'object' && !Array.isArray(body);
}

function validateEmail(email) {
  return normalizeEmail.isValidEmail(email);
}

function validateRegistration(body) {
  if (!isRequestBody(body)) {
    return 'Request body must be an object';
  }

  const { name, email, password, username } = body;

  /*
   * `name` is optional: Arcadia signup only asks for a username. The display
   * name is reserved for Google identity data or a later profile edit.
   */
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return 'Name is invalid';
    }

    const nameError = getDisplayNameValidationError(name);
    if (nameError) {
      return nameError;
    }
  }

  if (!validateEmail(email)) {
    return 'A valid email is required';
  }

  const passwordError = getPasswordValidationError(password);
  if (passwordError) {
    return passwordError;
  }

  if (username !== undefined) {
    const usernameError = getUsernameValidationError(username);
    if (usernameError) {
      return usernameError;
    }
  }

  return null;
}

function validateLogin(body) {
  if (!isRequestBody(body)) {
    return 'Request body must be an object';
  }

  const { email, password } = body;

  if (!validateEmail(email)) {
    return 'A valid email is required';
  }

  if (typeof password !== 'string' || !password) {
    return 'Password is required';
  }

  const passwordLengthError = getBcryptByteLengthError(password);
  if (passwordLengthError) {
    return passwordLengthError;
  }

  return null;
}

// Kept for older internal imports; registration now has its own validator.
function validateCredentials(body) {
  return validateLogin(body);
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateCredentials,
};
