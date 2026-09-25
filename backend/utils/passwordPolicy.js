const MIN_REGISTRATION_PASSWORD_LENGTH = 8;
const MIN_ADMIN_PASSWORD_LENGTH = 12;
const MAX_BCRYPT_PASSWORD_BYTES = 72;
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'qwerty123',
  '12345678',
  '123456789',
  'letmein123',
  'welcome123',
  'admin12345',
]);

function getBcryptByteLengthError(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
    return 'Password is too long';
  }
  return null;
}

function getPasswordValidationError(value, minimumLength = MIN_REGISTRATION_PASSWORD_LENGTH) {
  if (typeof value !== 'string' || value.length < minimumLength) {
    return `Password must be at least ${minimumLength} characters`;
  }

  const byteLengthError = getBcryptByteLengthError(value);
  if (byteLengthError) return byteLengthError;

  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return 'Choose a less common password';
  }

  return null;
}

module.exports = {
  MIN_REGISTRATION_PASSWORD_LENGTH,
  MIN_ADMIN_PASSWORD_LENGTH,
  MAX_BCRYPT_PASSWORD_BYTES,
  COMMON_PASSWORDS,
  getBcryptByteLengthError,
  getPasswordValidationError,
};
