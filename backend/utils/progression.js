const { getLevelBadge } = require('../config/levelBadges');

/*
 * Arcadia account progression.
 *
 * The XP requirement per level is generated from two constants instead of being
 * tabulated, so a new level never needs a new entry:
 *
 *   Level 0 -> 1 = 100 XP     Level 5 -> 6  = 550 XP
 *   Level 1 -> 2 = 200 XP     Level 6 -> 7  = 600 XP
 *   Level 2 -> 3 = 300 XP     Level 7 -> 8  = 650 XP
 *   Level 3 -> 4 = 400 XP     Level 8 -> 9  = 700 XP
 *   Level 4 -> 5 = 500 XP     Level 9 -> 10 = 750 XP
 *
 * Cumulative totals (the boundary values every level check is based on):
 *
 *   Level 0 = 0 XP    Level 3 = 600 XP    Level 6  = 2050 XP
 *   Level 1 = 100 XP  Level 4 = 1000 XP   Level 7  = 2650 XP
 *   Level 2 = 300 XP  Level 5 = 1500 XP   Level 8  = 3300 XP
 *
 * For the levels at and after the first stepped one the cumulative total is the
 * closed form `1500 + 25n^2 + 525n` where `n = level - 5`, which is also
 * inverted in `getLevelFromTotalXp()` instead of being scanned level by level.
 * The closed form estimate is always corrected against the exact totals, so a
 * value that lands exactly on a boundary is never off by one.
 *
 * Everything here is pure and deterministic: same total XP in, same
 * progression out, with no database and no clock.
 */
const BASE_LEVEL_XP_STEP = 100;
// First level whose requirement uses the stepped (growing) formula.
const FIRST_STEPPED_LEVEL = 5;
const STEPPED_LEVEL_XP_STEP = 50;
const STEPPED_LEVEL_BASE_XP = 550;
// Total XP required to reach the first stepped level: 100 + 200 + 300 + 400 + 500.
const CUMULATIVE_XP_AT_FIRST_STEPPED_LEVEL = 1500;

/*
 * Cumulative XP for L >= 5 expands to
 *   CUMULATIVE + STEPPED_LEVEL_QUAD * n^2 + STEPPED_LEVEL_LINEAR * n
 * with n = L - 5, because summing `550 + 50 * j` for j = 0..n-1 gives
 *   550n + 50 * n(n - 1) / 2  =  25n^2 + 525n.
 */
const STEPPED_LEVEL_QUAD = STEPPED_LEVEL_XP_STEP / 2;
const STEPPED_LEVEL_LINEAR = STEPPED_LEVEL_BASE_XP - STEPPED_LEVEL_QUAD;

/*
 * Total XP is clamped to the largest safe integer. That is far beyond any
 * reachable total (one verified Arcadion win awards 20 XP), and it keeps every
 * derived value finite so the UI can never receive NaN or Infinity.
 */
const MAX_TOTAL_XP = Number.MAX_SAFE_INTEGER;

/*
 * Arcadia's only XP source.
 *
 * Total XP is Arcadion XP: a level may only ever increase from a verified win
 * against ARCADION. A loss, a casual match with friends, any other game and
 * simply starting or finishing a game all award nothing, so those cases are not
 * expressed as rewards here at all. `services/progressionService.js` is what
 * refuses them.
 */
const XP_EARNING_GAME = 'arcadion';
const XP_REWARDS = Object.freeze({
  ARCADION_WIN: 20,
});

/** Coerces anything into a usable, non-negative, safe-integer XP total. */
function normalizeTotalXp(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.min(Math.floor(numeric), MAX_TOTAL_XP);
}

