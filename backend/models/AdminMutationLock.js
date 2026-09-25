const mongoose = require('mongoose');

const adminMutationLockSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'admin-mutual-exclusion',
    },
    owner: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false, timestamps: true },
);

adminMutationLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AdminMutationLock = mongoose.models.AdminMutationLock
  || mongoose.model('AdminMutationLock', adminMutationLockSchema);

module.exports = { AdminMutationLock };
