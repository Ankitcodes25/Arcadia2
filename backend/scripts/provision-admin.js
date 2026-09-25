const FAILURE_CATEGORIES = Object.freeze({
  ENVIRONMENT: '1 - Missing/invalid environment variables',
  MONGODB_CONFIGURATION: '2 - MongoDB URI/configuration problem',
  MONGODB_AUTHENTICATION: '3 - MongoDB authentication failure',
  MONGODB_DATABASE_SELECTION: '4 - MongoDB database selection problem',
  MONGODB_NETWORK: '5 - MongoDB network/server-selection problem',
  USER_MODEL: '6 - User model/index/validation problem',
  EXISTING_ADMIN_CONFLICT: '7 - Existing administrator conflict',
  RUNTIME: '8 - Other runtime exception',
});

const SAFE_ERROR_MESSAGES = new Set([
  'MONGODB_URI is required',
  'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI',
  'MONGODB_URI contains invalid characters',
  'MONGODB_URI must include a database name',
  'MONGODB_URI must enable TLS in production',
  'JWT_SECRET is required',
  'JWT_SECRET must be at least 32 characters',
  'JWT_SECRET must be a high-entropy production secret',
  'NODE_ENV must be development, test, or production',
  'PORT must be an integer between 0 and 65535',
  'FRONTEND_URL or CORS_ORIGIN is required in production',
  'FRONTEND_URL/CORS_ORIGIN cannot use a wildcard or null origin',
  'FRONTEND_URL/CORS_ORIGIN is invalid',
  'Frontend origins must use HTTPS in production',
  'COOKIE_SAME_SITE must be lax, strict, or none',
  'COOKIE_SAME_SITE=none is only allowed in production',
  'TRUST_PROXY must be false, a hop count, or explicit proxy addresses',
  'TRUST_PROXY hop count must be between 0 and 10',
  'BCRYPT_COST must be an integer between 10 and 15',
  'SECURITY_HSTS_MAX_AGE must be between 0 and 63072000',
  'ADMIN_EMAIL is required',
  'ADMIN_PASSWORD must be at least 12 characters',
  'ADMIN_PASSWORD must not exceed 72 UTF-8 bytes',
  'ADMIN_NAME must be at most 80 characters',
  'A valid admin email is required',
  'Password must be at least 12 characters',
  'Password is too long',
  'Choose a less common password',
  'Display name must be text',
  'Display name contains invalid characters',
  'Display name must be at most 80 characters',
  'Another administrator already exists; bootstrap aborted',
  'Admin bootstrap is already in progress',
  'Bootstrap target has an unsupported role',
  'Bootstrap target changed during provisioning',
  'Bootstrap security records changed during provisioning',
  'Transactional admin bootstrap failed; all changes were rolled back',
  'Admin bootstrap failed; rollback completed',
  'Admin bootstrap rollback could not be verified',
  'Admin bootstrap postcondition failed',
]);

let activePhase = 'loading backend configuration';
let disconnectDatabase = null;
let mongoDiagnosticState = {
  uriPresent: false,
  databaseName: null,
};

function safeIdentifier(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string' || !/^[A-Za-z0-9_.:/-]{1,100}$/.test(value)) {
    return null;
  }

  return value;
}

