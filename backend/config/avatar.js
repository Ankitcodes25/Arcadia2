const AVATAR_TYPES = Object.freeze({
  LOCAL: 'local',
  GOOGLE: 'google',
});

const LOCAL_AVATAR_IDS = Object.freeze([
  'avatar-01',
  'avatar-02',
  'avatar-03',
  'avatar-04',
  'avatar-05',
  'avatar-06',
]);

const DEFAULT_LOCAL_AVATAR_ID = LOCAL_AVATAR_IDS[0];
const GOOGLE_AVATAR_VALUE = 'google';

function isAllowedLocalAvatarId(value) {
  return typeof value === 'string' && LOCAL_AVATAR_IDS.includes(value);
}

function isSupportedAvatarType(value) {
  return value === AVATAR_TYPES.LOCAL || value === AVATAR_TYPES.GOOGLE;
}

module.exports = {
  AVATAR_TYPES,
  LOCAL_AVATAR_IDS,
  DEFAULT_LOCAL_AVATAR_ID,
  GOOGLE_AVATAR_VALUE,
  isAllowedLocalAvatarId,
  isSupportedAvatarType,
};
