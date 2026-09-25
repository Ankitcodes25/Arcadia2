const mongoose = require('mongoose');

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.keyHash;
  delete returnedObject.__v;
  return returnedObject;
}

const rateLimitBucketSchema = new mongoose.Schema(
  {
    keyHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    route: {
      type: String,
      required: true,
      maxlength: 160,
    },
    windowStart: {
      type: Number,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { transform: removePrivateFields },
    toObject: { transform: removePrivateFields },
  },
);

rateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RateLimitBucket = mongoose.models.RateLimitBucket
  || mongoose.model('RateLimitBucket', rateLimitBucketSchema);

module.exports = { RateLimitBucket };
