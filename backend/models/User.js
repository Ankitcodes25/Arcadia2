const mongoose = require('mongoose');
const {
  AVATAR_TYPES,
  DEFAULT_LOCAL_AVATAR_ID,
} = require('../config/avatar');
const {
  USERNAME_MAX_LENGTH,
  getUsernameValidationError,
} = require('../utils/username');

const USER_ROLES = Object.freeze({
  USER: 'USER',
  ADMIN: 'ADMIN',
});

const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  DELETED: 'DELETED',
});

const GOOGLE_PROVIDER = 'GOOGLE';

function removePrivateFields(_document, returnedObject) {
  delete returnedObject.passwordHash;
  delete returnedObject.usernameNormalized;
  delete returnedObject.usernameChangedAt;
  delete returnedObject.google;
  delete returnedObject.__v;
  return returnedObject;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    username: {
      type: String,
      trim: true,
      default: null,
      /*
       * The visible username is stored exactly as entered, so the field level
       * guard only mirrors the shared Unicode-aware rules instead of forcing
       * ASCII or lowercasing the value.
       */
      validate: {
        validator: (value) => {
          if (typeof value !== 'string' || value === '') return true;
          const validationError = getUsernameValidationError(value);
          if (validationError) throw new Error(validationError);
          return true;
        },
      },
    },
    usernameNormalized: {
      type: String,
      trim: true,
      lowercase: true,
      /*
       * Comparison-only value. 20 code points can be 40 UTF-16 units, so the
       * field guard allows for that instead of rejecting emoji usernames.
       */
      maxlength: USERNAME_MAX_LENGTH * 2,
      select: false,
      default: null,
    },
    usernameChangedAt: {
      type: Date,
      select: false,
      default: null,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },
    avatar: {
      type: {
        type: String,
        enum: Object.values(AVATAR_TYPES),
        default: AVATAR_TYPES.LOCAL,
      },
      value: {
        type: String,
        trim: true,
        maxlength: 64,
        default: DEFAULT_LOCAL_AVATAR_ID,
      },
    },
    passwordHash: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ACCOUNT_STATUSES),
      default: ACCOUNT_STATUSES.ACTIVE,
      required: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    google: {
      provider: {
        type: String,
        enum: [GOOGLE_PROVIDER],
        default: undefined,
      },
      subject: {
        type: String,
        trim: true,
        maxlength: 255,
        default: undefined,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 254,
        default: undefined,
      },
      pictureUrl: {
        type: String,
        trim: true,
        maxlength: 2048,
        default: undefined,
      },
      linkedAt: {
        type: Date,
        default: undefined,
      },
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
    },
    lastLoginUserAgent: {
      type: String,
      trim: true,
      maxlength: 512,
      default: null,
    },
    verificationEmailRequestedAt: {
      type: Date,
      select: false,
      default: null,
    },
    passwordResetRequestedAt: {
      type: Date,
      select: false,
      default: null,
    },
    tokenVersion: {
      type: Number,
      min: 0,
      validate: {
        validator: (value) => Number.isSafeInteger(value) && value >= 0,
        message: 'tokenVersion must be a non-negative safe integer',
      },
      default: 0,
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

userSchema.index(
  { usernameNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { usernameNormalized: { $type: 'string' } },
  },
);

userSchema.index(
  { 'google.provider': 1, 'google.subject': 1 },
  {
    unique: true,
    sparse: true,
  },
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = {
  User,
  USER_ROLES,
  ACCOUNT_STATUSES,
  GOOGLE_PROVIDER,
};
