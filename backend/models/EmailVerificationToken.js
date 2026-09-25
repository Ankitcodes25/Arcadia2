const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.tokenHash;
  delete returnedObject.__v;
  return returnedObject;
}

const emailVerificationTokenSchema = new mongoose.Schema(
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

emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailVerificationTokenSchema.index({ userId: 1, consumedAt: 1 });

const EmailVerificationToken = mongoose.models.EmailVerificationToken
  || mongoose.model('EmailVerificationToken', emailVerificationTokenSchema);

module.exports = { EmailVerificationToken };
