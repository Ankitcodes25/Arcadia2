const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.codeHash;
  delete returnedObject.__v;
  return returnedObject;
}

const oauthHandoffSchema = new mongoose.Schema(
  {
    codeHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    credentialVersion: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: removePrivateFields,
    },
    toObject: {
      transform: removePrivateFields,
    },
  },
);

oauthHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthHandoff = mongoose.models.OAuthHandoff || mongoose.model('OAuthHandoff', oauthHandoffSchema);

module.exports = { OAuthHandoff };