function getMongoDatabaseName(uri) {
  try {
    const databaseName = decodeURIComponent(new URL(uri).pathname.replace(/^\//, ''));
    return /^[A-Za-z0-9_.$-]{1,64}$/.test(databaseName) ? databaseName : null;
  } catch {
    return null;
  }
}

function getSafeErrorMessage(error) {
  if (typeof error?.safeMessage === 'string' && SAFE_ERROR_MESSAGES.has(error.safeMessage)) {
    return error.safeMessage;
  }

  if (typeof error?.message === 'string' && SAFE_ERROR_MESSAGES.has(error.message)) {
    return error.message;
  }

  return null;
}

function getValidationDetails(error) {
  if (!error?.errors || typeof error.errors !== 'object') {
    return null;
  }

  const details = Object.entries(error.errors).map(([path, detail]) => {
    const safePath = safeIdentifier(path);
    const safeKind = safeIdentifier(detail?.kind);
    return safePath && safeKind ? `${safePath} (${safeKind})` : null;
  }).filter(Boolean);

  return details.length ? details.join(', ') : null;
}

function isMongoNetworkError(error) {
  return new Set([
    'MongoNetworkError',
    'MongoNetworkTimeoutError',
    'MongooseServerSelectionError',
  ]).has(error?.name)
    || new Set([
      'EAI_AGAIN',
      'ECONNREFUSED',
      'ECONNRESET',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'ENOTFOUND',
      'ETIMEDOUT',
    ]).has(error?.code);
}

function classifyProvisioningFailure(error) {
  const safeMessage = getSafeErrorMessage(error);
  const name = safeIdentifier(error?.name);
  const code = safeIdentifier(error?.code);
  const codeName = safeIdentifier(error?.codeName);

  if (error?.statusCode === 409) {
    return {
      category: FAILURE_CATEGORIES.EXISTING_ADMIN_CONFLICT,
      message: safeMessage || 'The configured email belongs to a non-administrator account.',
      name,
      code,
      codeName,
    };
  }

  if (
    name === 'ValidationError'
    || name === 'ValidatorError'
    || name === 'CastError'
    || codeName?.toLowerCase().includes('index')
    || new Set(['68', '85', '86', '11000', '12582']).has(code)
  ) {
    return {
      category: FAILURE_CATEGORIES.USER_MODEL,
      message: getValidationDetails(error),
      name,
      code,
      codeName,
    };
  }

  if (name === 'MongoParseError' || safeMessage?.startsWith('MONGODB_URI ')) {
    return {
      category: FAILURE_CATEGORIES.MONGODB_CONFIGURATION,
      message: safeMessage,
      name,
      code,
      codeName,
    };
  }

  if (
    code === '13'
    || code === '18'
    || new Set(['AuthenticationFailed', 'Unauthorized']).has(codeName)
  ) {
    return {
      category: FAILURE_CATEGORIES.MONGODB_AUTHENTICATION,
      message: safeMessage,
      name,
      code,
      codeName,
      connectionReached: true,
    };
  }

  if (
    code === '26'
    || codeName === 'NamespaceNotFound'
    || safeMessage === 'MONGODB_URI must include a database name'
  ) {
    return {
      category: FAILURE_CATEGORIES.MONGODB_DATABASE_SELECTION,
      message: safeMessage,
      name,
      code,
      codeName,
      connectionReached: code === '26' || codeName === 'NamespaceNotFound' ? true : null,
    };
  }

  if (isMongoNetworkError(error)) {
    return {
      category: FAILURE_CATEGORIES.MONGODB_NETWORK,
      message: safeMessage,
      name,
      code,
      codeName,
      connectionReached: name === 'MongooseServerSelectionError' ? false : null,
    };
  }

  if (safeMessage) {
    const isAdminEnvironmentError = [
      'ADMIN_EMAIL',
      'ADMIN_NAME',
      'ADMIN_PASSWORD',
      'A valid admin email',
      'Choose a less common password',
      'Display name',
      'Password ',
    ].some((prefix) => safeMessage.startsWith(prefix));
    const isGeneralEnvironmentError = !safeMessage.startsWith('MONGODB_URI ');

    return {
      category: isAdminEnvironmentError || isGeneralEnvironmentError
        ? FAILURE_CATEGORIES.ENVIRONMENT
        : FAILURE_CATEGORIES.RUNTIME,
      message: safeMessage,
      name,
      code,
      codeName,
    };
  }

  return {
    category: FAILURE_CATEGORIES.RUNTIME,
    message: null,
    name,
    code,
    codeName,
  };
}

function printSafeFailure(error) {
  const diagnostic = classifyProvisioningFailure(error);
  console.error('Admin provisioning failed.');
  console.error(`Category: ${diagnostic.category}`);
  console.error(`Phase: ${activePhase}`);
  console.error(`MongoDB URI present: ${mongoDiagnosticState.uriPresent ? 'yes' : 'no'}`);

  if (mongoDiagnosticState.databaseName) {
    console.error(`MongoDB database: ${mongoDiagnosticState.databaseName}`);
  } else {
    console.error('MongoDB database: unavailable or unsafe to display');
  }

  if (diagnostic.connectionReached !== undefined) {
    console.error(`MongoDB connection reached: ${diagnostic.connectionReached ? 'yes' : 'no'}`);
  }
  if (diagnostic.name) {
    console.error(`Error name: ${diagnostic.name}`);
  }
  if (diagnostic.code !== null && diagnostic.code !== undefined) {
    console.error(`Error code: ${diagnostic.code}`);
  }
  if (diagnostic.codeName) {
    console.error(`Error code name: ${diagnostic.codeName}`);
  }
  if (diagnostic.message) {
    console.error(`Safe details: ${diagnostic.message}`);
  } else {
    console.error('Safe details: raw error message withheld because it is not allowlisted.');
  }
}

async function main() {
  activePhase = 'loading backend configuration';
  const { getAdminProvisioningConfig } = require('../config/env');

  activePhase = 'validating admin environment';
  const config = getAdminProvisioningConfig();
  mongoDiagnosticState = {
    uriPresent: true,
    databaseName: getMongoDatabaseName(config.mongoUri),
  };

  const database = require('../config/database');
  disconnectDatabase = database.disconnectDatabase;
  activePhase = 'connecting to MongoDB';
  await database.connectDatabase(config.mongoUri);

  activePhase = 'replacing the exact bootstrap user and creating the administrator atomically';
  const { provisionAdmin } = require('../services/adminProvisioner');
  const result = await provisionAdmin(config);

  if (result.created && result.replacedUser) {
    console.log('Existing bootstrap user deleted and fresh administrator provisioned.');
  } else if (result.created) {
    console.log('Fresh administrator provisioned.');
  } else {
    console.log('Administrator already exists.');
  }
  console.log(`Administrator count: ${result.adminCount}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      printSafeFailure(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (!disconnectDatabase) {
        return;
      }

      try {
        await disconnectDatabase();
      } catch {
        process.exitCode = 1;
      }
    });
}

module.exports = { main };
