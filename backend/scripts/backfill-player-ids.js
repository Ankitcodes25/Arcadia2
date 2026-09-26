/*
 * Backfill Arcadia Player IDs for accounts created before the field existed.
 *
 * Run once against an existing database, from the backend directory:
 *
 *   npm run backfill:player-ids
 *
 * The backfill is safe to run repeatedly. It only ever touches an account that
 * has no valid Player ID, and its write is conditional on that still being true,
 * so a Player ID written by a concurrent signup is never overwritten. Accounts
 * that already have a valid Player ID are left completely alone.
 */
const FAILURE_CATEGORY = {
  CONFIG: 'environment/configuration problem',
  CONNECTION: 'MongoDB connection problem',
  RUNTIME: 'other runtime exception',
};

/*
 * Only these messages are ever shown. They are the safe configuration messages
 * `config/env.js` produces, and none of them contains a host, a database name or
 * a credential. Every other failure, including a driver or server error whose
 * text may embed the connection string, is reported by category only.
 */
const SAFE_CONFIG_MESSAGES = new Set([
  'MONGODB_URI is required',
  'MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI',
  'MONGODB_URI contains invalid characters',
  'MONGODB_URI must include a database name',
  'MONGODB_URI must enable TLS in production',
  'JWT_SECRET is required',
  'JWT_SECRET must be at least 32 characters',
  'JWT_SECRET must be a high-entropy production secret',
  'NODE_ENV must be development, test, or production',
  'FRONTEND_URL or CORS_ORIGIN is required in production',
  'FRONTEND_URL/CORS_ORIGIN cannot use a wildcard or null origin',
  'COOKIE_SAME_SITE must be lax, strict, or none',
  'COOKIE_SAME_SITE=none is only allowed in production',
  'TRUST_PROXY must be false, a hop count, or explicit proxy addresses',
]);

const NETWORK_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoParseError',
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoServerError',
  'MongooseError',
]);

function getSafeErrorMessage(error) {
  if (typeof error?.safeMessage === 'string' && SAFE_CONFIG_MESSAGES.has(error.safeMessage)) {
    return error.safeMessage;
  }

  if (typeof error?.message === 'string' && SAFE_CONFIG_MESSAGES.has(error.message)) {
    return error.message;
  }

  return null;
}

function printSafeFailure(error) {
  const safeMessage = getSafeErrorMessage(error);
  const category = safeMessage
    ? FAILURE_CATEGORY.CONFIG
    : NETWORK_ERROR_NAMES.has(error?.name)
      ? FAILURE_CATEGORY.CONNECTION
      : FAILURE_CATEGORY.RUNTIME;

  console.error('Player ID backfill failed.');
  console.error(`Category: ${category}`);
  if (safeMessage) {
    console.error(`Safe details: ${safeMessage}`);
  } else {
    // The raw message is withheld because a driver error can embed the
    // connection string, which must never reach the terminal.
    console.error('Safe details: raw error message withheld because it is not allowlisted.');
  }
}

async function main() {
  /*
   * Requiring config/env is what loads backend/.env, because its first
   * statement is `require('dotenv').config()`. It also validates the
   * environment on load and exposes the already validated `mongoUri`, so this
   * script neither reads the URI out of process.env itself nor repeats any of
   * the parsing or validation rules. This is the same path server.js takes.
   */
  const env = require('../config/env');
  const database = require('../config/database');
  const { backfillMissingPlayerIds } = require('../services/playerIdService');

  try {
    await database.connectDatabase(env.mongoUri);
    const result = await backfillMissingPlayerIds();

    console.log(
      `Player ID backfill complete. Accounts needing an ID: ${result.scanned}, `
      + `assigned: ${result.assigned}, failed: ${result.failed}.`,
    );

    if (result.failed > 0) {
      process.exitCode = 1;
    }

    return result;
  } finally {
    await database.disconnectDatabase().catch(() => {
      process.exitCode = 1;
    });
  }
}

if (require.main === module) {
  main().catch((error) => {
    printSafeFailure(error);
    process.exitCode = 1;
  });
}

module.exports = { main, printSafeFailure };
