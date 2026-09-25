const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.refreshTokenHash;
  delete returnedObject.rotationClaimId;
  delete returnedObject.credentialVersion;
  delete returnedObject.userAgent;
  delete returnedObject.ip;
  delete returnedObject.__v;
  return returnedObject;
}

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    credentialVersion: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => Number.isSafeInteger(value) && value >= 0,
        message: 'credentialVersion must be a non-negative safe integer',
      },
      default: 0,
    },
    familyExpiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    replacedBySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    rotatedAt: {
      type: Date,
      default: null,
      select: false,
    },
    rotationClaimId: {
      type: String,
      default: null,
      select: false,
    },
    rotationClaimExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 512,
      default: null,
      select: false,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
      select: false,
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

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

module.exports = { Session };
