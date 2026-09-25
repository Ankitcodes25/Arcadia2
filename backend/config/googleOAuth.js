const { isAllowedOrigin } = require('./cors');

const REQUIRED_VARIABLES = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'GOOGLE_FRONTEND_SUCCESS_URL',
];

function optionalValue(source, name) {
  const value = source[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function createConfigurationError(
  message = 'Google OAuth is not configured',
  code = 'GOOGLE_OAUTH_NOT_CONFIGURED',
) {
  const error = new Error(message);
  error.statusCode = 503;
  error.expose = true;
  error.safeMessage = message;
  error.code = code;
  return error;
}

function validateUrl(value, name, nodeEnv = process.env.NODE_ENV) {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
      || url.hash
    ) {
      throw new Error('invalid url');
    }

    if (nodeEnv === 'production' && url.protocol !== 'https:') {
      throw new Error('https required');
    }
  } catch {
    throw createConfigurationError(
      `Google OAuth ${name} is invalid`,
      'GOOGLE_OAUTH_INVALID_CONFIG',
    );
  }
}

function getGoogleOAuthConfig(source = process.env) {
  const config = Object.fromEntries(
    REQUIRED_VARIABLES.map((name) => [name, optionalValue(source, name)]),
  );

  if (REQUIRED_VARIABLES.some((name) => !config[name])) {
    throw createConfigurationError();
  }

  const nodeEnv = source.NODE_ENV || process.env.NODE_ENV;
  validateUrl(config.GOOGLE_REDIRECT_URI, 'redirect URI', nodeEnv);
  validateUrl(config.GOOGLE_FRONTEND_SUCCESS_URL, 'success URL', nodeEnv);
  if (nodeEnv === 'production' && !isAllowedOrigin(config.GOOGLE_FRONTEND_SUCCESS_URL)) {
    throw createConfigurationError(
      'Google OAuth frontend success URL is not an allowed origin',
      'GOOGLE_OAUTH_INVALID_CONFIG',
    );
  }

  return Object.freeze({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI,
    frontendSuccessUrl: config.GOOGLE_FRONTEND_SUCCESS_URL,
    scopes: ['openid', 'email', 'profile'],
  });
}

function isGoogleOAuthConfigured(source = process.env) {
  try {
    getGoogleOAuthConfig(source);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  REQUIRED_VARIABLES,
  getGoogleOAuthConfig,
  isGoogleOAuthConfigured,
};
