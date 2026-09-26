const mongoose = require('mongoose');
const { User, ACCOUNT_STATUSES } = require('../models/User');
const {
  XP_EARNING_GAME,
  XP_REWARDS,
  getProgression,
} = require('../utils/progression');

/*
 * Server-authoritative Arcadion progression.
 *
 * The rule this service exists to enforce:
 *
 *   Total XP is Arcadion XP, and a level can only increase from a verified win
 *   against ARCADION.
 *
 *   ARCADION win                -> +20 XP, which may cross a level threshold
 *   ARCADION loss               -> +0 XP
 *   match with friends/humans   -> +0 XP
 *   any non-Arcadion match      -> +0 XP
 *   starting/finishing a game   -> +0 XP
 *
 * That is enforced structurally rather than by convention:
 *
 *   - `awardXp()` is module-private. The only exported entry point is
 *     `awardArcadionXp()`, which awards XP exclusively for a verified ARCADION
 *     win and writes nothing at all for every other outcome.
 *   - There is no HTTP route for it. A client can never submit an XP amount, a
 *     result, or a game id, so there is no endpoint to abuse.
 *   - The write is a single atomic `$inc`, so two results recorded at the same
 *     time both land instead of one overwriting the other.
 *   - Level, title, badge and progress are never stored. They are derived from
 *     the stored total on every read, so the frontend can never set them.
 *
 * A future Arcadion match system validates the result on the server and then
 * calls `awardArcadionXp()` from its own server-side code.
 */

/** The single XP grant source. There is no other way to move a total. */
const XP_GRANT_SOURCES = Object.freeze({
  ARCADION_WIN: 'ARCADION_WIN',
});

/** Server-side match outcomes a game system can report. */
const MATCH_RESULTS = Object.freeze({
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
});

/** Why an XP award was or was not granted. Reported to the caller, never to a client. */
const XP_AWARD_REASONS = Object.freeze({
  ARCADION_WIN: 'ARCADION_WIN',
  NOT_ARCADION: 'NOT_ARCADION',
  NOT_A_WIN: 'NOT_A_WIN',
  UNVERIFIED: 'UNVERIFIED',
});

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = true;
  return error;
}

/**
 * The one and only XP write. Not exported, so no other module can call it with
 * an amount of its choosing.
 */
async function awardXp({ userId, amount, reference = null }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw createError('XP amount must be a positive safe integer', 400);
  }

  /*
   * The filter also requires the stored total to be a non-negative number, so a
   * value corrupted outside the schema is never built upon and the total can
   * never move below the schema minimum.
   */
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(userId),
      status: ACCOUNT_STATUSES.ACTIVE,
      totalXp: { $type: 'number', $gte: 0 },
    },
    { $inc: { totalXp: amount } },
    { returnDocument: 'after' },
  );

  if (!updatedUser) {
    throw createError('Account not found', 404);
  }

  return {
    updatedUser,
    awardedXp: amount,
    source: XP_GRANT_SOURCES.ARCADION_WIN,
    reference: typeof reference === 'string' ? reference.slice(0, 128) : null,
  };
}

async function requireActiveUser(userId) {
  if (typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
    throw createError('Invalid user ID', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw createError('Account not found', 404);
  }

  return user;
}

/**
 * Records the outcome of a server-validated match and awards XP only for a
 * verified ARCADION win.
 *
 * This is the entry point future game systems call. It is not a public API: no
 * route exposes it and no request body can reach it.
 *
 * @param {object} options
 * @param {string} options.userId   Target account id.
 * @param {string} options.game     Game the match belonged to.
 * @param {string} options.result   Server-validated outcome from MATCH_RESULTS.
 * @param {boolean} options.verified Whether the server validated the result.
 * @param {string} [options.reference] Optional server-side audit reference.
 */
async function awardArcadionXp({
  userId,
  game,
  result,
  verified,
  reference = null,
}) {
  const user = await requireActiveUser(userId);
  const currentProgression = getProgression(user.totalXp);

  // Anything that is not a verified win against ARCADION awards nothing and
  // writes nothing, so a loss or a casual match can never move a level.
  if (game !== XP_EARNING_GAME) {
    return { awardedXp: 0, reason: XP_AWARD_REASONS.NOT_ARCADION, progression: currentProgression };
  }

  if (result !== MATCH_RESULTS.WIN) {
    return { awardedXp: 0, reason: XP_AWARD_REASONS.NOT_A_WIN, progression: currentProgression };
  }

  if (verified !== true) {
    return { awardedXp: 0, reason: XP_AWARD_REASONS.UNVERIFIED, progression: currentProgression };
  }

  const awarded = await awardXp({
    userId,
    amount: XP_REWARDS.ARCADION_WIN,
    reference,
  });

  return {
    awardedXp: awarded.awardedXp,
    reason: XP_AWARD_REASONS.ARCADION_WIN,
    reference: awarded.reference,
    progression: getProgression(awarded.updatedUser.totalXp),
  };
}

/** Progression for a loaded user document. */
function getProgressionForUser(user) {
  return getProgression(user && user.totalXp);
}

module.exports = {
  XP_GRANT_SOURCES,
  XP_REWARDS,
  MATCH_RESULTS,
  XP_AWARD_REASONS,
  awardArcadionXp,
  getProgressionForUser,
};
