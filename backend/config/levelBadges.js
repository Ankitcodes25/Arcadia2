/*
 * Arcadia level badge and title metadata.
 *
 * This is the single source of truth for "which badge and title belongs to
 * which level". It holds no progression math: the level itself is always
 * derived from the account total XP by `utils/progression.js`, which calls
 * `getLevelBadge()` to resolve the metadata for the level it calculated.
 *
 * Only stable keys cross the API boundary. Any animation, gradient or glow
 * that belongs to a tier is a frontend presentation concern, so the animated
 * flame tier at the top is described here purely by its keys: the frontend
 * drives that animation off `badgeKey`, not off `themeKey`.
 *
 * A tier's `badgeKey` and `themeKey` name the same material (bronze, silver,
 * gold, diamond, crown, flame) and the frontend renders the matching theme.
 * The level ranges here are authoritative and are shared with the level avatar
 * tiers, which the frontend test suite pins to these exact values so the two
 * lists can never drift apart.
 */
const LEVEL_BADGE_TIERS = Object.freeze([
  Object.freeze({
    badgeKey: 'bronze',
    title: 'Arcadia Rookie',
    themeKey: 'bronze',
    minLevel: 0,
    // null means "and every level above", which is how the last tier is open ended.
    maxLevel: 4,
  }),
  Object.freeze({
    badgeKey: 'silver',
    title: 'Arcadia Challenger',
    themeKey: 'silver',
    minLevel: 5,
    maxLevel: 9,
  }),
  Object.freeze({
    badgeKey: 'gold',
    title: 'Arcadia Veteran',
    themeKey: 'gold',
    minLevel: 10,
    maxLevel: 14,
  }),
  Object.freeze({
    badgeKey: 'diamond',
    title: 'Arcadia Master',
    themeKey: 'diamond',
    minLevel: 15,
    maxLevel: 19,
  }),
  Object.freeze({
    badgeKey: 'crown',
    title: 'Arcadia Legend',
    themeKey: 'crown',
    minLevel: 20,
    maxLevel: 29,
  }),
  Object.freeze({
    badgeKey: 'flame',
    title: 'Arcadia Supreme',
    themeKey: 'flame',
    minLevel: 30,
    maxLevel: null,
  }),
]);

const FIRST_LEVEL_BADGE_TIER = LEVEL_BADGE_TIERS[0];

function normalizeLevel(level) {
  const numeric = Number(level);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

/**
 * Resolves the badge tier for a level. The tiers are ordered and contiguous,
 * so the last matching entry is always the most specific one.
 */
function getLevelBadge(level) {
  const normalizedLevel = normalizeLevel(level);

  for (const tier of LEVEL_BADGE_TIERS) {
    if (normalizedLevel < tier.minLevel) break;
    if (tier.maxLevel === null || normalizedLevel <= tier.maxLevel) {
      return tier;
    }
  }

  return FIRST_LEVEL_BADGE_TIER;
}

module.exports = {
  LEVEL_BADGE_TIERS,
  getLevelBadge,
};
