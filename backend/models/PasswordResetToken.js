const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.tokenHash;
  delete returnedObject.credentialVersion;
  delete returnedObject.__v;
  return returnedObject;
}

const passwordResetTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
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
    toJSON: { transform: removePrivateFields },
    toObject: { transform: removePrivateFields },
  },
);

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetTokenSchema.index({ userId: 1, consumedAt: 1 });

const PasswordResetToken = mongoose.models.PasswordResetToken
  || mongoose.model('PasswordResetToken', passwordResetTokenSchema);

module.exports = { PasswordResetToken };
