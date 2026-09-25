const { User } = require('../models/User');
const { revokeAllRefreshSessions } = require('./refreshSessionService');

async function revokeAllUserSessions(userId) {
  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  ).select('-passwordHash -google');

  if (!user) {
    return null;
  }

  await revokeAllRefreshSessions(userId);
  return user;
}

module.exports = {
  revokeAllUserSessions,
};
