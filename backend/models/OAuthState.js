const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.stateHash;
  delete returnedObject.codeVerifier;
  delete returnedObject.nonce;
  delete returnedObject.__v;
  return returnedObject;
}

const oauthStateSchema = new mongoose.Schema(
  {
    stateHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    // The verifier is needed only during the short-lived code exchange.
    codeVerifier: {
      type: String,
      required: true,
      select: false,
    },
    // The nonce is needed only for ID-token validation during this transaction.
    nonce: {
      type: String,
      required: true,
      select: false,
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

oauthStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OAuthState = mongoose.models.OAuthState || mongoose.model('OAuthState', oauthStateSchema);

module.exports = { OAuthState };