function normalizeLevelInput(level) {
  const numeric = Number(level);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

/** XP required to advance from `level` to `level + 1`. */
function getXpToAdvanceFromLevel(level) {
  const normalizedLevel = normalizeLevelInput(level);
  if (normalizedLevel < FIRST_STEPPED_LEVEL) {
    return BASE_LEVEL_XP_STEP * (normalizedLevel + 1);
  }

  return STEPPED_LEVEL_BASE_XP
    + STEPPED_LEVEL_XP_STEP * (normalizedLevel - FIRST_STEPPED_LEVEL);
}

/** Total XP required to reach `level` from Level 0. */
function getCumulativeXpForLevel(level) {
  const normalizedLevel = normalizeLevelInput(level);
  if (normalizedLevel === 0) return 0;

  if (normalizedLevel <= FIRST_STEPPED_LEVEL) {
    return BASE_LEVEL_XP_STEP * ((normalizedLevel * (normalizedLevel + 1)) / 2);
  }

  const steppedLevels = normalizedLevel - FIRST_STEPPED_LEVEL;
  return CUMULATIVE_XP_AT_FIRST_STEPPED_LEVEL
    + STEPPED_LEVEL_QUAD * steppedLevels * steppedLevels
    + STEPPED_LEVEL_LINEAR * steppedLevels;
}

/** The highest level whose cumulative total is still reached by `totalXp`. */
function getLevelFromTotalXp(totalXp) {
  const xp = normalizeTotalXp(totalXp);
  if (xp < BASE_LEVEL_XP_STEP) return 0;

  if (xp < CUMULATIVE_XP_AT_FIRST_STEPPED_LEVEL) {
    let level = 1;
    while (getCumulativeXpForLevel(level + 1) <= xp) level += 1;
    return level;
  }

  const remaining = xp - CUMULATIVE_XP_AT_FIRST_STEPPED_LEVEL;
  const discriminant = (STEPPED_LEVEL_LINEAR * STEPPED_LEVEL_LINEAR)
    + (4 * STEPPED_LEVEL_QUAD * remaining);
  let steppedLevels = Math.max(
    0,
    Math.floor(
      (Math.sqrt(discriminant) - STEPPED_LEVEL_LINEAR) / (2 * STEPPED_LEVEL_QUAD),
    ),
  );

  // Rounding of the closed form can land one step either side of a boundary, so
  // the estimate is snapped onto the exact cumulative totals.
  while (
    steppedLevels > 0
    && getCumulativeXpForLevel(FIRST_STEPPED_LEVEL + steppedLevels) > xp
  ) {
    steppedLevels -= 1;
  }
  while (
    getCumulativeXpForLevel(FIRST_STEPPED_LEVEL + steppedLevels + 1) <= xp
  ) {
    steppedLevels += 1;
  }

  return FIRST_STEPPED_LEVEL + steppedLevels;
}

/**
 * Full progression view for a total XP value. This is the only shape the
 * backend ever returns, so the level, badge and progress can never disagree
 * between two surfaces.
 */
function getProgression(totalXp) {
  const safeTotalXp = normalizeTotalXp(totalXp);
  const level = getLevelFromTotalXp(safeTotalXp);
  const currentLevelXp = safeTotalXp - getCumulativeXpForLevel(level);
  const nextLevelXp = getXpToAdvanceFromLevel(level);
  const badge = getLevelBadge(level);
  const progressPercent = nextLevelXp > 0
    ? Math.min(100, Math.max(0, Math.round((currentLevelXp / nextLevelXp) * 100)))
    : 0;

  return {
    totalXp: safeTotalXp,
    level,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    title: badge.title,
    badgeKey: badge.badgeKey,
    themeKey: badge.themeKey,
  };
}

module.exports = {
  BASE_LEVEL_XP_STEP,
  FIRST_STEPPED_LEVEL,
  STEPPED_LEVEL_XP_STEP,
  STEPPED_LEVEL_BASE_XP,
  CUMULATIVE_XP_AT_FIRST_STEPPED_LEVEL,
  MAX_TOTAL_XP,
  XP_EARNING_GAME,
  XP_REWARDS,
  normalizeTotalXp,
  getXpToAdvanceFromLevel,
  getCumulativeXpForLevel,
  getLevelFromTotalXp,
  getProgression,
};
