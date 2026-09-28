const mongoose = require('mongoose');

/*
 * Arcadia match history.
 *
 * A row here is one COMPLETED match. There is no row for a game that was opened,
 * started and abandoned, so the collection only ever grows from a genuine result
 * reported by a server-side game system.
 *
 * The record is written by trusted server-side code only. There is deliberately
 * NO HTTP route that creates a match: a client cannot submit a result, an
 * opponent, a timestamp or a game, so nobody can award themselves a win. The only
 * route is the read endpoint, which is scoped to the signed-in user.
 *
 * `_id` is the stable public identifier the frontend uses as a list key. No other
 * internal field is ever exposed.
 */

/** Who the account played against. These are the only accepted values. */
const OPPONENT_TYPES = Object.freeze({
  /** The Arcadion AI. The only source of Arcadion XP. */
  ARCADION: 'ARCADION',
  /** Another account, online. */
  ONLINE_FRIEND: 'ONLINE_FRIEND',
  /** Face to face on the same device or location. */
  LOCAL: 'LOCAL',
});

/** How the completed match ended for this account. */
const MATCH_RESULTS = Object.freeze({
  WIN: 'WIN',
  LOSS: 'LOSS',
  DRAW: 'DRAW',
});

const OPPONENT_TYPE_VALUES = Object.freeze(Object.values(OPPONENT_TYPES));
const MATCH_RESULT_VALUES = Object.freeze(Object.values(MATCH_RESULTS));

/*
 * Longest values are bounded so a document can never be used to store arbitrary
 * text. The opponent display name is optional: it is only known when the other
 * player has chosen to publish one.
 */
const MAX_GAME_NAME_LENGTH = 64;
const MAX_OPPONENT_NAME_LENGTH = 48;
const MAX_DURATION_MINUTES = 24 * 60;

function removePrivateFields(_document, returnedObject) {
  // Only the public match fields are ever returned. Nothing else is stored.
  return {
    matchId: String(returnedObject._id),
    game: returnedObject.game,
    opponentType: returnedObject.opponentType,
    opponentName: returnedObject.opponentName || null,
    result: returnedObject.result,
    completedAt: returnedObject.completedAt,
    durationMinutes:
      typeof returnedObject.durationMinutes === 'number' ? returnedObject.durationMinutes : null,
  };
}

const matchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    game: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: MAX_GAME_NAME_LENGTH,
    },
    /*
     * The opponent kind is an allowlisted enum, so a human or local match can
     * never be recorded as Arcadion, and it is never inferred from a name.
     */
    opponentType: {
      type: String,
      required: true,
      enum: OPPONENT_TYPE_VALUES,
    },
    /*
     * Optional and display only. It is a public label chosen by the other
     * player; no email, id or other account data is ever stored here.
     */
    opponentName: {
      type: String,
      trim: true,
      maxlength: MAX_OPPONENT_NAME_LENGTH,
      default: null,
    },
    result: {
      type: String,
      required: true,
      enum: MATCH_RESULT_VALUES,
    },
    /*
     * When the match actually finished. The list is sorted by this value, and it
     * is set by the recording code rather than trusted from anywhere a client
     * can reach.
     */
    completedAt: {
      type: Date,
      required: true,
    },
    /* Only stored when the game system measured it. */
    durationMinutes: {
      type: Number,
      min: 0,
      max: MAX_DURATION_MINUTES,
      default: null,
    },
  },
  {
    versionKey: false,
    toJSON: { transform: removePrivateFields },
    toObject: { transform: removePrivateFields },
  },
);

// Newest first for the one query the list makes, scoped to a single account.
matchSchema.index({ userId: 1, completedAt: -1 });

const Match = mongoose.models.Match || mongoose.model('Match', matchSchema);

module.exports = {
  Match,
  OPPONENT_TYPES,
  MATCH_RESULTS,
  OPPONENT_TYPE_VALUES,
  MATCH_RESULT_VALUES,
  MAX_DURATION_MINUTES,
};
